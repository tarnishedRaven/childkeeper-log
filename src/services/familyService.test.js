import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as firestore from 'firebase/firestore'
import {
  validateRates,
  addFamily,
  getFamilies,
  updateFamily,
  deleteFamily,
} from './familyService'

vi.mock('firebase/firestore')
vi.mock('../firebase', () => ({
  db: {},
}))

describe('Family Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validateRates', () => {
    it('should accept valid rates', () => {
      const rates = { 1: 25, 2: 35, 3: 45 }
      expect(() => validateRates(rates)).not.toThrow()
    })

    it('should throw error for empty rates', () => {
      expect(() => validateRates({})).toThrow('At least one rate must be configured')
    })

    it('should throw error for null rates', () => {
      expect(() => validateRates(null)).toThrow('At least one rate must be configured')
    })

    it('should throw error for invalid child count', () => {
      const rates = { 0: 25 }
      expect(() => validateRates(rates)).toThrow('Child count must be a positive integer')
    })

    it('should throw error for zero or negative rate', () => {
      const rates = { 1: 0 }
      expect(() => validateRates(rates)).toThrow('must be a positive number')

      const negativeRates = { 1: -10 }
      expect(() => validateRates(negativeRates)).toThrow('must be a positive number')
    })
  })

  describe('addFamily', () => {
    it('should throw error for empty name', async () => {
      await expect(
        addFamily('userId123', { name: '', rates: { 1: 25 } })
      ).rejects.toThrow('Family name is required')
    })

    it('should throw error for invalid rates', async () => {
      await expect(
        addFamily('userId123', { name: 'Smith Family', rates: {} })
      ).rejects.toThrow('At least one rate must be configured')
    })

    it('should add family with valid data', async () => {
      firestore.collection.mockReturnValue({})
      firestore.addDoc.mockResolvedValue({ id: 'fam123' })

      const familyId = await addFamily('userId123', {
        name: 'Smith Family',
        rates: { 1: 25, 2: 35 },
      })

      expect(familyId).toBe('fam123')
      expect(firestore.addDoc).toHaveBeenCalled()
    })
  })

  describe('getFamilies', () => {
    it('should retrieve all families for user', async () => {
      const mockFamilies = [
        { id: 'fam1', name: 'Smith Family', rates: { 1: 25 } },
        { id: 'fam2', name: 'Jones Family', rates: { 1: 30 } },
      ]

      firestore.collection.mockReturnValue({})
      firestore.getDocs.mockResolvedValue({
        docs: mockFamilies.map((fam) => ({
          id: fam.id,
          data: () => ({ name: fam.name, rates: fam.rates }),
        })),
      })

      const families = await getFamilies('userId123')

      expect(families).toHaveLength(2)
      expect(firestore.getDocs).toHaveBeenCalled()
    })
  })

  describe('updateFamily', () => {
    it('should throw error for empty name update', async () => {
      await expect(
        updateFamily('userId123', 'fam123', { name: '' })
      ).rejects.toThrow('Family name is required')
    })

    it('should throw error for invalid rates update', async () => {
      await expect(
        updateFamily('userId123', 'fam123', { rates: {} })
      ).rejects.toThrow('At least one rate must be configured')
    })

    it('should update family with valid data', async () => {
      firestore.doc.mockReturnValue({})
      firestore.updateDoc.mockResolvedValue()

      await updateFamily('userId123', 'fam123', {
        name: 'Updated Family',
        rates: { 1: 30 },
      })

      expect(firestore.updateDoc).toHaveBeenCalled()
    })
  })

  describe('deleteFamily', () => {
    it('should delete family', async () => {
      firestore.doc.mockReturnValue({})
      firestore.deleteDoc.mockResolvedValue()

      await deleteFamily('userId123', 'fam123')

      expect(firestore.deleteDoc).toHaveBeenCalled()
    })
  })
})
