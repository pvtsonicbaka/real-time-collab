import { createClient, RedisClientType } from "redis";

const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379}`;

export const redisClient: RedisClientType = createClient({ url: redisUrl }) as RedisClientType;

redisClient.on("error", (err) => {
  console.error("Redis error ❌", err);
});

export const connectRedis = async () => {
  await redisClient.connect();
  console.log("Redis connected ✅");
};