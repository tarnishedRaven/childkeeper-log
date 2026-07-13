export function normalizeTierMap(tiers) {
  if (!tiers || typeof tiers !== 'object') {
    throw new Error('Tier map is required')
  }

  const normalized = Object.entries(tiers).reduce((acc, [key, value]) => {
    const count = Number.parseInt(String(key), 10)
    if (!Number.isInteger(count) || count < 1) {
      throw new Error('Tier keys must be positive integers')
    }

    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('Tier values must be positive numbers')
    }

    acc[count] = value
    return acc
  }, {})

  const sortedKeys = Object.keys(normalized)
    .map(Number)
    .sort((a, b) => a - b)

  if (sortedKeys.length === 0) {
    throw new Error('At least one tier is required')
  }

  for (let idx = 1; idx <= sortedKeys[sortedKeys.length - 1]; idx += 1) {
    if (!Object.prototype.hasOwnProperty.call(normalized, idx)) {
      throw new Error('Tier map must be contiguous from 1 to highest key')
    }
  }

  return normalized
}

export function selectTierRate(hourlyRateByChildCount, childCount) {
  const normalized = normalizeTierMap(hourlyRateByChildCount)
  if (!Number.isInteger(childCount) || childCount < 1) {
    throw new Error('Child count must be a positive integer')
  }

  if (Object.prototype.hasOwnProperty.call(normalized, childCount)) {
    return normalized[childCount]
  }

  const highest = Math.max(...Object.keys(normalized).map(Number))
  if (childCount > highest) {
    return normalized[highest]
  }

  throw new Error('Missing tier for child count')
}
