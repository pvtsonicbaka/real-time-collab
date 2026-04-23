import { Worker } from "bullmq";
import nodemailer from "nodemailer";
import type { EmailJob } from "../queues/emailQueue";

function getBullMQConnection() {
  const url = process.env.REDIS_URL;
  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || "6379"),
      password: parsed.password || undefined,
      tls: parsed.protocol === "rediss:" ? {} : undefined,
    };
  }
  return {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  };
}

const connection = getBullMQConnection();

const sanitizeLog = (s: string) => String(s).replace(/[\r\n]/g, " ").slice(0, 200);

export const startEmailWorker = () => {
  // create transporter here — env vars are loaded by this point
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  const worker = new Worker<EmailJob>(
    "emails",
    async (job) => {
      const { to, subject, html } = job.data;
      const from = process.env.EMAIL_FROM || process.env.GMAIL_USER;

      if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
        console.log(`[Email stub] To: ${sanitizeLog(to)} | Subject: ${sanitizeLog(subject)}`);
        return;
      }

      await transporter.sendMail({ from, to, subject, html });
      console.log(`Email sent to ${sanitizeLog(to)}: ${sanitizeLog(subject)}`);
    },
    { connection, concurrency: 5 }
  );

  worker.on("failed", (job, err) => {
    console.error(`Email job ${job?.id} failed: ${sanitizeLog(err.message)}`);
  });

  console.log("Email worker started ✅");
  return worker;
};
