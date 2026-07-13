export const SCHEMA_VERSION = 2

export const COLLECTIONS = {
  USERS: 'users',
  FAMILIES: 'families',
  CHILDREN: 'children',
  ATTENDANCE: 'attendance',
  BILLING_CONFIG: 'billingConfig',
  GLOBAL_RATES_DOC: 'globalRates',
  PAYROLL_RUNS: 'payrollRuns',
  APP_META: 'appMeta',
  SCHEMA_DOC: 'schema',
}

export const ATTENDANCE_STATUS = {
  ACTIVE: 'active',
  CONFLICTED: 'conflicted',
}

export const ATTENDANCE_SOURCE = {
  MANUAL: 'manual',
}

export const PAYROLL_FLAG_TYPES = {
  INVALID_DATA_SKIPPED: 'INVALID_DATA_SKIPPED',
}

export const DEFAULT_CURRENCY = 'USD'

export const DEFAULT_GLOBAL_RATES = {
  minNannyHourlyRate: 16,
  maxNannyHourlyRate: 40,
  hourlyRateByChildCount: {
    '1': 16,
    '2': 16,
    '3': 20,
    '4': 25,
    '5': 30,
    '6': 35,
    '7': 40,
    '8': 40,
    '9': 40,
  },
  lunchFeePerChild: 3,
  currency: DEFAULT_CURRENCY,
}
