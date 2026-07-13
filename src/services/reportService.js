import { fromCents, roundToCents } from '../utils/money'
import { getAttendanceByDateRange } from './attendanceService'
import { getGlobalRates } from './rateConfigService'
import { getChildren } from './childService'
import { runPayroll } from '../utils/payrollEngine'

/**
 * Group time entries by family
 * @param {Array} entries - Array of time entry objects
 * @returns {Object} Grouped entries by familyId
 */
export function groupByFamily(entries) {
  return entries.reduce((acc, entry) => {
    if (!acc[entry.familyId]) {
      acc[entry.familyId] = [];
    }
    acc[entry.familyId].push(entry);
    return acc;
  }, {});
}

/**
 * Group entries by date
 * @param {Array} entries - Array of time entry objects
 * @returns {Object} Grouped entries by date (YYYY-MM-DD)
 */
export function groupByDate(entries) {
  return entries.reduce((acc, entry) => {
    if (!acc[entry.date]) {
      acc[entry.date] = [];
    }
    acc[entry.date].push(entry);
    return acc;
  }, {});
}

/**
 * Calculate totals for entries
 * @param {Array} entries - Array of time entry objects
 * @returns {Object} { totalHours, totalEarned }
 */
export function calculateTotals(entries) {
  if (!entries || entries.length === 0) {
    return { totalHours: 0, totalEarned: 0 };
  }

  const totals = entries.reduce(
    (acc, entry) => ({
      totalHours: acc.totalHours + (entry.duration || 0),
      totalEarned: acc.totalEarned + (entry.totalEarned || 0),
    }),
    { totalHours: 0, totalEarned: 0 },
  );

  return {
    totalHours: Math.round(totals.totalHours * 100) / 100,
    totalEarned: Math.round(totals.totalEarned * 100) / 100,
  };
}

/**
 * Generate summary report grouped by family
 * @param {Array} entries - Array of time entry objects
 * @param {Array} familiesData - Array of family objects with id, name
 * @returns {Object} Report summary
 */
export function generateMonthlySummary(entries, familiesData = []) {
  if (!entries || entries.length === 0) {
    return {
      byFamily: [],
      grandTotals: { totalHours: 0, totalEarned: 0 },
    };
  }

  const grouped = groupByFamily(entries);
  const familyMap = familiesData.reduce((acc, fam) => {
    acc[fam.id] = fam.name;
    return acc;
  }, {});

  const byFamily = Object.entries(grouped).map(([familyId, familyEntries]) => {
    const groupedByDate = groupByDate(familyEntries);
    const byDate = Object.entries(groupedByDate)
      .map(([date, dateEntries]) => ({
        date,
        entries: dateEntries,
        ...calculateTotals(dateEntries),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return {
      familyId,
      familyName: familyMap[familyId] || "Unknown Family",
      entries: familyEntries,
      byDate,
      ...calculateTotals(familyEntries),
    };
  });

  const grandTotals = calculateTotals(entries);

  return {
    byFamily,
    grandTotals,
  };
}

export function generateSummaryFromPayroll(runOutput, familiesData = []) {
  if (!runOutput) {
    return {
      byFamily: [],
      grandTotals: { totalHours: 0, totalEarned: 0 },
      flags: [],
    }
  }

  const familyMap = familiesData.reduce((acc, family) => {
    acc[family.id] = family.name
    return acc
  }, {})

  const byFamily = Object.entries(runOutput.byFamily || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([familyId, data]) => ({
      familyId,
      familyName: familyMap[familyId] || 'Unknown Family',
      totalHours: data.hours || 0,
      segmentTotal: fromCents(data.segmentTotalCents || 0),
      lunchFees: fromCents(data.lunchFeeCents || 0),
      totalEarned: fromCents(data.finalTotalCents || 0),
    }))

  return {
    byFamily,
    grandTotals: {
      totalHours: runOutput.totals?.grandHours || 0,
      totalEarned: fromCents(runOutput.totals?.grandTotalCents || 0),
    },
    flags: runOutput.flags || [],
  }
}

export function buildDailyBreakdownRows(attendance, payrollLedger, children = []) {
  const childMap = children.reduce((acc, child) => {
    acc[child.id] = child
    return acc
  }, {})

  const ledgerByDate = (payrollLedger || []).reduce((acc, row) => {
    if (!acc[row.date]) {
      acc[row.date] = []
    }
    acc[row.date].push(row)
    return acc
  }, {})

  return (attendance || [])
    .map((entry) => {
      const child = childMap[entry.childId]
      const dayRows = ledgerByDate[entry.date] || []
      const charge = dayRows.reduce((sum, row) => {
        if (!row.activeChildIds?.includes(entry.childId)) {
          return sum
        }

        const familyTotalsBySegment = row.familySegmentTotals || row.familyFinalTotals || {}
        const familyIds = Object.keys(familyTotalsBySegment)
        if (familyIds.length === 0) {
          return sum
        }

        const familyId = entry.familyId
        const familyTotal = familyTotalsBySegment[familyId] || 0
        const familyChildren = row.activeChildIds.filter(
          (childId) => childMap[childId]?.familyId === familyId
        )
        if (familyChildren.length === 0) {
          return sum
        }

        return sum + familyTotal / familyChildren.length
      }, 0)

      return {
        id: entry.id,
        familyId: entry.familyId,
        childId: entry.childId,
        childName: child?.displayName || child?.firstName || 'Unknown Child',
        date: entry.date,
        startTime: entry.startTime,
        endTime: entry.endTime,
        lunchBrought: Boolean(entry.lunchBrought),
        amount: fromCents(Math.round(charge)),
      }
    })
    .sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date)
      }
      if (a.startTime !== b.startTime) {
        return a.startTime.localeCompare(b.startTime)
      }
      return a.childName.localeCompare(b.childName)
    })
}

/**
 * Format number as currency (USD)
 * @param {number} value - Value to format
 * @returns {string} Formatted currency string
 */
export function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

/**
 * Format hours to HH:MM format
 * @param {number} hours - Hours as decimal
 * @returns {string} Formatted time string
 */
export function formatHours(hours) {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  return `${wholeHours}:${minutes.toString().padStart(2, "0")}`;
}

function normalizeTimestamps(attendance) {
  return attendance.map((entry) => ({
    ...entry,
    startAt: entry.startAt?.toDate?.() || new Date(`${entry.date}T${entry.startTime}:00`),
    endAt: entry.endAt?.toDate?.() || new Date(`${entry.date}T${entry.endTime}:00`),
  }))
}

function isoToLocalHHMM(isoString) {
  const d = new Date(isoString)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function buildGeneralInvoiceChildSummaries(segmentLedger = [], childrenById = {}, familyId, childTotals = {}) {
  const childSummaries = Object.entries(childTotals)
    .filter(([childId, totalCents]) => childrenById[childId]?.familyId === familyId && totalCents > 0)
    .reduce((acc, [childId, totalCents]) => {
      const child = childrenById[childId]
      acc[childId] = {
        childId,
        childName: child?.displayName || child?.firstName || 'Unknown Child',
        hours: 0,
        amount: fromCents(totalCents),
      }
      return acc
    }, {})

  for (const row of segmentLedger) {
    const familySegmentTotal = row.familySegmentTotals?.[familyId]
    if (familySegmentTotal == null) {
      continue
    }

    const segmentHours = (new Date(row.segmentEnd) - new Date(row.segmentStart)) / (1000 * 60 * 60)
    for (const childId of row.activeChildIds || []) {
      if (childrenById[childId]?.familyId !== familyId) {
        continue
      }

      if (!childSummaries[childId]) {
        const child = childrenById[childId]
        childSummaries[childId] = {
          childId,
          childName: child?.displayName || child?.firstName || 'Unknown Child',
          hours: 0,
          amount: 0,
        }
      }

      childSummaries[childId].hours += segmentHours
    }
  }

  return Object.values(childSummaries)
    .map((child) => ({
      ...child,
      hours: Math.round(child.hours * 100) / 100,
    }))
    .sort((a, b) => a.childName.localeCompare(b.childName))
}

export async function getGeneralInvoice(userId, familyId, startDate, endDate) {
  // Run payroll over ALL attendance so tier rates correctly reflect concurrent children
  // across all families, then extract the requested family's share.
  const [attendance, rates, children] = await Promise.all([
    getAttendanceByDateRange(userId, startDate, endDate),
    getGlobalRates(userId),
    getChildren(userId, { activeOnly: true }),
  ])

  const childrenById = Object.fromEntries(children.map((c) => [c.id, c]))
  const payroll = runPayroll(normalizeTimestamps(attendance), childrenById, rates)
  const data = payroll.byFamily[familyId]

  if (!data) {
    return { hours: 0, segmentTotal: 0, lunchFees: 0, grandTotal: 0, children: [], flags: payroll.flags }
  }

  return {
    hours: data.hours,
    segmentTotal: fromCents(data.segmentTotalCents),
    lunchFees: fromCents(data.lunchFeeCents),
    grandTotal: fromCents(data.finalTotalCents),
    children: buildGeneralInvoiceChildSummaries(payroll.segmentLedger, childrenById, familyId, payroll.childTotals),
    flags: payroll.flags,
  }
}

export async function getItemizedInvoice(userId, familyId, startDate, endDate) {
  // Run payroll over ALL attendance so tier rates correctly reflect concurrent children
  // across all families, then extract the requested family's share.
  const [attendance, rates, children] = await Promise.all([
    getAttendanceByDateRange(userId, startDate, endDate),
    getGlobalRates(userId),
    getChildren(userId, { activeOnly: true }),
  ])

  const childrenById = Object.fromEntries(children.map((c) => [c.id, c]))
  const payroll = runPayroll(normalizeTimestamps(attendance), childrenById, rates)

  const segmentRows = payroll.segmentLedger
    .filter((row) => row.familySegmentTotals[familyId] != null)
    .map((row) => {
      const hours = (new Date(row.segmentEnd) - new Date(row.segmentStart)) / (1000 * 60 * 60)
      return {
        type: 'segment',
        date: row.date,
        startTime: isoToLocalHHMM(row.segmentStart),
        endTime: isoToLocalHHMM(row.segmentEnd),
        childNames: row.activeChildIds
          .filter((id) => childrenById[id]?.familyId === familyId)
          .map((id) => childrenById[id]?.displayName || childrenById[id]?.firstName || id),
        childCount: row.activeChildIds.length,
        ratePerHour: row.effectiveHourly,
        familyShare: fromCents(row.familySegmentTotals[familyId]),
        hours,
      }
    })

  // Lunch fees: only charge for this family's attendance records
  const lunchFeeCents = roundToCents(rates.lunchFeePerChild)
  const chargedLunch = new Set()
  const lunchRows = []
  const familyAttendance = attendance.filter((e) => e.familyId === familyId)
  const sortedAttendance = [...familyAttendance].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    if (a.childId !== b.childId) return String(a.childId).localeCompare(String(b.childId))
    return (a.startTime || '').localeCompare(b.startTime || '')
  })

  for (const entry of sortedAttendance) {
    const key = `${entry.childId}::${entry.date}`
    if (!entry.lunchBrought && !chargedLunch.has(key)) {
      chargedLunch.add(key)
      const child = childrenById[entry.childId]
      lunchRows.push({
        type: 'lunch',
        date: entry.date,
        childName: child?.displayName || child?.firstName || 'Unknown Child',
        fee: fromCents(lunchFeeCents),
      })
    }
  }

  const lineItems = [...segmentRows, ...lunchRows].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    if (a.type !== b.type) return a.type === 'segment' ? -1 : 1
    if (a.type === 'segment') return (a.startTime || '').localeCompare(b.startTime || '')
    return (a.childName || '').localeCompare(b.childName || '')
  })

  const grandTotal = Math.round(
    lineItems.reduce((sum, row) => sum + (row.type === 'segment' ? row.familyShare : row.fee), 0) * 100
  ) / 100

  return { lineItems, grandTotal, flags: payroll.flags }
}
