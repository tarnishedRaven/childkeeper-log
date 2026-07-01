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
