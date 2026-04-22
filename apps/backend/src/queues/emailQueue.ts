import { Queue } from "bullmq";
import { redisClient } from "../config/redis";

export interface EmailJob {
  to: string;
  subject: string;
  html: string;
}

// BullMQ needs a plain ioredis-compatible connection config, not the node-redis client
// so we pass the connection options directly
const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
};

export const emailQueue = new Queue<EmailJob>("emails", {
  connection,
  defaultJobOptions: {
    attempts: 3,                          // retry up to 3 times on failure
    backoff: { type: "exponential", delay: 2000 }, // wait 2s, 4s, 8s between retries
    removeOnComplete: 100,                // keep last 100 completed jobs
    removeOnFail: 50,                     // keep last 50 failed jobs
  },
});

export const queueEmail = async (job: EmailJob) => {
  try {
    await emailQueue.add("send-email", job);
  } catch (err) {
    console.error("Failed to queue email:", err);
  }
};
