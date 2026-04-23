import { createClient, RedisClientType } from "redis";

export const redisClient: RedisClientType = createClient({
  url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379}`,
  socket: {
    tls: process.env.REDIS_URL?.startsWith("rediss://") || process.env.NODE_ENV === "production",
  },
});

redisClient.on("error", (err) => {
  console.error("Redis error ❌", err);
});

export const connectRedis = async () => {
  await redisClient.connect();
  console.log("Redis connected ✅");
};