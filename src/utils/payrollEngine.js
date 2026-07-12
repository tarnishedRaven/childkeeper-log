import { PAYROLL_FLAG_TYPES } from '../constants/schemaV2'
import {
  roundToCents,
  splitCentsEvenly,
  distributeProportionallyWithStableRemainder,
} from './money'
import {
  buildTimeBoundaries,
  buildSegments,
  activeChildrenForSegment,
  hoursBetween,
} from './timeIntervals'
import { selectTierRate } from './rateSelection'
import { detectSameChildOverlaps } from './attendanceValidation'

function sumByFamily(childCentsByChildId, childrenById) {
  return Object.entries(childCentsByChildId).reduce((acc, [childId, cents]) => {
    const familyId = childrenById[childId]?.familyId
    if (!familyId) {
      return acc
    }
    acc[familyId] = (acc[familyId] || 0) + cents
    return acc
  }, {})
}

function splitFamilyTotalsToChildren(familyTotals, activeRecords) {
  const childTotals = {}

  const childrenByFamily = activeRecords.reduce((acc, record) => {
    if (!acc[record.familyId]) {
      acc[record.familyId] = []
    }
    acc[record.familyId].push(record.childId)
    return acc
  }, {})

  Object.entries(childrenByFamily).forEach(([familyId, childIds]) => {
    const uniqueChildIds = [...new Set(childIds)].sort((a, b) => String(a).localeCompare(String(b)))
    const split = splitCentsEvenly(familyTotals[familyId] || 0, uniqueChildIds)
    Object.entries(split).forEach(([childId, cents]) => {
      childTotals[childId] = (childTotals[childId] || 0) + cents
    })
  })

  return childTotals
}

function redistributeFamilyTotalsZeroSum(baseFamilyTotals, familyMinimumCents) {
  const familyIds = Object.keys(baseFamilyTotals).sort((a, b) => a.localeCompare(b))

  const deficits = familyIds.reduce((acc, familyId) => {
    acc[familyId] = Math.max(0, (familyMinimumCents[familyId] || 0) - (baseFamilyTotals[familyId] || 0))
    return acc
  }, {})

  const surpluses = familyIds.reduce((acc, familyId) => {
    acc[familyId] = Math.max(0, (baseFamilyTotals[familyId] || 0) - (familyMinimumCents[familyId] || 0))
    return acc
  }, {})

  const totalDeficit = Object.values(deficits).reduce((sum, cents) => sum + cents, 0)
  const totalSurplus = Object.values(surpluses).reduce((sum, cents) => sum + cents, 0)
  const transferableCents = Math.min(totalDeficit, totalSurplus)

  const giveByFamily = distributeProportionallyWithStableRemainder(transferableCents, deficits)
  const takeByFamily = distributeProportionallyWithStableRemainder(transferableCents, surpluses)

  const familyFinalTotals = familyIds.reduce((acc, familyId) => {
    acc[familyId] = (baseFamilyTotals[familyId] || 0) + (giveByFamily[familyId] || 0) - (takeByFamily[familyId] || 0)
    return acc
  }, {})

  return {
    familyFinalTotals,
    unmetCents: totalDeficit - transferableCents,
  }
}

export function runPayroll(attendanceList, childrenById, ratesConfig) {
  const validAttendance = (attendanceList || []).filter((entry) => entry.status !== 'deleted')
  const overlaps = detectSameChildOverlaps(validAttendance)

  const flags = overlaps.map((issue) => ({
    type: PAYROLL_FLAG_TYPES.INVALID_DATA_SKIPPED,
    message: issue.message,
    key: issue.key,
    previousId: issue.previousId,
    currentId: issue.currentId,
  }))

  if (overlaps.length > 0) {
    const blockedIds = new Set(overlaps.flatMap((issue) => [issue.previousId, issue.currentId]).filter(Boolean))
    for (const record of validAttendance) {
      if (blockedIds.has(record.id)) {
        record.skipForPayroll = true
      }
    }
  }

  const groupedByDate = validAttendance.reduce((acc, record) => {
    if (record.skipForPayroll) {
      return acc
    }

    if (!acc[record.date]) {
      acc[record.date] = []
    }
    acc[record.date].push(record)
    return acc
  }, {})

  const familyTotals = {}
  const childTotals = {}
  const segmentLedger = []

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => a.localeCompare(b))

  sortedDates.forEach((date) => {
    const dailyRecords = groupedByDate[date]
    const boundaries = buildTimeBoundaries(dailyRecords)
    const segments = buildSegments(boundaries)
    const chargedLunchChildIds = new Set()

    segments.forEach((segment) => {
      const active = activeChildrenForSegment(dailyRecords, segment)
      if (active.length === 0) {
        return
      }

      const uniqueChildIds = [...new Set(active.map((entry) => entry.childId))].sort((a, b) => String(a).localeCompare(String(b)))
      const segmentHours = hoursBetween(segment.start, segment.end)

      const tierRate = selectTierRate(ratesConfig.hourlyRateByChildCount, uniqueChildIds.length)
      const effectiveHourly = Math.min(
        Math.max(tierRate, ratesConfig.minNannyHourlyRate),
        ratesConfig.maxNannyHourlyRate
      )

      const segmentTotalCents = roundToCents(effectiveHourly * segmentHours)
      const baseChildSplit = splitCentsEvenly(segmentTotalCents, uniqueChildIds)
      const baseFamilyTotals = sumByFamily(baseChildSplit, childrenById)

      const familyIds = Object.keys(baseFamilyTotals).sort((a, b) => a.localeCompare(b))
      const familyMinimumCents = familyIds.reduce((acc, familyId) => {
        acc[familyId] = roundToCents(ratesConfig.minFamilyHourlyRate * segmentHours)
        return acc
      }, {})

      const { familyFinalTotals, unmetCents } = redistributeFamilyTotalsZeroSum(
        baseFamilyTotals,
        familyMinimumCents
      )

      if (unmetCents > 0) {
        flags.push({
          type: PAYROLL_FLAG_TYPES.UNMET_FAMILY_MINIMUM,
          date,
          segmentStart: segment.start.toISOString(),
          segmentEnd: segment.end.toISOString(),
          cents: unmetCents,
        })
      }

      const childFinalSplit = splitFamilyTotalsToChildren(familyFinalTotals, active)
      Object.entries(childFinalSplit).forEach(([childId, cents]) => {
        childTotals[childId] = (childTotals[childId] || 0) + cents

        const familyId = childrenById[childId]?.familyId
        if (familyId) {
          familyTotals[familyId] = (familyTotals[familyId] || 0) + cents
        }
      })

      segmentLedger.push({
        date,
        segmentStart: segment.start.toISOString(),
        segmentEnd: segment.end.toISOString(),
        activeChildIds: uniqueChildIds,
        effectiveHourly,
        segmentTotalCents,
        familyFinalTotals,
      })
    })

    dailyRecords
      .slice()
      .sort((a, b) => {
        if (a.childId !== b.childId) {
          return String(a.childId).localeCompare(String(b.childId))
        }
        return a.startAt.getTime() - b.startAt.getTime()
      })
      .forEach((record) => {
        if (record.lunchBrought || chargedLunchChildIds.has(record.childId)) {
          return
        }

        const feeCents = roundToCents(ratesConfig.lunchFeePerChild)
        chargedLunchChildIds.add(record.childId)

        childTotals[record.childId] = (childTotals[record.childId] || 0) + feeCents
        familyTotals[record.familyId] = (familyTotals[record.familyId] || 0) + feeCents
      })
  })

  const byFamily = Object.keys(familyTotals)
    .sort((a, b) => a.localeCompare(b))
    .reduce((acc, familyId) => {
      const familyHours = segmentLedger
        .reduce((sum, row) => {
          const cents = row.familyFinalTotals[familyId] || 0
          if (cents === 0) {
            return sum
          }
          const segmentHours = hoursBetween(new Date(row.segmentStart), new Date(row.segmentEnd))
          return sum + segmentHours
        }, 0)

      const lunchFeeCents = validAttendance
        .filter((entry) => entry.familyId === familyId && entry.lunchBrought === false)
        .reduce((sum, entry, index, array) => {
          const firstForChildDate = array.findIndex(
            (candidate) => candidate.childId === entry.childId && candidate.date === entry.date
          )
          if (firstForChildDate !== index) {
            return sum
          }
          return sum + roundToCents(ratesConfig.lunchFeePerChild)
        }, 0)

      acc[familyId] = {
        hours: Math.round(familyHours * 100) / 100,
        segmentTotalCents: Math.max(0, familyTotals[familyId] - lunchFeeCents),
        lunchFeeCents,
        finalTotalCents: familyTotals[familyId],
      }
      return acc
    }, {})

  const grandTotalCents = Object.values(familyTotals).reduce((sum, cents) => sum + cents, 0)
  const grandHours = Math.round(
    segmentLedger.reduce((sum, row) => sum + hoursBetween(new Date(row.segmentStart), new Date(row.segmentEnd)), 0) * 100
  ) / 100

  return {
    totals: {
      grandTotalCents,
      grandHours,
    },
    byFamily,
    childTotals,
    familyTotals,
    segmentLedger,
    flags,
  }
}
