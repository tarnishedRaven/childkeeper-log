import {
  addAttendance,
  addAttendanceBatch,
  deleteAttendance,
  getAttendanceByDateRange,
  getAttendanceByFamilyDateRange,
  getRecentAttendance,
  updateAttendance,
} from './attendanceService'
import { roundToCents } from '../utils/money'

export function calculateDuration(startTime, endTime) {
  const [startHours, startMinutes] = String(startTime).split(':').map(Number)
  const [endHours, endMinutes] = String(endTime).split(':').map(Number)

  if (
    !Number.isInteger(startHours) ||
    !Number.isInteger(startMinutes) ||
    !Number.isInteger(endHours) ||
    !Number.isInteger(endMinutes) ||
    startHours < 0 ||
    startHours > 23 ||
    endHours < 0 ||
    endHours > 23 ||
    startMinutes < 0 ||
    startMinutes > 59 ||
    endMinutes < 0 ||
    endMinutes > 59
  ) {
    throw new Error('Invalid time format (use HH:MM)')
  }

  const startTotalMinutes = startHours * 60 + startMinutes
  const endTotalMinutes = endHours * 60 + endMinutes
  if (endTotalMinutes <= startTotalMinutes) {
    throw new Error('End time must be after start time')
  }

  return Math.round(((endTotalMinutes - startTotalMinutes) / 60) * 100) / 100
}

export function calculateEarnings(duration, rate) {
  if (!Number.isFinite(duration) || !Number.isFinite(rate) || duration <= 0 || rate <= 0) {
    throw new Error('Duration and rate must be positive')
  }

  return roundToCents(duration * rate) / 100
}

function toLegacyEntry(entry) {
  const rate = Number(entry.rate || 0)
  const duration = calculateDuration(entry.startTime, entry.endTime)

  return {
    ...entry,
    rate,
    hadLunch: entry.lunchBrought || false,
    numChildren: Number(entry.numChildren || 1),
    duration,
    totalEarned: calculateEarnings(duration, rate),
  }
}

export async function addTimeEntry(userId, entryData) {
  const { familyId, childId, date, startTime, endTime, notes, hadLunch, lunchBrought } = entryData
  const rate = Number(entryData.rate)
  const numChildren = Number(entryData.numChildren ?? 1)

  if (!familyId) throw new Error('Family ID is required')
  if (!date) throw new Error('Date is required')
  if (!startTime) throw new Error('Start time is required')
  if (!endTime) throw new Error('End time is required')
  if (!Number.isInteger(numChildren) || numChildren < 1) {
    throw new Error('Number of children must be at least 1')
  }
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Rate must be a positive number')

  const attendanceId = await addAttendance(userId, {
    childId: childId || `${familyId}-legacy-child`,
    familyId,
    date,
    startTime,
    endTime,
    lunchBrought: lunchBrought ?? hadLunch ?? false,
    notes: notes || '',
    rate,
    numChildren,
  })

  return attendanceId
}

export async function addTimeEntries(userId, entryRows) {
  const payload = entryRows.map((entryData) => ({
    childId: entryData.childId || `${entryData.familyId}-legacy-child`,
    familyId: entryData.familyId,
    date: entryData.date,
    startTime: entryData.startTime,
    endTime: entryData.endTime,
    lunchBrought: entryData.lunchBrought ?? entryData.hadLunch ?? false,
    notes: entryData.notes || '',
    rate: Number(entryData.rate || 0),
    numChildren: Number(entryData.numChildren ?? 1),
  }))

  return addAttendanceBatch(userId, payload)
}

export async function getTimeEntries(userId, startDate, endDate) {
  const rows = await getAttendanceByDateRange(userId, startDate, endDate)
  return rows.map(toLegacyEntry)
}

export async function getRecentTimeEntries(userId, maxEntries = 10) {
  const rows = await getRecentAttendance(userId, maxEntries)
  return rows.map(toLegacyEntry)
}

export async function getTimeEntriesByFamily(userId, familyId, startDate, endDate) {
  if (!familyId) {
    throw new Error('Family ID is required')
  }

  const rows = await getAttendanceByFamilyDateRange(userId, familyId, startDate, endDate)
  return rows.map(toLegacyEntry)
}

export async function updateTimeEntry(userId, entryId, updates) {
  if (updates.rate !== undefined && (!Number.isFinite(updates.rate) || updates.rate <= 0)) {
    throw new Error('Rate must be positive')
  }

  if (updates.startTime !== undefined || updates.endTime !== undefined) {
    if (updates.startTime === undefined || updates.endTime === undefined) {
      throw new Error('Both start and end time are required when updating time')
    }

    calculateDuration(updates.startTime, updates.endTime)

    if (updates.rate === undefined) {
      throw new Error('Rate is required when updating time')
    }
  }

  await updateAttendance(userId, entryId, {
    ...updates,
    lunchBrought: updates.lunchBrought ?? updates.hadLunch,
  })
}

export async function deleteTimeEntry(userId, entryId) {
  await deleteAttendance(userId, entryId)
}
