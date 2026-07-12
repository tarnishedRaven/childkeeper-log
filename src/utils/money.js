export function roundToCents(value) {
  if (!Number.isFinite(value)) {
    throw new Error('Value must be a finite number')
  }

  return Math.round(value * 100)
}

export function toCents(value) {
  return roundToCents(value)
}

export function fromCents(cents) {
  if (!Number.isInteger(cents)) {
    throw new Error('Cents must be an integer')
  }

  return cents / 100
}

export function splitCentsEvenly(totalCents, keys) {
  if (!Number.isInteger(totalCents)) {
    throw new Error('Total cents must be an integer')
  }

  if (!Array.isArray(keys) || keys.length === 0) {
    return {}
  }

  const sortedKeys = [...keys].sort((a, b) => String(a).localeCompare(String(b)))
  const base = Math.floor(totalCents / sortedKeys.length)
  let remainder = totalCents % sortedKeys.length

  return sortedKeys.reduce((acc, key) => {
    const extra = remainder > 0 ? 1 : 0
    if (remainder > 0) {
      remainder -= 1
    }

    acc[key] = base + extra
    return acc
  }, {})
}

export function distributeProportionallyWithStableRemainder(totalCents, weightsByKey) {
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw new Error('Total cents must be a non-negative integer')
  }

  const keys = Object.keys(weightsByKey || {}).sort((a, b) => a.localeCompare(b))
  if (keys.length === 0 || totalCents === 0) {
    return keys.reduce((acc, key) => {
      acc[key] = 0
      return acc
    }, {})
  }

  const totalWeight = keys.reduce((sum, key) => sum + Math.max(0, weightsByKey[key] || 0), 0)
  if (totalWeight === 0) {
    return keys.reduce((acc, key) => {
      acc[key] = 0
      return acc
    }, {})
  }

  const baseAllocation = {}
  let allocated = 0
  const remainders = []

  keys.forEach((key) => {
    const weight = Math.max(0, weightsByKey[key] || 0)
    const exact = (totalCents * weight) / totalWeight
    const floorValue = Math.floor(exact)
    baseAllocation[key] = floorValue
    allocated += floorValue
    remainders.push({ key, remainder: exact - floorValue })
  })

  let remaining = totalCents - allocated
  remainders
    .sort((a, b) => {
      if (b.remainder !== a.remainder) {
        return b.remainder - a.remainder
      }
      return a.key.localeCompare(b.key)
    })
    .forEach(({ key }) => {
      if (remaining <= 0) {
        return
      }
      baseAllocation[key] += 1
      remaining -= 1
    })

  return baseAllocation
}
