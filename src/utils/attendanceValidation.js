import { parseLocalDateTime } from './timeIntervals'

function normalizeDate(value) {
  const date = String(value || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Date must use YYYY-MM-DD format')
  }
  return date
}

function normalizeTime(value, fieldName) {
  const time = String(value || '')
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new Error(`${fieldName} must use HH:MM format`)
  }
  return time
}

export function validateAttendanceRecord(record) {
  if (!record || typeof record !== 'object') {
    throw new Error('Attendance record is required')
  }

  const childId = String(record.childId || '').trim()
  const familyId = String(record.familyId || '').trim()
  const date = normalizeDate(record.date)
  const startTime = normalizeTime(record.startTime, 'Start time')
  const endTime = normalizeTime(record.endTime, 'End time')

  if (!childId) {
    throw new Error('Child is required')
  }

  if (!familyId) {
    throw new Error('Family is required')
  }

  const startAt = parseLocalDateTime(date, startTime)
  const endAt = parseLocalDateTime(date, endTime)

  if (endAt.getTime() <= startAt.getTime()) {
    throw new Error('End time must be after start time')
  }

  return {
    childId,
    familyId,
    date,
    startTime,
    endTime,
    lunchBrought: Boolean(record.lunchBrought),
    notes: String(record.notes || '').trim(),
    startAt,
    endAt,
  }
}

export function detectSameChildOverlaps(records) {
  const issues = []

  const grouped = records.reduce((acc, record) => {
    const key = `${record.childId}::${record.date}`
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(record)
    return acc
  }, {})

  Object.entries(grouped).forEach(([key, list]) => {
    const sorted = [...list].sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
    for (let index = 1; index < sorted.length; index += 1) {
      const prev = sorted[index - 1]
      const current = sorted[index]
      if (current.startAt < prev.endAt) {
        issues.push({
          key,
          previousId: prev.id,
          currentId: current.id,
          message: 'Overlapping attendance for the same child and date',
        })
      }
    }
  })

  return issues
}
