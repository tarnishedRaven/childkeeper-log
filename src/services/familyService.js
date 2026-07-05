import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

/**
 * Validate rate structure
 * @param {Object} rates - Object with child count as key, rate as value
 * @throws {Error} if rates invalid
 */
export function validateRates(rates) {
  if (!rates || typeof rates !== 'object' || Object.keys(rates).length === 0) {
    throw new Error('At least one rate must be configured')
  }

  Object.entries(rates).forEach(([childCount, rate]) => {
    const count = parseInt(childCount)
    if (isNaN(count) || count < 1) {
      throw new Error('Child count must be a positive integer')
    }
    if (typeof rate !== 'number' || rate <= 0) {
      throw new Error(`Rate for ${childCount} child(ren) must be a positive number`)
    }
  })
}

/**
 * Add a new family with rates
 * @param {string} userId - User ID
 * @param {Object} familyData - { name, rates: { childCount: hourlyRate, ... }, lunchDiscount?: number }
 * @returns {Promise<string>} Family ID
 */
export async function addFamily(userId, familyData) {
  const { name, rates, lunchDiscount } = familyData

  if (!name || name.trim() === '') {
    throw new Error('Family name is required')
  }

  validateRates(rates)

  const familiesRef = collection(db, 'users', userId, 'families')
  const data = {
    name: name.trim(),
    rates,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }
  
  if (lunchDiscount !== undefined && lunchDiscount > 0) {
    data.lunchDiscount = lunchDiscount
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
  const familiesRef = collection(db, 'users', userId, 'families')
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
  const familyRef = doc(db, 'users', userId, 'families', familyId)
  const snapshot = await getDocs(collection(familyRef))

  if (!snapshot.exists()) {
    throw new Error('Family not found')
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  }
}

/**
 * Update family data
 * @param {string} userId - User ID
 * @param {string} familyId - Family ID
 * @param {Object} updates - Fields to update (name, rates, lunchDiscount)
 * @returns {Promise<void>}
 */
export async function updateFamily(userId, familyId, updates) {
  const { name, rates, lunchDiscount } = updates

  if (name !== undefined && (name === null || name.trim() === '')) {
    throw new Error('Family name is required')
  }

  if (rates !== undefined) {
    validateRates(rates)
  }

  const familyRef = doc(db, 'users', userId, 'families', familyId)
  const dataToUpdate = {}

  if (name !== undefined) dataToUpdate.name = name.trim()
  if (rates !== undefined) dataToUpdate.rates = rates
  if (lunchDiscount !== undefined) {
    dataToUpdate.lunchDiscount = lunchDiscount > 0 ? lunchDiscount : null
  }

  dataToUpdate.updatedAt = Timestamp.now()

  await updateDoc(familyRef, dataToUpdate)
}

/**
 * Delete a family
 * @param {string} userId - User ID
 * @param {string} familyId - Family ID
 * @returns {Promise<void>}
 */
export async function deleteFamily(userId, familyId) {
  const familyRef = doc(db, 'users', userId, 'families', familyId)
  await deleteDoc(familyRef)
}
