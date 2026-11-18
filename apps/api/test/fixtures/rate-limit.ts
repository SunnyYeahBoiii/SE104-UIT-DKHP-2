import Redis from 'ioredis'

/**
 * NFR-05 windows are keyed by user id and outlive a reseed, which restarts id sequences. A suite
 * that runs within 60 s of the previous run would otherwise inherit someone else's counter and get
 * a 429 mid-test, so every registration suite clears the counters of its own Redis DB first.
 */
export async function clearRegistrationRateLimits(): Promise<void> {
  const redis = new Redis(process.env.REGISTRATION_REDIS_URL ?? 'redis://localhost:6379/14', {
    maxRetriesPerRequest: 1,
  })
  try {
    let cursor = '0'
    do {
      const [next, keys] = await redis.scan(
        cursor,
        'MATCH',
        'dkhp:rate:registration:*',
        'COUNT',
        500,
      )
      if (keys.length > 0) await redis.del(...keys)
      cursor = next
    } while (cursor !== '0')
  } finally {
    await redis.quit()
  }
}
