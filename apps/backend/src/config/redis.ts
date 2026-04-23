import { createClient, RedisClientType } from "redis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
console.log("Redis connecting to:", redisUrl.replace(/:([^@]+)@/, ":***@"));

export const redisClient: RedisClientType = createClient({ url: redisUrl }) as RedisClientType;

redisClient.on("error", (err) => {
  console.error("Redis error ❌", err);
});

export const connectRedis = async () => {
  await redisClient.connect();
  console.log("Redis connected ✅");
};