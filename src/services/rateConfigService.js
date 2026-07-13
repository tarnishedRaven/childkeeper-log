import { deleteField, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import {
  COLLECTIONS,
  DEFAULT_CURRENCY,
  DEFAULT_GLOBAL_RATES,
  SCHEMA_VERSION,
} from '../constants/schemaV2'
import { normalizeTierMap } from '../utils/rateSelection'

export function validateGlobalRates(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Global rates config is required')
  }

  const minNannyHourlyRate = Number(config.minNannyHourlyRate)
  const maxNannyHourlyRate = Number(config.maxNannyHourlyRate)
  const lunchFeePerChild = Number(config.lunchFeePerChild)

  if (!Number.isFinite(minNannyHourlyRate) || minNannyHourlyRate <= 0) {
    throw new Error('Minimum nanny hourly rate must be positive')
  }

  if (!Number.isFinite(maxNannyHourlyRate) || maxNannyHourlyRate <= 0) {
    throw new Error('Maximum nanny hourly rate must be positive')
  }

  if (minNannyHourlyRate > maxNannyHourlyRate) {
    throw new Error('Minimum nanny hourly rate cannot exceed maximum nanny hourly rate')
  }

  if (!Number.isFinite(lunchFeePerChild) || lunchFeePerChild < 0) {
    throw new Error('Lunch fee per child must be non-negative')
  }

  const tiers = normalizeTierMap(config.hourlyRateByChildCount)
  Object.values(tiers).forEach((value) => {
    if (value > maxNannyHourlyRate) {
      throw new Error('Tier rates cannot exceed maximum nanny hourly rate')
    }
  })

  return {
    minNannyHourlyRate,
    maxNannyHourlyRate,
    lunchFeePerChild,
    hourlyRateByChildCount: Object.keys(tiers)
      .sort((a, b) => Number(a) - Number(b))
      .reduce((acc, key) => {
        acc[String(key)] = tiers[key]
        return acc
      }, {}),
    currency: config.currency || DEFAULT_CURRENCY,
    timezone: config.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    schemaVersion: SCHEMA_VERSION,
  }
}

export async function getGlobalRates(userId) {
  const ratesRef = doc(
    db,
    COLLECTIONS.USERS,
    userId,
    COLLECTIONS.BILLING_CONFIG,
    COLLECTIONS.GLOBAL_RATES_DOC
  )
  const snapshot = await getDoc(ratesRef)

  if (!snapshot.exists()) {
    return {
      ...DEFAULT_GLOBAL_RATES,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      schemaVersion: SCHEMA_VERSION,
    }
  }

  return snapshot.data()
}

export async function updateGlobalRates(userId, config) {
  const ratesRef = doc(
    db,
    COLLECTIONS.USERS,
    userId,
    COLLECTIONS.BILLING_CONFIG,
    COLLECTIONS.GLOBAL_RATES_DOC
  )

  const normalized = validateGlobalRates(config)

  await setDoc(
    ratesRef,
    {
      ...normalized,
      minFamilyHourlyRate: deleteField(),
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  )
}
