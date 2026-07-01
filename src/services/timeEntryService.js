import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

/**
 * Calculate duration in hours from start and end time (HH:MM format)
 * @param {string} startTime - Start time in HH:MM format
 * @param {string} endTime - End time in HH:MM format
 * @returns {number} Duration in hours
 * @throws {Error} if times invalid or end before start
 */
export function calculateDuration(startTime, endTime) {
  const parseTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number)
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      throw new Error('Invalid time format (use HH:MM)')
    }
    return hours * 60 + minutes
  }

  const startMinutes = parseTime(startTime)
  const endMinutes = parseTime(endTime)

  if (endMinutes <= startMinutes) {
    throw new Error('End time must be after start time')
  }

  const rawDuration = (endMinutes - startMinutes) / 60
  return Math.round(rawDuration * 100) / 100
}

/**
 * Calculate earnings from duration and rate
 * @param {number} duration - Duration in hours
 * @param {number} rate - Hourly rate
 * @returns {number} Total earnings
 */
export function calculateEarnings(duration, rate) {
  if (!Number.isFinite(duration) || !Number.isFinite(rate) || duration <= 0 || rate <= 0) {
    throw new Error('Duration and rate must be positive')
  }
  return Math.round(duration * rate * 100) / 100
}

/**
 * Add a new time entry
 * @param {string} userId - User ID
 * @param {Object} entryData - { familyId, date, startTime, endTime, numChildren, rate, notes }
 * @returns {Promise<string>} Entry ID
 */
export async function addTimeEntry(userId, entryData) {
  const { familyId, date, startTime, endTime, numChildren, rate, notes } = entryData

  if (!familyId) throw new Error('Family ID is required')
  if (!date) throw new Error('Date is required')
  if (!startTime) throw new Error('Start time is required')
  if (!endTime) throw new Error('End time is required')
  if (numChildren === undefined || numChildren < 1) {
    throw new Error('Number of children must be at least 1')
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('Rate must be a positive number')
  }

  const duration = calculateDuration(startTime, endTime)
  const totalEarned = calculateEarnings(duration, rate)

  const entriesRef = collection(db, 'users', userId, 'timeEntries')
  const docRef = await addDoc(entriesRef, {
    familyId,
    date,
    startTime,
    endTime,
    duration,
    numChildren,
    rate,
    totalEarned,
    notes: notes || '',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })

  return docRef.id
}

/**
 * Get time entries for a user within date range
 * @param {string} userId - User ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Array of time entry objects
 */
export async function getTimeEntries(userId, startDate, endDate) {
  const entriesRef = collection(db, 'users', userId, 'timeEntries')
  const q = query(
    entriesRef,
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'desc')
  )
  const snapshot = await getDocs(q)

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }))
}

/**
 * Get most recent time entries for a user across all dates
 * @param {string} userId - User ID
 * @param {number} maxEntries - Maximum number of entries to return
 * @returns {Promise<Array>} Array of time entry objects
 */
export async function getRecentTimeEntries(userId, maxEntries = 10) {
  const entriesRef = collection(db, 'users', userId, 'timeEntries')
  const q = query(entriesRef, orderBy('createdAt', 'desc'), limit(maxEntries))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }))
}

/**
 * Get time entries for a specific family within date range
 * Uses existing date-range query and filters client-side to avoid extra Firestore indexes.
 * @param {string} userId - User ID
 * @param {string} familyId - Family ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Array of time entry objects for the family
 */
export async function getTimeEntriesByFamily(userId, familyId, startDate, endDate) {
  if (!familyId) {
    throw new Error('Family ID is required')
  }

  const entries = await getTimeEntries(userId, startDate, endDate)
  return entries.filter((entry) => entry.familyId === familyId)
}

/**
 * Update a time entry
 * @param {string} userId - User ID
 * @param {string} entryId - Entry ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateTimeEntry(userId, entryId, updates) {
  const { familyId, date, startTime, endTime, rate, numChildren, notes } = updates

  const dataToUpdate = {}

  if (familyId !== undefined) {
    if (!familyId) throw new Error('Family ID is required')
    dataToUpdate.familyId = familyId
  }

  if (date !== undefined) {
    if (!date) throw new Error('Date is required')
    dataToUpdate.date = date
  }

  if (rate !== undefined) {
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('Rate must be positive')
    dataToUpdate.rate = rate
  }

  if (startTime !== undefined || endTime !== undefined) {
    if (startTime === undefined || endTime === undefined) {
      throw new Error('Both start and end time are required when updating time')
    }

    const start = startTime
    const end = endTime
    const duration = calculateDuration(start, end)
    const currentRate = rate

    if (currentRate === undefined) {
      throw new Error('Rate is required when updating time')
    }

    const totalEarned = calculateEarnings(duration, currentRate)

    dataToUpdate.startTime = startTime
    dataToUpdate.endTime = endTime
    dataToUpdate.duration = duration
    dataToUpdate.totalEarned = totalEarned
  } else if (rate !== undefined) {
    // Recalculate earnings with existing duration
    // Duration must be fetched from Firestore in real usage
  }

  if (numChildren !== undefined) {
    if (numChildren < 1) throw new Error('Number of children must be at least 1')
    dataToUpdate.numChildren = numChildren
  }

  if (notes !== undefined) dataToUpdate.notes = notes

  dataToUpdate.updatedAt = Timestamp.now()

  const entryRef = doc(db, 'users', userId, 'timeEntries', entryId)
  await updateDoc(entryRef, dataToUpdate)
}

/**
 * Delete a time entry
 * @param {string} userId - User ID
 * @param {string} entryId - Entry ID
 * @returns {Promise<void>}
 */
export async function deleteTimeEntry(userId, entryId) {
  const entryRef = doc(db, 'users', userId, 'timeEntries', entryId)
  await deleteDoc(entryRef)
}
