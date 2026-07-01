import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as firestore from 'firebase/firestore'
import {
  calculateDuration,
  calculateEarnings,
  addTimeEntry,
  getTimeEntries,
  getRecentTimeEntries,
  getTimeEntriesByFamily,
  updateTimeEntry,
  deleteTimeEntry,
} from './timeEntryService'

vi.mock('firebase/firestore')
vi.mock('../firebase', () => ({
  db: {},
}))

describe('Time Entry Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('calculateDuration', () => {
    it('should calculate duration correctly', () => {
      const duration = calculateDuration('09:00', '12:00')
      expect(duration).toBe(3)
    })

    it('should handle minutes', () => {
      const duration = calculateDuration('09:30', '12:45')
      expect(duration).toBeCloseTo(3.25, 2)
    })

    it('should throw error if endTime is before startTime', () => {
      expect(() => calculateDuration('12:00', '09:00')).toThrow(
        'End time must be after start time'
      )
    })

    it('should throw error for invalid time format', () => {
      expect(() => calculateDuration('invalid', '12:00')).toThrow('Invalid time format')
    })

    it('should throw error if times are equal', () => {
      expect(() => calculateDuration('09:00', '09:00')).toThrow(
        'End time must be after start time'
      )
    })

    it('should round duration to two decimals', () => {
      const duration = calculateDuration('09:00', '10:20')
      expect(duration).toBe(1.33)
    })
  })

  describe('calculateEarnings', () => {
    it('should calculate earnings correctly', () => {
      const earnings = calculateEarnings(3, 25)
      expect(earnings).toBe(75)
    })

    it('should handle decimal rates', () => {
      const earnings = calculateEarnings(2.5, 20.5)
      expect(earnings).toBeCloseTo(51.25, 2)
    })

    it('should throw error for zero duration', () => {
      expect(() => calculateEarnings(0, 25)).toThrow('Duration and rate must be positive')
    })

    it('should throw error for zero rate', () => {
      expect(() => calculateEarnings(3, 0)).toThrow('Duration and rate must be positive')
    })
  })

  describe('addTimeEntry', () => {
    it('should throw error for missing familyId', async () => {
      await expect(
        addTimeEntry('userId123', {
          date: '2024-06-30',
          startTime: '09:00',
          endTime: '12:00',
          numChildren: 2,
          rate: 35,
        })
      ).rejects.toThrow('Family ID is required')
    })

    it('should throw error for missing date', async () => {
      await expect(
        addTimeEntry('userId123', {
          familyId: 'fam123',
          startTime: '09:00',
          endTime: '12:00',
          numChildren: 2,
          rate: 35,
        })
      ).rejects.toThrow('Date is required')
    })

    it('should throw error for invalid numChildren', async () => {
      await expect(
        addTimeEntry('userId123', {
          familyId: 'fam123',
          date: '2024-06-30',
          startTime: '09:00',
          endTime: '12:00',
          numChildren: 0,
          rate: 35,
        })
      ).rejects.toThrow('Number of children must be at least 1')
    })

    it('should throw error for negative rate', async () => {
      await expect(
        addTimeEntry('userId123', {
          familyId: 'fam123',
          date: '2024-06-30',
          startTime: '09:00',
          endTime: '12:00',
          numChildren: 2,
          rate: -10,
        })
      ).rejects.toThrow('Rate must be a positive number')
    })

    it('should add time entry with valid data', async () => {
      firestore.collection.mockReturnValue({})
      firestore.addDoc.mockResolvedValue({ id: 'entry123' })

      const entryId = await addTimeEntry('userId123', {
        familyId: 'fam123',
        date: '2024-06-30',
        startTime: '09:00',
        endTime: '12:00',
        numChildren: 2,
        rate: 35,
        notes: 'Afternoon care',
      })

      expect(entryId).toBe('entry123')
      expect(firestore.addDoc).toHaveBeenCalled()

      // Check that the call includes calculated fields
      const callArgs = firestore.addDoc.mock.calls[0][1]
      expect(callArgs.duration).toBe(3)
      expect(callArgs.totalEarned).toBe(105)
    })
  })

  describe('getTimeEntries', () => {
    it('should retrieve time entries for date range', async () => {
      firestore.collection.mockReturnValue({})
      firestore.query.mockReturnValue({})
      firestore.getDocs.mockResolvedValue({
        docs: [
          {
            id: 'entry1',
            data: () => ({
              date: '2024-06-30',
              duration: 3,
              totalEarned: 75,
            }),
          },
        ],
      })

      const entries = await getTimeEntries('userId123', '2024-06-01', '2024-06-30')

      expect(entries).toHaveLength(1)
      expect(entries[0].id).toBe('entry1')
      expect(firestore.getDocs).toHaveBeenCalled()
    })
  })

  describe('getRecentTimeEntries', () => {
    it('should retrieve the most recent entries', async () => {
      firestore.collection.mockReturnValue({})
      firestore.query.mockReturnValue({})
      firestore.getDocs.mockResolvedValue({
        docs: [
          {
            id: 'entryA',
            data: () => ({
              date: '2024-06-30',
              totalEarned: 120,
            }),
          },
          {
            id: 'entryB',
            data: () => ({
              date: '2024-06-29',
              totalEarned: 80,
            }),
          },
        ],
      })

      const entries = await getRecentTimeEntries('userId123', 10)

      expect(entries).toHaveLength(2)
      expect(entries[0].id).toBe('entryA')
      expect(firestore.getDocs).toHaveBeenCalled()
    })
  })

  describe('getTimeEntriesByFamily', () => {
    it('should throw error for missing familyId', async () => {
      await expect(
        getTimeEntriesByFamily('userId123', '', '2024-06-01', '2024-06-30')
      ).rejects.toThrow('Family ID is required')
    })

    it('should return only entries for the requested family', async () => {
      firestore.collection.mockReturnValue({})
      firestore.query.mockReturnValue({})
      firestore.getDocs.mockResolvedValue({
        docs: [
          {
            id: 'entry1',
            data: () => ({
              familyId: 'fam1',
              date: '2024-06-30',
              duration: 3,
              totalEarned: 75,
            }),
          },
          {
            id: 'entry2',
            data: () => ({
              familyId: 'fam2',
              date: '2024-06-29',
              duration: 2,
              totalEarned: 60,
            }),
          },
        ],
      })

      const entries = await getTimeEntriesByFamily(
        'userId123',
        'fam1',
        '2024-06-01',
        '2024-06-30'
      )

      expect(entries).toHaveLength(1)
      expect(entries[0].familyId).toBe('fam1')
    })
  })

  describe('updateTimeEntry', () => {
    it('should throw error for invalid times', async () => {
      await expect(
        updateTimeEntry('userId123', 'entry123', {
          startTime: '14:00',
          endTime: '10:00',
        })
      ).rejects.toThrow('End time must be after start time')
    })

    it('should throw error for negative rate', async () => {
      await expect(
        updateTimeEntry('userId123', 'entry123', {
          rate: -5,
        })
      ).rejects.toThrow('Rate must be positive')
    })

    it('should require both start and end time when updating time', async () => {
      await expect(
        updateTimeEntry('userId123', 'entry123', {
          startTime: '09:00',
          rate: 30,
        })
      ).rejects.toThrow('Both start and end time are required when updating time')
    })

    it('should require rate when updating time fields', async () => {
      await expect(
        updateTimeEntry('userId123', 'entry123', {
          startTime: '09:00',
          endTime: '11:00',
        })
      ).rejects.toThrow('Rate is required when updating time')
    })

    it('should update time entry', async () => {
      firestore.doc.mockReturnValue({})
      firestore.updateDoc.mockResolvedValue()

      await updateTimeEntry('userId123', 'entry123', {
        rate: 40,
        notes: 'Updated',
      })

      expect(firestore.updateDoc).toHaveBeenCalled()
    })

    it('should update full entry and recalculate totals', async () => {
      firestore.doc.mockReturnValue({})
      firestore.updateDoc.mockResolvedValue()

      await updateTimeEntry('userId123', 'entry123', {
        familyId: 'fam456',
        date: '2024-07-01',
        startTime: '10:00',
        endTime: '13:30',
        numChildren: 3,
        rate: 40,
        notes: 'Updated shift',
      })

      expect(firestore.updateDoc).toHaveBeenCalled()
      const updatePayload = firestore.updateDoc.mock.calls[0][1]
      expect(updatePayload.familyId).toBe('fam456')
      expect(updatePayload.date).toBe('2024-07-01')
      expect(updatePayload.duration).toBe(3.5)
      expect(updatePayload.totalEarned).toBe(140)
      expect(updatePayload.numChildren).toBe(3)
      expect(updatePayload.rate).toBe(40)
      expect(updatePayload.notes).toBe('Updated shift')
    })
  })

  describe('deleteTimeEntry', () => {
    it('should delete time entry', async () => {
      firestore.doc.mockReturnValue({})
      firestore.deleteDoc.mockResolvedValue()

      await deleteTimeEntry('userId123', 'entry123')

      expect(firestore.deleteDoc).toHaveBeenCalled()
    })
  })
})
