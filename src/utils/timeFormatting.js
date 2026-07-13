export function formatTime12Hour(timeStr) {
  if (!timeStr) return ''

  const [hourPart, minutePart = '00'] = timeStr.split(':')
  const hour = Number(hourPart)
  const minute = Number(minutePart)

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return timeStr

  const date = new Date()
  date.setHours(hour, minute, 0, 0)

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

export function formatDisplayDate(dateStr) {
  if (!dateStr) return ''

  const date = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateStr

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}