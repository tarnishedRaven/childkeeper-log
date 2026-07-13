import { fromCents } from '../utils/money'

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
