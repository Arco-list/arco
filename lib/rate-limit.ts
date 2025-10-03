import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// Redis client singleton
let redis: Redis | null = null
let ratelimiter: Ratelimit | null = null

function getRedis() {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN

    if (!url || !token) {
      // If Upstash is not configured, return null (rate limiting will be skipped)
      return null
    }

    redis = new Redis({
      url,
      token,
    })
  }

  return redis
}

function getRateLimiter() {
  const redisClient = getRedis()

  if (!redisClient) {
    return null
  }

  if (!ratelimiter) {
    ratelimiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(10, "60 s"), // 10 requests per 60 seconds
      analytics: true,
      prefix: "@arco/ratelimit",
    })
  }

  return ratelimiter
}

export async function checkRateLimit(identifier: string): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  const limiter = getRateLimiter()

  // If rate limiting is not configured, allow all requests
  if (!limiter) {
    return {
      success: true,
      limit: Infinity,
      remaining: Infinity,
      reset: 0,
    }
  }

  const result = await limiter.limit(identifier)

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  }
}
