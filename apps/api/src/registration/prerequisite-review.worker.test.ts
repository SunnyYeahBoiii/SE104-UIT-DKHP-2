import 'reflect-metadata'

import { describe, expect, it } from 'bun:test'
import type { Job } from 'bullmq'

import { PrerequisiteReviewService, type ReviewResult } from './prerequisite-review.service'
import { PrerequisiteReviewProcessor, REVIEW_JOB } from './prerequisite-review.worker'

const result: ReviewResult = { reviewed: 3, cleared: 1, cancelled: 2, kept: 0 }

describe('bullmq: daily prerequisite review job', () => {
  const processor = new PrerequisiteReviewProcessor({
    review: () => Promise.resolve(result),
  } as unknown as PrerequisiteReviewService)

  it('runs the review for the daily job name', async () => {
    expect(await processor.process({ name: REVIEW_JOB } as Job)).toEqual(result)
  })

  it('refuses an unknown job name instead of silently doing work', () =>
    expect(processor.process({ name: 'other' } as Job)).rejects.toThrow('Unknown prerequisite job'))
})
