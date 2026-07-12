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

describe('familyService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('validateRates accepts undefined and object', () => {
    expect(() => validateRates(undefined)).not.toThrow()
    expect(() => validateRates({ 1: 20 })).not.toThrow()
  })

  it('validateRates rejects non-object values', () => {
    expect(() => validateRates(null)).toThrow('Rates must be an object when provided')
    expect(() => validateRates(10)).toThrow('Rates must be an object when provided')
  })

  it('addFamily requires name', async () => {
    await expect(addFamily('u1', { name: '   ' })).rejects.toThrow('Family name is required')
  })

  it('addFamily stores metadata', async () => {
    firestore.collection.mockReturnValue({})
    firestore.addDoc.mockResolvedValue({ id: 'fam123' })

    const familyId = await addFamily('u1', {
      name: 'Smith Family',
      contactName: 'Jordan',
      phone: '555',
      notes: 'Notes',
    })

    expect(familyId).toBe('fam123')
    expect(firestore.addDoc).toHaveBeenCalled()
    const payload = firestore.addDoc.mock.calls[0][1]
    expect(payload.name).toBe('Smith Family')
    expect(payload.contactName).toBe('Jordan')
  })

  it('getFamilies returns mapped docs', async () => {
    firestore.collection.mockReturnValue({})
    firestore.getDocs.mockResolvedValue({
      docs: [
        { id: 'f1', data: () => ({ name: 'A' }) },
        { id: 'f2', data: () => ({ name: 'B' }) },
      ],
    })

    const rows = await getFamilies('u1')
    expect(rows).toHaveLength(2)
    expect(rows[0].id).toBe('f1')
  })

  it('updateFamily requires non-empty name if provided', async () => {
    await expect(updateFamily('u1', 'f1', { name: '' })).rejects.toThrow('Family name is required')
  })

  it('updateFamily updates metadata', async () => {
    firestore.doc.mockReturnValue({})
    firestore.updateDoc.mockResolvedValue()

    await updateFamily('u1', 'f1', {
      name: 'Updated',
      phone: '999',
      isActive: false,
    })

    expect(firestore.updateDoc).toHaveBeenCalled()
    const payload = firestore.updateDoc.mock.calls[0][1]
    expect(payload.name).toBe('Updated')
    expect(payload.phone).toBe('999')
    expect(payload.isActive).toBe(false)
  })

  it('deleteFamily blocks when active children exist', async () => {
    firestore.collection.mockReturnValue({})
    firestore.getDocs.mockResolvedValue({
      docs: [{ data: () => ({ familyId: 'f1', isActive: true }) }],
    })

    await expect(deleteFamily('u1', 'f1')).rejects.toThrow('Cannot delete family with active children')
  })

  it('deleteFamily deletes when no active children', async () => {
    firestore.collection.mockReturnValue({})
    firestore.getDocs.mockResolvedValue({ docs: [] })
    firestore.doc.mockReturnValue({})
    firestore.deleteDoc.mockResolvedValue()

    await deleteFamily('u1', 'f1')
    expect(firestore.deleteDoc).toHaveBeenCalled()
  })
})
