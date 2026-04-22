import { Worker } from "bullmq";
import nodemailer from "nodemailer";
import type { EmailJob } from "../queues/emailQueue";

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
};

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
