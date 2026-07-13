import { describe, it, expect, vi, beforeEach } from 'vitest'
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

vi.mock('./attendanceService', () => ({
  addAttendance: vi.fn(),
  addAttendanceBatch: vi.fn(),
  deleteAttendance: vi.fn(),
  getAttendanceByDateRange: vi.fn(),
  getAttendanceByFamilyDateRange: vi.fn(),
  getRecentAttendance: vi.fn(),
  updateAttendance: vi.fn(),
}))

import * as attendanceService from './attendanceService'

describe('timeEntryService wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('calculateDuration', () => {
    it('calculates duration', () => {
      expect(calculateDuration('09:00', '12:00')).toBe(3)
    })

    it('throws for invalid format', () => {
      expect(() => calculateDuration('bad', '12:00')).toThrow('Invalid time format (use HH:MM)')
    })

    it('throws when end before start', () => {
      expect(() => calculateDuration('12:00', '09:00')).toThrow('End time must be after start time')
    })
  })

  describe('calculateEarnings', () => {
    it('calculates earnings', () => {
      expect(calculateEarnings(2.5, 20)).toBe(50)
    })

    it('throws for invalid values', () => {
      expect(() => calculateEarnings(0, 20)).toThrow('Duration and rate must be positive')
    })
  })

  it('validates and adds time entry', async () => {
    attendanceService.addAttendance.mockResolvedValue('a1')

    const id = await addTimeEntry('u1', {
      familyId: 'f1',
      childId: 'c1',
      date: '2026-07-10',
      startTime: '09:00',
      endTime: '11:00',
      numChildren: 1,
      rate: 25,
    })

    expect(id).toBe('a1')
    expect(attendanceService.addAttendance).toHaveBeenCalled()
  })

  it('requires numChildren >= 1', async () => {
    await expect(
      addTimeEntry('u1', {
        familyId: 'f1',
        childId: 'c1',
        date: '2026-07-10',
        startTime: '09:00',
        endTime: '11:00',
        numChildren: 0,
        rate: 25,
      })
    ).rejects.toThrow('Number of children must be at least 1')
  })

  it('maps attendance rows to legacy shape for getTimeEntries', async () => {
    attendanceService.getAttendanceByDateRange.mockResolvedValue([
      {
        id: 'a1',
        familyId: 'f1',
        childId: 'c1',
        date: '2026-07-10',
        startTime: '09:00',
        endTime: '11:30',
        rate: 20,
        lunchBrought: true,
      },
    ])

    const rows = await getTimeEntries('u1', '2026-07-01', '2026-07-31')
    expect(rows).toHaveLength(1)
    expect(rows[0].duration).toBe(2.5)
    expect(rows[0].totalEarned).toBe(50)
    expect(rows[0].hadLunch).toBe(true)
  })

  it('gets recent entries', async () => {
    attendanceService.getRecentAttendance.mockResolvedValue([
      {
        id: 'a1',
        familyId: 'f1',
        childId: 'c1',
        date: '2026-07-10',
        startTime: '09:00',
        endTime: '10:00',
        rate: 20,
      },
    ])

    const rows = await getRecentTimeEntries('u1', 5)
    expect(rows).toHaveLength(1)
  })

  it('gets family entries', async () => {
    attendanceService.getAttendanceByFamilyDateRange.mockResolvedValue([
      {
        id: 'a1',
        familyId: 'f1',
        childId: 'c1',
        date: '2026-07-10',
        startTime: '09:00',
        endTime: '10:00',
        rate: 20,
      },
    ])

    const rows = await getTimeEntriesByFamily('u1', 'f1', '2026-07-01', '2026-07-31')
    expect(rows).toHaveLength(1)
  })

  it('validates update payload and calls updateAttendance', async () => {
    attendanceService.updateAttendance.mockResolvedValue()

    await updateTimeEntry('u1', 'a1', {
      familyId: 'f1',
      childId: 'c1',
      date: '2026-07-10',
      startTime: '09:00',
      endTime: '11:00',
      rate: 20,
    })

    expect(attendanceService.updateAttendance).toHaveBeenCalled()
  })

  it('throws when updating time with missing rate', async () => {
    await expect(
      updateTimeEntry('u1', 'a1', {
        startTime: '09:00',
        endTime: '10:00',
      })
    ).rejects.toThrow('Rate is required when updating time')
  })

  it('deletes entry', async () => {
    attendanceService.deleteAttendance.mockResolvedValue()
    await deleteTimeEntry('u1', 'a1')
    expect(attendanceService.deleteAttendance).toHaveBeenCalledWith('u1', 'a1')
  })
})
