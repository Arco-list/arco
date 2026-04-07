import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// Redis client singleton
let redis: Redis | null = null
const ratelimiterCache = new Map<string, Ratelimit>()

type RateLimitOptions = {
  /**
   * Maximum number of requests allowed within the window.
   * Defaults to 10 if not provided.
   */
  limit?: number
  /**
   * Sliding window duration in seconds.
   * Defaults to 60 seconds if not provided.
   */
  window?: number
  /**
   * Prefix used for the rate limiter keys in Redis/analytics.
   * Defaults to "@arco/ratelimit".
   */
  prefix?: string
}

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

function getRateLimiter(options?: RateLimitOptions) {
  const redisClient = getRedis()

  if (!redisClient) {
    return null
  }

  const limit = options?.limit ?? 10
  const windowInSeconds = options?.window ?? 60
  const basePrefix = options?.prefix ?? "@arco/ratelimit"
  const limiterKey = `${basePrefix}:${limit}:${windowInSeconds}`

  if (!ratelimiterCache.has(limiterKey)) {
    ratelimiterCache.set(
      limiterKey,
      new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(limit, `${windowInSeconds} s`),
        analytics: true,
        prefix: limiterKey,
      }),
    )
  }

  return ratelimiterCache.get(limiterKey) ?? null
}

export async function checkRateLimit(
  identifier: string,
  options?: RateLimitOptions,
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  const limiter = getRateLimiter(options)

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
