function parseTimeToMinutes(time) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(time || ''))
  if (!match) {
    throw new Error('Time must use HH:MM format')
  }

  const hours = Number.parseInt(match[1], 10)
  const minutes = Number.parseInt(match[2], 10)
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error('Time must use HH:MM format')
  }

  return hours * 60 + minutes
}

export function parseLocalDateTime(date, time) {
  if (!date) {
    throw new Error('Date is required')
  }

  const parsed = new Date(`${date}T${time}:00`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid date or time')
  }

  return parsed
}

export function splitCrossMidnight(record) {
  const { date, startTime, endTime } = record
  const startMinutes = parseTimeToMinutes(startTime)
  const endMinutes = parseTimeToMinutes(endTime)

  if (endMinutes > startMinutes) {
    return [record]
  }

  const nextDate = new Date(`${date}T00:00:00`)
  nextDate.setDate(nextDate.getDate() + 1)
  const nextDateStr = nextDate.toISOString().slice(0, 10)

  return [
    {
      ...record,
      endTime: '24:00'.replace('24:00', '23:59'),
      isSplitPart: true,
      splitOriginDate: date,
    },
    {
      ...record,
      date: nextDateStr,
      startTime: '00:00',
      isSplitPart: true,
      splitOriginDate: date,
    },
  ]
}

export function buildTimeBoundaries(records) {
  const timestamps = []
  records.forEach((record) => {
    timestamps.push(record.startAt.getTime())
    timestamps.push(record.endAt.getTime())
  })

  return [...new Set(timestamps)].sort((a, b) => a - b).map((value) => new Date(value))
}

export function buildSegments(boundaries) {
  const segments = []
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index]
    const end = boundaries[index + 1]
    if (end.getTime() > start.getTime()) {
      segments.push({ start, end })
    }
  }
  return segments
}

export function activeChildrenForSegment(records, segment) {
  return records
    .filter((record) => record.startAt < segment.end && record.endAt > segment.start)
    .sort((a, b) => {
      if (a.startAt.getTime() !== b.startAt.getTime()) {
        return a.startAt.getTime() - b.startAt.getTime()
      }
      if (a.childId !== b.childId) {
        return String(a.childId).localeCompare(String(b.childId))
      }
      return String(a.familyId).localeCompare(String(b.familyId))
    })
}

export function hoursBetween(startAt, endAt) {
  const ms = endAt.getTime() - startAt.getTime()
  if (ms <= 0) {
    throw new Error('End time must be after start time')
  }

  return ms / (1000 * 60 * 60)
}
