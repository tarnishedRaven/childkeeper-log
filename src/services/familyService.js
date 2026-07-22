import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { COLLECTIONS, SCHEMA_VERSION } from '../constants/schemaV2'
import { syncAttendanceSortKeysForFamily } from './attendanceService'

/**
 * Deprecated compatibility helper. Rates moved to global config in schema v2.
 * @param {Object} rates
 */
export function validateRates(rates) {
  if (rates !== undefined && (typeof rates !== 'object' || rates === null)) {
    throw new Error('Rates must be an object when provided')
  }
}

/**
 * Add a new family (metadata only)
 * @param {string} userId - User ID
 * @param {Object} familyData
 * @returns {Promise<string>} Family ID
 */
export async function addFamily(userId, familyData) {
  const { name, contactName, phone, notes, isActive } = familyData

  if (!name || name.trim() === '') {
    throw new Error('Family name is required')
  }

  const familiesRef = collection(db, COLLECTIONS.USERS, userId, COLLECTIONS.FAMILIES)
  const data = {
    name: name.trim(),
    contactName: contactName ? String(contactName).trim() : '',
    phone: phone ? String(phone).trim() : '',
    notes: notes ? String(notes).trim() : '',
    isActive: isActive !== false,
    schemaVersion: SCHEMA_VERSION,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }

  const docRef = await addDoc(familiesRef, data)

  return docRef.id
}

/**
 * Get all families for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of family objects with id
 */
export async function getFamilies(userId) {
  const familiesRef = collection(db, COLLECTIONS.USERS, userId, COLLECTIONS.FAMILIES)
  const snapshot = await getDocs(familiesRef)

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }))
}

/**
 * Get a single family by ID
 * @param {string} userId - User ID
 * @param {string} familyId - Family ID
 * @returns {Promise<Object>} Family object
 */
export async function getFamily(userId, familyId) {
  const familyRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.FAMILIES, familyId)
  const snapshot = await getDoc(familyRef)

  if (!snapshot.exists()) {
    throw new Error('Family not found')
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  }
}

/**
 * Update family metadata
 * @param {string} userId - User ID
 * @param {string} familyId - Family ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateFamily(userId, familyId, updates) {
  const { name, contactName, phone, notes, isActive } = updates

  if (name !== undefined && (name === null || name.trim() === '')) {
    throw new Error('Family name is required')
  }

  const familyRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.FAMILIES, familyId)
  const dataToUpdate = {}

  if (name !== undefined) dataToUpdate.name = name.trim()
  if (contactName !== undefined) dataToUpdate.contactName = String(contactName || '').trim()
  if (phone !== undefined) dataToUpdate.phone = String(phone || '').trim()
  if (notes !== undefined) dataToUpdate.notes = String(notes || '').trim()
  if (isActive !== undefined) dataToUpdate.isActive = Boolean(isActive)

  dataToUpdate.schemaVersion = SCHEMA_VERSION

  dataToUpdate.updatedAt = Timestamp.now()

  await updateDoc(familyRef, dataToUpdate)

  if (dataToUpdate.name !== undefined) {
    await syncAttendanceSortKeysForFamily(userId, familyId, dataToUpdate.name)
  }
}

/**
 * Delete a family
 * @param {string} userId - User ID
 * @param {string} familyId - Family ID
 * @returns {Promise<void>}
 */
export async function deleteFamily(userId, familyId) {
  const childrenRef = collection(db, COLLECTIONS.USERS, userId, COLLECTIONS.CHILDREN)
  const childrenSnapshot = await getDocs(childrenRef)
  const hasChildren = childrenSnapshot.docs.some((snapshot) => {
    const child = snapshot.data()
    return child.familyId === familyId && child.isActive !== false
  })

  if (hasChildren) {
    throw new Error('Cannot delete family with active children')
  }

  const familyRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.FAMILIES, familyId)
  await deleteDoc(familyRef)
}
