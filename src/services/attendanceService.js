import {
  addDoc,
  collection,
  deleteDoc,
  documentId,
  doc,
  endBefore,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  limitToLast,
  orderBy,
  query,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
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

function familiesCollection(userId) {
  return collection(db, COLLECTIONS.USERS, userId, COLLECTIONS.FAMILIES)
}

function childrenCollection(userId) {
  return collection(db, COLLECTIONS.USERS, userId, COLLECTIONS.CHILDREN)
}

function familyDocRef(userId, familyId) {
  return doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.FAMILIES, familyId)
}

function childDocRef(userId, childId) {
  return doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.CHILDREN, childId)
}

function toDateTime(date, time) {
  return new Date(`${date}T${time}:00`)
}

function normalizeSortKey(value, fallback = 'unknown') {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized || fallback
}

function buildChildDisplayName(childData) {
  return (
    childData?.displayName ||
    [childData?.firstName || '', childData?.lastName || ''].filter(Boolean).join(' ').trim() ||
    'Unknown Child'
  )
}

function buildSortKeys({ familyName, childDisplayName, lunchBrought }) {
  return {
    familySortKey: normalizeSortKey(familyName, 'unknown family'),
    childSortKey: normalizeSortKey(childDisplayName, 'unknown child'),
    lunchSortKey: toLunchSortKey(Boolean(lunchBrought)),
  }
}

async function commitBatchUpdates(updates) {
  if (updates.length === 0) {
    return 0
  }

  let updatedCount = 0
  for (let index = 0; index < updates.length; index += 400) {
    const batch = writeBatch(db)
    const chunk = updates.slice(index, index + 400)

    chunk.forEach(({ ref, data }) => {
      batch.update(ref, data)
    })

    await batch.commit()
    updatedCount += chunk.length
  }

  return updatedCount
}

function toLunchSortKey(lunchBrought) {
  return lunchBrought ? 1 : 0
}

async function resolveSortKeys(userId, { childId, familyId, lunchBrought }) {
  const [childSnapshot, familySnapshot] = await Promise.all([
    childId ? getDoc(childDocRef(userId, childId)) : Promise.resolve(null),
    familyId ? getDoc(familyDocRef(userId, familyId)) : Promise.resolve(null),
  ])

  const childData = childSnapshot?.exists() ? childSnapshot.data() : null
  const familyData = familySnapshot?.exists() ? familySnapshot.data() : null

  return buildSortKeys({
    familyName: familyData?.name || 'Unknown Family',
    childDisplayName: buildChildDisplayName(childData),
    lunchBrought,
  })
}

function toPagingCursor(docSnapshot) {
  if (!docSnapshot) {
    return null
  }

  return {
    id: docSnapshot.id,
    snapshot: docSnapshot,
  }
}

function sortOrderBy(sortKey, sortDir) {
  const direction = sortDir === 'asc' ? 'asc' : 'desc'
  const sortMap = {
    date: [orderBy('date', direction), orderBy('startAt', 'asc'), orderBy(documentId(), 'asc')],
    family: [orderBy('familySortKey', direction), orderBy('createdAt', 'desc'), orderBy(documentId(), 'asc')],
    child: [orderBy('childSortKey', direction), orderBy('createdAt', 'desc'), orderBy(documentId(), 'asc')],
    time: [orderBy('startAt', direction), orderBy('createdAt', 'desc'), orderBy(documentId(), 'asc')],
    lunch: [orderBy('lunchSortKey', direction), orderBy('createdAt', 'desc'), orderBy(documentId(), 'asc')],
  }

  return sortMap[sortKey] || sortMap.date
}

function mapSnapshotDocs(snapshotDocs) {
  return snapshotDocs.map((entry) => ({ id: entry.id, ...entry.data() }))
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
    familySortKey: validatedRecord.familySortKey || 'unknown family',
    childSortKey: validatedRecord.childSortKey || 'unknown child',
    lunchSortKey: toLunchSortKey(Boolean(validatedRecord.lunchBrought)),
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

  const sortKeys = await resolveSortKeys(userId, {
    childId: validated.childId,
    familyId: validated.familyId,
    lunchBrought: validated.lunchBrought,
  })

  const docRef = await addDoc(
    attendanceCollection(userId),
    toSerializableRecord({
      ...validated,
      rate: attendanceData.rate,
      numChildren: attendanceData.numChildren,
      ...sortKeys,
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
  const q = query(
    attendanceCollection(userId),
    orderBy('createdAt', 'desc'),
    orderBy(documentId(), 'asc'),
    limit(maxEntries)
  )
  const snapshot = await getDocs(q)
  return mapSnapshotDocs(snapshot.docs)
}

export async function getAttendanceTotalCount(userId) {
  const snapshot = await getCountFromServer(attendanceCollection(userId))
  return Number(snapshot.data()?.count || 0)
}

export async function getAttendancePage(
  userId,
  {
    pageSize = 25,
    sortKey = 'date',
    sortDir = 'desc',
    cursor = null,
    direction = 'next',
  } = {}
) {
  if (pageSize < 1) {
    throw new Error('pageSize must be at least 1')
  }

  const baseOrder = sortOrderBy(sortKey, sortDir)
  const pageLimit = pageSize + 1
  const pagingDirection = direction === 'prev' ? 'prev' : 'next'
  const cursorSnapshot = cursor?.snapshot || null

  const constraints = [...baseOrder]
  if (cursorSnapshot && pagingDirection === 'next') {
    constraints.push(startAfter(cursorSnapshot))
  }
  if (cursorSnapshot && pagingDirection === 'prev') {
    constraints.push(endBefore(cursorSnapshot))
  }

  if (pagingDirection === 'prev') {
    constraints.push(limitToLast(pageLimit))
  } else {
    constraints.push(limit(pageLimit))
  }

  const pageQuery = query(attendanceCollection(userId), ...constraints)
  const snapshot = await getDocs(pageQuery)
  const docs = snapshot.docs

  let hasMoreInDirection = false
  let pageDocs = docs

  if (docs.length > pageSize) {
    hasMoreInDirection = true
    pageDocs = pagingDirection === 'prev' ? docs.slice(1) : docs.slice(0, pageSize)
  }

  const firstDoc = pageDocs[0] || null
  const lastDoc = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null

  const hasPrev = pagingDirection === 'prev' ? hasMoreInDirection : Boolean(cursorSnapshot)
  const hasNext = pagingDirection === 'next' ? hasMoreInDirection : Boolean(cursorSnapshot)

  return {
    rows: mapSnapshotDocs(pageDocs),
    hasPrev,
    hasNext,
    firstCursor: toPagingCursor(firstDoc),
    lastCursor: toPagingCursor(lastDoc),
  }
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

export async function syncAttendanceSortKeysForFamily(userId, familyId, familyName) {
  if (!familyId) {
    throw new Error('Family ID is required')
  }

  const snapshot = await getDocs(query(attendanceCollection(userId), where('familyId', '==', familyId)))
  const updates = snapshot.docs
    .map((entry) => ({
      ref: entry.ref,
      data: {
        familySortKey: normalizeSortKey(familyName, 'unknown family'),
        schemaVersion: SCHEMA_VERSION,
        updatedAt: Timestamp.now(),
      },
    }))

  return commitBatchUpdates(updates)
}

export async function syncAttendanceSortKeysForChild(userId, childId, childName) {
  if (!childId) {
    throw new Error('Child ID is required')
  }

  const snapshot = await getDocs(query(attendanceCollection(userId), where('childId', '==', childId)))
  const updates = snapshot.docs
    .map((entry) => ({
      ref: entry.ref,
      data: {
        childSortKey: normalizeSortKey(childName, 'unknown child'),
        schemaVersion: SCHEMA_VERSION,
        updatedAt: Timestamp.now(),
      },
    }))

  return commitBatchUpdates(updates)
}

export async function backfillAttendanceSortKeys(userId) {
  const [familiesSnapshot, childrenSnapshot, attendanceSnapshot] = await Promise.all([
    getDocs(familiesCollection(userId)),
    getDocs(childrenCollection(userId)),
    getDocs(attendanceCollection(userId)),
  ])

  const familyById = familiesSnapshot.docs.reduce((acc, entry) => {
    acc[entry.id] = entry.data()
    return acc
  }, {})

  const childById = childrenSnapshot.docs.reduce((acc, entry) => {
    acc[entry.id] = entry.data()
    return acc
  }, {})

  const updates = attendanceSnapshot.docs.flatMap((entry) => {
    const data = entry.data()
    const nextSortKeys = buildSortKeys({
      familyName: familyById[data.familyId]?.name || 'Unknown Family',
      childDisplayName: buildChildDisplayName(childById[data.childId]),
      lunchBrought: data.lunchBrought,
    })

    const hasChanges =
      data.familySortKey !== nextSortKeys.familySortKey ||
      data.childSortKey !== nextSortKeys.childSortKey ||
      data.lunchSortKey !== nextSortKeys.lunchSortKey

    if (!hasChanges) {
      return []
    }

    return [
      {
        ref: entry.ref,
        data: {
          ...nextSortKeys,
          schemaVersion: SCHEMA_VERSION,
          updatedAt: Timestamp.now(),
        },
      },
    ]
  })

  return commitBatchUpdates(updates)
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

    const sortKeys = await resolveSortKeys(userId, {
      childId: validated.childId,
      familyId: validated.familyId,
      lunchBrought: validated.lunchBrought,
    })

    payload.familySortKey = sortKeys.familySortKey
    payload.childSortKey = sortKeys.childSortKey
    payload.lunchSortKey = sortKeys.lunchSortKey
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
