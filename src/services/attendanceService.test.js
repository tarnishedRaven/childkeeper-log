import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as firestore from 'firebase/firestore'
import {
  backfillAttendanceSortKeys,
  getAttendanceTotalCount,
  getAttendancePage,
  syncAttendanceSortKeysForChild,
  syncAttendanceSortKeysForFamily,
} from './attendanceService'

vi.mock('firebase/firestore')
vi.mock('../firebase', () => ({
  db: {},
}))

function docEntry(id, data) {
  return {
    id,
    data: () => data,
  }
}

describe('attendanceService pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    firestore.collection.mockReturnValue({})
    firestore.documentId.mockReturnValue('__name__')
    firestore.orderBy.mockImplementation((fieldPath, direction) => ({ fieldPath, direction }))
    firestore.where.mockImplementation((fieldPath, op, value) => ({ fieldPath, op, value }))
    firestore.limit.mockImplementation((value) => ({ limit: value }))
    firestore.limitToLast.mockImplementation((value) => ({ limitToLast: value }))
    firestore.startAfter.mockImplementation((value) => ({ startAfter: value }))
    firestore.endBefore.mockImplementation((value) => ({ endBefore: value }))
    firestore.query.mockImplementation((...constraints) => ({ constraints }))
    firestore.writeBatch.mockImplementation(() => ({
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue(),
    }))
  })

  it('requires pageSize >= 1', async () => {
    await expect(getAttendancePage('u1', { pageSize: 0 })).rejects.toThrow('pageSize must be at least 1')
  })

  it('returns total attendance count', async () => {
    firestore.getCountFromServer.mockResolvedValue({
      data: () => ({ count: 42 }),
    })

    const count = await getAttendanceTotalCount('u1')
    expect(count).toBe(42)
  })

  it('returns next page with deterministic cursors and hasNext indicator', async () => {
    firestore.getDocs.mockResolvedValue({
      docs: [
        docEntry('a1', { date: '2026-07-19' }),
        docEntry('a2', { date: '2026-07-18' }),
        docEntry('a3', { date: '2026-07-17' }),
      ],
    })

    const cursor = { snapshot: { id: 'prev-last' } }
    const result = await getAttendancePage('u1', {
      pageSize: 2,
      sortKey: 'date',
      sortDir: 'desc',
      cursor,
      direction: 'next',
    })

    expect(firestore.startAfter).toHaveBeenCalledWith(cursor.snapshot)
    expect(result.rows).toHaveLength(2)
    expect(result.hasNext).toBe(true)
    expect(result.hasPrev).toBe(true)
    expect(result.firstCursor.id).toBe('a1')
    expect(result.lastCursor.id).toBe('a2')
  })

  it('returns previous page using endBefore + limitToLast', async () => {
    firestore.getDocs.mockResolvedValue({
      docs: [
        docEntry('a1', { date: '2026-07-21' }),
        docEntry('a2', { date: '2026-07-20' }),
        docEntry('a3', { date: '2026-07-19' }),
      ],
    })

    const cursor = { snapshot: { id: 'current-first' } }
    const result = await getAttendancePage('u1', {
      pageSize: 2,
      sortKey: 'time',
      sortDir: 'asc',
      cursor,
      direction: 'prev',
    })

    expect(firestore.endBefore).toHaveBeenCalledWith(cursor.snapshot)
    expect(firestore.limitToLast).toHaveBeenCalledWith(3)
    expect(result.rows).toHaveLength(2)
    expect(result.hasPrev).toBe(true)
    expect(result.hasNext).toBe(true)
    expect(result.firstCursor.id).toBe('a2')
    expect(result.lastCursor.id).toBe('a3')
  })

  it('syncs family sort keys across matching attendance rows', async () => {
    const ref1 = { id: 'a1' }
    const ref2 = { id: 'a2' }
    const batch = { update: vi.fn(), commit: vi.fn().mockResolvedValue() }
    firestore.writeBatch.mockReturnValue(batch)
    firestore.getDocs.mockResolvedValue({
      docs: [
        { id: 'a1', ref: ref1, data: () => ({}) },
        { id: 'a2', ref: ref2, data: () => ({}) },
      ],
    })

    const updated = await syncAttendanceSortKeysForFamily('u1', 'f1', 'Smith Family')

    expect(updated).toBe(2)
    expect(batch.update).toHaveBeenCalledTimes(2)
    expect(batch.update.mock.calls[0][1]).toMatchObject({ familySortKey: 'smith family' })
  })

  it('syncs child sort keys across matching attendance rows', async () => {
    const ref1 = { id: 'a1' }
    const batch = { update: vi.fn(), commit: vi.fn().mockResolvedValue() }
    firestore.writeBatch.mockReturnValue(batch)
    firestore.getDocs.mockResolvedValue({
      docs: [{ id: 'a1', ref: ref1, data: () => ({}) }],
    })

    const updated = await syncAttendanceSortKeysForChild('u1', 'c1', 'Ava Jones')

    expect(updated).toBe(1)
    expect(batch.update).toHaveBeenCalledWith(
      ref1,
      expect.objectContaining({ childSortKey: 'ava jones' })
    )
  })

  it('backfills outdated attendance sort keys', async () => {
    const batch = { update: vi.fn(), commit: vi.fn().mockResolvedValue() }
    firestore.writeBatch.mockReturnValue(batch)
    firestore.getDocs
      .mockResolvedValueOnce({
        docs: [{ id: 'f1', data: () => ({ name: 'Smith Family' }) }],
      })
      .mockResolvedValueOnce({
        docs: [{ id: 'c1', data: () => ({ firstName: 'Ava', lastName: 'Jones', displayName: '' }) }],
      })
      .mockResolvedValueOnce({
        docs: [
          {
            id: 'a1',
            ref: { id: 'a1' },
            data: () => ({
              familyId: 'f1',
              childId: 'c1',
              lunchBrought: true,
              familySortKey: 'old family',
              childSortKey: 'old child',
              lunchSortKey: 0,
            }),
          },
        ],
      })

    const updated = await backfillAttendanceSortKeys('u1')

    expect(updated).toBe(1)
    expect(batch.update).toHaveBeenCalledWith(
      { id: 'a1' },
      expect.objectContaining({
        familySortKey: 'smith family',
        childSortKey: 'ava jones',
        lunchSortKey: 1,
      })
    )
  })
})
