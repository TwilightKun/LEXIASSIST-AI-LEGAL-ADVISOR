// src/lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Burst limit: Caps API dispatches (10 per hour)
export const agentInitLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 h"),
  prefix: "ratelimit:agent-init",
  analytics: true,
});

// Cost ceiling: Caps daily dispatches per user (40 per 24 hours)
export const agentInitDailyLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(40, "24 h"),
  prefix: "ratelimit:agent-init-daily",
  analytics: true,
});

// Baseline limiter for general routes (60 per minute)
export const generalApiLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix: "ratelimit:general",
  analytics: true,
});

// Login attempts (10 attempts per 15 minutes per email)
// Prevents credential stuffing and brute-force attacks against specific accounts.
export const loginAttemptLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "15 m"),
  prefix: "ratelimit:login",
  analytics: true,
});

// Registration spam (5 attempts per hour per IP address)
// Prevents mass account creation bots from filling your database.
export const registrationLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  prefix: "ratelimit:register",
  analytics: true,
});

export type RateLimitResult = Awaited<ReturnType<Ratelimit["limit"]>>;

export async function checkLimit(limiter: Ratelimit, identifier: string): Promise<RateLimitResult> {
  return limiter.limit(identifier);
}