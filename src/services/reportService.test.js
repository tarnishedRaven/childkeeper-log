import { describe, it, expect } from 'vitest'
import {
  groupByFamily,
  groupByDate,
  calculateTotals,
  generateMonthlySummary,
  formatCurrency,
  formatHours,
} from './reportService'

describe('Report Service', () => {
  const mockEntries = [
    {
      id: 'entry1',
      familyId: 'fam1',
      date: '2024-06-01',
      duration: 3,
      totalEarned: 75,
    },
    {
      id: 'entry2',
      familyId: 'fam1',
      date: '2024-06-05',
      duration: 4,
      totalEarned: 100,
    },
    {
      id: 'entry3',
      familyId: 'fam2',
      date: '2024-06-10',
      duration: 2,
      totalEarned: 70,
    },
  ]

  const mockFamilies = [
    { id: 'fam1', name: 'Smith Family' },
    { id: 'fam2', name: 'Jones Family' },
  ]

  describe('groupByFamily', () => {
    it('should group entries by familyId', () => {
      const grouped = groupByFamily(mockEntries)

      expect(grouped.fam1).toHaveLength(2)
      expect(grouped.fam2).toHaveLength(1)
    })

    it('should return empty object for empty entries', () => {
      const grouped = groupByFamily([])
      expect(grouped).toEqual({})
    })
  })

  describe('groupByDate', () => {
    it('should group entries by date', () => {
      const grouped = groupByDate(mockEntries)

      expect(grouped['2024-06-01']).toHaveLength(1)
      expect(grouped['2024-06-05']).toHaveLength(1)
      expect(grouped['2024-06-10']).toHaveLength(1)
    })

    it('should return empty object for empty entries', () => {
      const grouped = groupByDate([])
      expect(grouped).toEqual({})
    })
  })

  describe('calculateTotals', () => {
    it('should calculate totals correctly', () => {
      const totals = calculateTotals(mockEntries)

      expect(totals.totalHours).toBe(9)
      expect(totals.totalEarned).toBe(245)
    })

    it('should return zeros for empty entries', () => {
      const totals = calculateTotals([])

      expect(totals.totalHours).toBe(0)
      expect(totals.totalEarned).toBe(0)
    })

    it('should return zeros for null entries', () => {
      const totals = calculateTotals(null)

      expect(totals.totalHours).toBe(0)
      expect(totals.totalEarned).toBe(0)
    })
  })

  describe('generateMonthlySummary', () => {
    it('should generate summary grouped by family', () => {
      const summary = generateMonthlySummary(mockEntries, mockFamilies)

      expect(summary.byFamily).toHaveLength(2)
      expect(summary.byFamily[0].familyName).toBeDefined()
      expect(summary.byFamily[0].byDate).toBeDefined()
      expect(summary.grandTotals.totalHours).toBe(9)
      expect(summary.grandTotals.totalEarned).toBe(245)
    })

    it('should include daily totals within each family summary', () => {
      const summary = generateMonthlySummary(mockEntries, mockFamilies)
      const fam1 = summary.byFamily.find((f) => f.familyId === 'fam1')

      expect(fam1.byDate).toHaveLength(2)
      expect(fam1.byDate[0].date).toBe('2024-06-05')
      expect(fam1.byDate[0].totalHours).toBe(4)
      expect(fam1.byDate[0].totalEarned).toBe(100)
      expect(fam1.byDate[1].date).toBe('2024-06-01')
      expect(fam1.byDate[1].totalHours).toBe(3)
      expect(fam1.byDate[1].totalEarned).toBe(75)
    })

    it('should handle unknown families', () => {
      const summary = generateMonthlySummary(mockEntries, [])

      expect(summary.byFamily[0].familyName).toBe('Unknown Family')
    })

    it('should return empty summary for no entries', () => {
      const summary = generateMonthlySummary([])

      expect(summary.byFamily).toEqual([])
      expect(summary.grandTotals.totalHours).toBe(0)
      expect(summary.grandTotals.totalEarned).toBe(0)
    })
  })

  describe('formatCurrency', () => {
    it('should format value as USD currency', () => {
      const formatted = formatCurrency(245.5)

      expect(formatted).toContain('$')
      expect(formatted).toContain('245')
    })

    it('should handle zero', () => {
      const formatted = formatCurrency(0)
      expect(formatted).toContain('$')
    })
  })

  describe('formatHours', () => {
    it('should format whole hours', () => {
      expect(formatHours(3)).toBe('3:00')
    })

    it('should format hours with minutes', () => {
      expect(formatHours(3.25)).toBe('3:15')
      expect(formatHours(3.5)).toBe('3:30')
    })

    it('should handle rounding', () => {
      expect(formatHours(3.25)).toBe('3:15')
    })
  })
})
