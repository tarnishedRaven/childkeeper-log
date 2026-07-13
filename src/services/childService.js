import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { COLLECTIONS, SCHEMA_VERSION } from '../constants/schemaV2'

function normalizeChildPayload(data) {
  const firstName = String(data.firstName || '').trim()
  const lastName = String(data.lastName || '').trim()
  const displayName =
    String(data.displayName || '').trim() || [firstName, lastName].filter(Boolean).join(' ').trim()

  if (!firstName && !displayName) {
    throw new Error('Child first name or display name is required')
  }

  if (!data.familyId) {
    throw new Error('Family is required')
  }

  return {
    familyId: data.familyId,
    firstName,
    lastName,
    displayName,
    birthDate: data.birthDate || null,
    isActive: data.isActive !== false,
    effectiveStartDate: data.effectiveStartDate || null,
    effectiveEndDate: data.effectiveEndDate || null,
    schemaVersion: SCHEMA_VERSION,
  }
}

export async function addChild(userId, childData) {
  const childrenRef = collection(db, COLLECTIONS.USERS, userId, COLLECTIONS.CHILDREN)
  const payload = normalizeChildPayload(childData)

  const docRef = await addDoc(childrenRef, {
    ...payload,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })

  return docRef.id
}

export async function getChildren(userId, filters = {}) {
  const childrenRef = collection(db, COLLECTIONS.USERS, userId, COLLECTIONS.CHILDREN)
  const snapshot = await getDocs(childrenRef)

  let children = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))

  if (filters.familyId) {
    children = children.filter((child) => child.familyId === filters.familyId)
  }

  if (filters.activeOnly) {
    children = children.filter((child) => child.isActive !== false)
  }

  return children.sort((a, b) => {
    const aName = String(a.displayName || `${a.firstName || ''} ${a.lastName || ''}`.trim())
    const bName = String(b.displayName || `${b.firstName || ''} ${b.lastName || ''}`.trim())
    return aName.localeCompare(bName)
  })
}

export async function updateChild(userId, childId, updates) {
  const childRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.CHILDREN, childId)
  const payload = {}

  if (updates.firstName !== undefined) payload.firstName = String(updates.firstName || '').trim()
  if (updates.lastName !== undefined) payload.lastName = String(updates.lastName || '').trim()
  if (updates.displayName !== undefined) payload.displayName = String(updates.displayName || '').trim()
  if (updates.familyId !== undefined) payload.familyId = updates.familyId
  if (updates.birthDate !== undefined) payload.birthDate = updates.birthDate || null
  if (updates.isActive !== undefined) payload.isActive = Boolean(updates.isActive)
  if (updates.effectiveStartDate !== undefined) payload.effectiveStartDate = updates.effectiveStartDate || null
  if (updates.effectiveEndDate !== undefined) payload.effectiveEndDate = updates.effectiveEndDate || null

  payload.schemaVersion = SCHEMA_VERSION
  payload.updatedAt = Timestamp.now()

  await updateDoc(childRef, payload)
}

export async function deleteChild(userId, childId) {
  const childRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.CHILDREN, childId)
  await deleteDoc(childRef)
}

export async function reassignChildFamily(userId, childId, newFamilyId, effectiveDate) {
  if (!newFamilyId) {
    throw new Error('New family is required')
  }

  if (!effectiveDate) {
    throw new Error('Effective date is required')
  }

  await updateChild(userId, childId, {
    familyId: newFamilyId,
    effectiveStartDate: effectiveDate,
  })
}
