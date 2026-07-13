import { describe, it, expect } from 'vitest'
import { splitCentsEvenly } from './money'
import { selectTierRate } from './rateSelection'
import { runPayroll } from './payrollEngine'

describe('payroll utilities', () => {
  it('splitCentsEvenly distributes deterministic remainder by key order', () => {
    const result = splitCentsEvenly(10, ['child_b', 'child_a', 'child_c'])
    expect(result).toEqual({
      child_a: 4,
      child_b: 3,
      child_c: 3,
    })
  })

  it('selectTierRate falls back to highest configured tier for high child count', () => {
    const rate = selectTierRate({ 1: 16, 2: 16, 3: 20, 4: 25 }, 9)
    expect(rate).toBe(25)
  })

  it('runPayroll charges lunch once per child per date', () => {
    const attendance = [
      {
        id: 'a1',
        childId: 'child_1',
        familyId: 'fam_1',
        date: '2026-07-10',
        startTime: '09:00',
        endTime: '10:00',
        startAt: new Date('2026-07-10T09:00:00'),
        endAt: new Date('2026-07-10T10:00:00'),
        lunchBrought: false,
      },
      {
        id: 'a2',
        childId: 'child_1',
        familyId: 'fam_1',
        date: '2026-07-10',
        startTime: '10:00',
        endTime: '11:00',
        startAt: new Date('2026-07-10T10:00:00'),
        endAt: new Date('2026-07-10T11:00:00'),
        lunchBrought: false,
      },
    ]

    const childrenById = {
      child_1: { id: 'child_1', familyId: 'fam_1' },
    }

    const rates = {
      minNannyHourlyRate: 18,
      maxNannyHourlyRate: 40,
      hourlyRateByChildCount: { 1: 16, 2: 16, 3: 20 },
      lunchFeePerChild: 5,
    }

    const result = runPayroll(attendance, childrenById, rates)

    expect(result.byFamily.fam_1.lunchFeeCents).toBe(500)
    expect(result.totals.grandTotalCents).toBe(4100)
  })

  it('runPayroll keeps deterministic family totals without family minimum redistribution', () => {
    const attendance = [
      {
        id: 'a_tudor',
        childId: 'child_tudor',
        familyId: 'fam_tudor',
        date: '2026-07-10',
        startTime: '08:00',
        endTime: '14:00',
        startAt: new Date('2026-07-10T08:00:00'),
        endAt: new Date('2026-07-10T14:00:00'),
        lunchBrought: true,
      },
      {
        id: 'a_alex',
        childId: 'child_alex',
        familyId: 'fam_smith',
        date: '2026-07-10',
        startTime: '09:00',
        endTime: '12:00',
        startAt: new Date('2026-07-10T09:00:00'),
        endAt: new Date('2026-07-10T12:00:00'),
        lunchBrought: true,
      },
      {
        id: 'a_sarah',
        childId: 'child_sarah',
        familyId: 'fam_smith',
        date: '2026-07-10',
        startTime: '10:00',
        endTime: '16:00',
        startAt: new Date('2026-07-10T10:00:00'),
        endAt: new Date('2026-07-10T16:00:00'),
        lunchBrought: true,
      },
    ]

    const childrenById = {
      child_tudor: { id: 'child_tudor', familyId: 'fam_tudor' },
      child_alex: { id: 'child_alex', familyId: 'fam_smith' },
      child_sarah: { id: 'child_sarah', familyId: 'fam_smith' },
    }

    const rates = {
      minNannyHourlyRate: 16,
      maxNannyHourlyRate: 40,
      hourlyRateByChildCount: { 1: 16, 2: 16, 3: 20, 4: 25, 5: 30, 6: 35, 7: 40 },
      lunchFeePerChild: 0,
    }

    const result = runPayroll(attendance, childrenById, rates)

    expect(result.byFamily.fam_tudor.finalTotalCents).toBe(5333)
    expect(result.byFamily.fam_smith.finalTotalCents).toBe(8267)
    expect(result.totals.grandTotalCents).toBe(13600)
  })
})
