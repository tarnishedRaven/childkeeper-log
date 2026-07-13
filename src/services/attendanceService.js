import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import {
  ATTENDANCE_SOURCE,
  ATTENDANCE_STATUS,
  COLLECTIONS,
  SCHEMA_VERSION,
} from '../constants/schemaV2'
import {
  validateAttendanceRecord,
  detectSameChildOverlaps,
} from '../utils/attendanceValidation'

function attendanceCollection(userId) {
  return collection(db, COLLECTIONS.USERS, userId, COLLECTIONS.ATTENDANCE)
}

function toDateTime(date, time) {
  return new Date(`${date}T${time}:00`)
}

function toSerializableRecord(validatedRecord) {
  return {
    childId: validatedRecord.childId,
    familyId: validatedRecord.familyId,
    date: validatedRecord.date,
    startTime: validatedRecord.startTime,
    endTime: validatedRecord.endTime,
    startAt: Timestamp.fromDate(validatedRecord.startAt),
    endAt: Timestamp.fromDate(validatedRecord.endAt),
    lunchBrought: validatedRecord.lunchBrought,
    notes: validatedRecord.notes,
    status: ATTENDANCE_STATUS.ACTIVE,
    source: ATTENDANCE_SOURCE.MANUAL,
    rate: Number(validatedRecord.rate || 0),
    numChildren: Number(validatedRecord.numChildren || 1),
    schemaVersion: SCHEMA_VERSION,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }
}

export async function detectConflictsForChild(userId, record, excludeAttendanceId = null) {
  const rows = await getAttendanceByDateRange(userId, record.date, record.date)
  const sameChild = rows.filter((entry) => entry.childId === record.childId && entry.id !== excludeAttendanceId)

  const normalized = [
    ...sameChild.map((entry) => ({
      ...entry,
      startAt: toDateTime(entry.date, entry.startTime),
      endAt: toDateTime(entry.date, entry.endTime),
    })),
    {
      id: excludeAttendanceId || 'new-record',
      childId: record.childId,
      date: record.date,
      startAt: record.startAt,
      endAt: record.endAt,
    },
  ]

  const overlaps = detectSameChildOverlaps(normalized)
  return overlaps.filter((issue) => issue.currentId === excludeAttendanceId || issue.currentId === 'new-record')
}

export async function addAttendance(userId, attendanceData) {
  const validated = validateAttendanceRecord(attendanceData)
  const conflicts = await detectConflictsForChild(userId, validated)
  if (conflicts.length > 0) {
    throw new Error('Overlapping attendance for the same child and date')
  }

  const docRef = await addDoc(
    attendanceCollection(userId),
    toSerializableRecord({
      ...validated,
      rate: attendanceData.rate,
      numChildren: attendanceData.numChildren,
    })
  )
  return docRef.id
}

export async function addAttendanceBatch(userId, attendanceRows) {
  if (!Array.isArray(attendanceRows) || attendanceRows.length === 0) {
    throw new Error('At least one attendance record is required')
  }

  const ids = []
  for (const row of attendanceRows) {
    const id = await addAttendance(userId, row)
    ids.push(id)
  }

  return ids
}

export async function getAttendanceByDateRange(userId, startDate, endDate) {
  const q = query(
    attendanceCollection(userId),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'desc'),
    orderBy('startAt', 'asc')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
}

export async function getAttendanceByFamilyDateRange(userId, familyId, startDate, endDate) {
  if (!familyId) {
    throw new Error('Family ID is required')
  }

  const rows = await getAttendanceByDateRange(userId, startDate, endDate)
  return rows.filter((entry) => entry.familyId === familyId)
}

export async function getRecentAttendance(userId, maxEntries = 10) {
  const q = query(attendanceCollection(userId), orderBy('createdAt', 'desc'), limit(maxEntries))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
}

export async function getFamilyIdsWithAttendance(userId) {
  const snapshot = await getDocs(attendanceCollection(userId))
  const familyIds = new Set()

  snapshot.docs.forEach((entry) => {
    const data = entry.data()
    if (data.familyId) {
      familyIds.add(data.familyId)
    }
  })

  return Array.from(familyIds)
}

export async function updateAttendance(userId, attendanceId, updates) {
  const payload = { ...updates }

  if (payload.startAt || payload.endAt) {
    throw new Error('Use date/startTime/endTime fields instead of startAt/endAt')
  }

  const hasIntervalFields = payload.date !== undefined || payload.startTime !== undefined || payload.endTime !== undefined

  if (hasIntervalFields) {
    if (!payload.date || !payload.startTime || !payload.endTime || !payload.childId || !payload.familyId) {
      throw new Error('date, startTime, endTime, childId, and familyId are required for interval updates')
    }

    const validated = validateAttendanceRecord(payload)
    const conflicts = await detectConflictsForChild(userId, validated, attendanceId)
    if (conflicts.length > 0) {
      throw new Error('Overlapping attendance for the same child and date')
    }

    payload.startAt = Timestamp.fromDate(validated.startAt)
    payload.endAt = Timestamp.fromDate(validated.endAt)
    payload.startTime = validated.startTime
    payload.endTime = validated.endTime
    payload.notes = validated.notes
    payload.lunchBrought = validated.lunchBrought
  }

  payload.schemaVersion = SCHEMA_VERSION
  payload.updatedAt = Timestamp.now()

  const rowRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.ATTENDANCE, attendanceId)
  await updateDoc(rowRef, payload)
}

export async function deleteAttendance(userId, attendanceId) {
  const rowRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.ATTENDANCE, attendanceId)
  await deleteDoc(rowRef)
}
