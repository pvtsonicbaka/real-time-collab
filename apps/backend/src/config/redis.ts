import { createClient, RedisClientType } from "redis";

export const redisClient: RedisClientType = createClient({
  url: "redis://localhost:6379",
});

redisClient.on("error", (err) => {
  console.error("Redis error ❌", err);
});

export const connectRedis = async () => {
  await redisClient.connect();
  console.log("Redis connected ✅");
};