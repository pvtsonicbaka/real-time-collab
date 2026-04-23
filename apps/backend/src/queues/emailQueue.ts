import { Queue } from "bullmq";

export interface EmailJob {
  to: string;
  subject: string;
  html: string;
}

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

export const emailQueue = new Queue<EmailJob>("emails", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export const queueEmail = async (job: EmailJob) => {
  try {
    await emailQueue.add("send-email", job);
  } catch (err) {
    console.error("Failed to queue email:", err);
  }
};
