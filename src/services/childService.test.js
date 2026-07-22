import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as firestore from 'firebase/firestore'
import { updateChild } from './childService'

vi.mock('firebase/firestore')
vi.mock('../firebase', () => ({
  db: {},
}))
vi.mock('./attendanceService', () => ({
  syncAttendanceSortKeysForChild: vi.fn(),
}))

import { syncAttendanceSortKeysForChild } from './attendanceService'

describe('childService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    firestore.doc.mockReturnValue({ id: 'child-1' })
    firestore.updateDoc.mockResolvedValue()
    syncAttendanceSortKeysForChild.mockResolvedValue(2)
  })

  it('propagates merged child display name changes to attendance sort keys', async () => {
    firestore.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        firstName: 'Ava',
        lastName: 'Smith',
        displayName: '',
      }),
    })

    await updateChild('u1', 'child-1', {
      lastName: 'Jones',
    })

    expect(syncAttendanceSortKeysForChild).toHaveBeenCalledWith('u1', 'child-1', 'Ava Jones')
  })

  it('does not sync attendance sort keys when no name fields change', async () => {
    await updateChild('u1', 'child-1', {
      birthDate: '2020-01-01',
    })

    expect(firestore.getDoc).not.toHaveBeenCalled()
    expect(syncAttendanceSortKeysForChild).not.toHaveBeenCalled()
  })
})
