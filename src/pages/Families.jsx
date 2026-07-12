import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { addFamily, getFamilies, updateFamily, deleteFamily } from '../services/familyService'
import { addChild, getChildren, updateChild, deleteChild } from '../services/childService'
import { getFamilyIdsWithAttendance } from '../services/attendanceService'
import {
  getGlobalRates,
  updateGlobalRates,
} from '../services/rateConfigService'
import SyncStatusBanner from '../components/SyncStatusBanner'
import useConnectivityStatus from '../hooks/useConnectivityStatus'

const defaultFamilyForm = {
  name: '',
  contactName: '',
  phone: '',
  notes: '',
}

const defaultChildForm = {
  name: '',
}

const defaultHourlyRatesForm = {
  minFamilyHourlyRate: '',
  minNannyHourlyRate: '',
  maxNannyHourlyRate: '',
  lunchFeePerChild: '',
  tierRates: {
    '1': '',
  },
}

const toHourlyRatesForm = (savedRates) => ({
  minFamilyHourlyRate: String(savedRates?.minFamilyHourlyRate ?? ''),
  minNannyHourlyRate: String(savedRates?.minNannyHourlyRate ?? ''),
  maxNannyHourlyRate: String(savedRates?.maxNannyHourlyRate ?? ''),
  lunchFeePerChild: String(savedRates?.lunchFeePerChild ?? ''),
  tierRates:
    Object.keys(savedRates?.hourlyRateByChildCount || {}).length > 0
      ? Object.keys(savedRates.hourlyRateByChildCount)
          .sort((a, b) => Number(a) - Number(b))
          .reduce((acc, key) => {
            acc[String(key)] = String(savedRates.hourlyRateByChildCount[key])
            return acc
          }, {})
      : { '1': '' },
})

const formatPhoneNumber = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 10)

  if (digits.length === 0) return ''
  if (digits.length < 4) return `(${digits}`
  if (digits.length < 7) return `(${digits.slice(0, 3)})${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export default function Families() {
  const { user } = useAuth()
  const {
    isOnline,
    hasPendingSync,
    isSyncing,
    syncError,
    isStaleVersion,
    markPendingSync,
    markSyncing,
    clearPendingSync,
    markSyncError,
    clearSyncError,
  } = useConnectivityStatus()
  const navigate = useNavigate()

  const [families, setFamilies] = useState([])
  const [children, setChildren] = useState([])
  const [familyIdsWithLogs, setFamilyIdsWithLogs] = useState(new Set())
  const [rates, setRates] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showFamilyForm, setShowFamilyForm] = useState(false)
  const [familyForm, setFamilyForm] = useState(defaultFamilyForm)
  const [childForm, setChildForm] = useState(defaultChildForm)
  const [pendingChildren, setPendingChildren] = useState([])
  const [editingExistingChildren, setEditingExistingChildren] = useState([])
  const [removedExistingChildIds, setRemovedExistingChildIds] = useState([])
  const [hourlyRatesForm, setHourlyRatesForm] = useState(defaultHourlyRatesForm)
  const [isEditingRates, setIsEditingRates] = useState(false)
  const [editingFamilyId, setEditingFamilyId] = useState(null)

  useEffect(() => {
    loadAll()
  }, [user])

  const loadAll = async () => {
    try {
      setLoading(true)
      setError('')
      clearSyncError()

      if (!user) return

      const [familiesData, childrenData, ratesData, familyIdsWithAttendance] = await Promise.all([
        getFamilies(user.uid),
        getChildren(user.uid),
        getGlobalRates(user.uid),
        getFamilyIdsWithAttendance(user.uid),
      ])

      setFamilies(familiesData)
      setChildren(childrenData)
      setRates(ratesData)
      setFamilyIdsWithLogs(new Set(familyIdsWithAttendance))
      setHourlyRatesForm(toHourlyRatesForm(ratesData))

      if (isOnline && hasPendingSync) {
        markSyncing()
        clearPendingSync()
      }
    } catch (err) {
      setError(err.message)
      markSyncError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveFamily = async (event) => {
    event.preventDefault()
    setError('')

    try {
      let familyId = editingFamilyId
      const typedChildName = childForm.name.trim()

      const childrenToSave = [...pendingChildren]
      if (typedChildName) {
        childrenToSave.push({
          id: crypto.randomUUID(),
          name: typedChildName,
        })
      }

      if (editingFamilyId) {
        await updateFamily(user.uid, editingFamilyId, familyForm)

        for (const child of editingExistingChildren) {
          const nextName = String(child.editableName || '').trim()

          if (!nextName) {
            throw new Error('Child name cannot be empty')
          }

          const currentName = String(child.displayName || child.firstName || '').trim()
          if (nextName !== currentName) {
            await updateChild(user.uid, child.id, {
              displayName: nextName,
              firstName: '',
              lastName: '',
            })
          }
        }

        for (const childId of removedExistingChildIds) {
          await deleteChild(user.uid, childId)
        }
      } else {
        familyId = await addFamily(user.uid, familyForm)
      }

      for (const child of childrenToSave) {
        await addChild(user.uid, {
          familyId,
          displayName: child.name,
        })
      }

      if (!isOnline) {
        markPendingSync()
      }

      setFamilyForm(defaultFamilyForm)
      setChildForm(defaultChildForm)
      setPendingChildren([])
      setEditingExistingChildren([])
      setRemovedExistingChildIds([])
      setShowFamilyForm(false)
      setEditingFamilyId(null)
      await loadAll()
    } catch (err) {
      setError(err.message)
      markSyncError(err.message)
    }
  }

  const handleDeleteFamily = async (familyId) => {
    if (!window.confirm('Delete this family?')) return

    try {
      await deleteFamily(user.uid, familyId)
      await loadAll()
    } catch (err) {
      setError(err.message)
      markSyncError(err.message)
    }
  }

  const startFamilyEdit = (family) => {
    const existingChildren = children.filter((child) => child.familyId === family.id)

    setShowFamilyForm(true)
    setEditingFamilyId(family.id)
    setFamilyForm({
      name: family.name || '',
      contactName: family.contactName || '',
      phone: family.phone || '',
      notes: family.notes || '',
    })
    setEditingExistingChildren(
      existingChildren.map((child) => ({
        ...child,
        editableName: String(child.displayName || child.firstName || '').trim(),
      }))
    )
    setRemovedExistingChildIds([])
    setPendingChildren([])
    setChildForm(defaultChildForm)
  }

  const handleExistingChildNameChange = (childId, value) => {
    setEditingExistingChildren((prev) =>
      prev.map((child) => (child.id === childId ? { ...child, editableName: value } : child))
    )
  }

  const removeExistingChild = (childId) => {
    setEditingExistingChildren((prev) => prev.filter((child) => child.id !== childId))
    setRemovedExistingChildIds((prev) => (prev.includes(childId) ? prev : [...prev, childId]))
  }

  const handleAddChildToForm = (event) => {
    event.preventDefault()

    if (!childForm.name.trim()) {
      setError('Child name is required')
      return
    }

    try {
      setPendingChildren((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: childForm.name.trim(),
        },
      ])
      setChildForm(defaultChildForm)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  const removePendingChild = (id) => {
    setPendingChildren((prev) => prev.filter((child) => child.id !== id))
  }

  const updateTierRate = (childCount, value) => {
    setHourlyRatesForm((prev) => ({
      ...prev,
      tierRates: {
        ...(prev?.tierRates || {}),
        [String(childCount)]: value,
      },
    }))
  }

  const addTier = () => {
    const keys = Object.keys(hourlyRatesForm.tierRates || {}).map(Number)
    const next = keys.length === 0 ? 1 : Math.max(...keys) + 1
    updateTierRate(next, '')
  }

  const saveRates = async () => {
    setError('')

    try {
      const tierRates = Object.keys(hourlyRatesForm.tierRates)
        .sort((a, b) => Number(a) - Number(b))
        .reduce((acc, key) => {
          const value = hourlyRatesForm.tierRates[key]
          if (value === '') {
            return acc
          }
          acc[key] = Number(value)
          return acc
        }, {})

      await updateGlobalRates(user.uid, {
        ...rates,
        minFamilyHourlyRate: Number(hourlyRatesForm.minFamilyHourlyRate),
        minNannyHourlyRate: Number(hourlyRatesForm.minNannyHourlyRate),
        maxNannyHourlyRate: Number(hourlyRatesForm.maxNannyHourlyRate),
        lunchFeePerChild: Number(hourlyRatesForm.lunchFeePerChild),
        hourlyRateByChildCount: tierRates,
      })
      if (!isOnline) {
        markPendingSync()
      }
      setIsEditingRates(false)
      await loadAll()
    } catch (err) {
      setError(err.message)
      markSyncError(err.message)
    }
  }

  const startRatesEdit = () => {
    setHourlyRatesForm(toHourlyRatesForm(rates))
    setIsEditingRates(true)
  }

  const cancelRatesEdit = () => {
    setHourlyRatesForm(toHourlyRatesForm(rates))
    setIsEditingRates(false)
  }

  const childrenByFamily = children.reduce((acc, child) => {
    if (!acc[child.familyId]) {
      acc[child.familyId] = []
    }
    acc[child.familyId].push(child)
    return acc
  }, {})

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-figma-accent"></div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <SyncStatusBanner
          isOnline={isOnline}
          hasPendingSync={hasPendingSync}
          isSyncing={isSyncing}
          syncError={syncError}
          isStaleVersion={isStaleVersion}
        />
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Families</h1>
          {!showFamilyForm && (
            <button
              type="button"
              onClick={() => {
                setShowFamilyForm(true)
                setEditingFamilyId(null)
                setFamilyForm(defaultFamilyForm)
                setChildForm(defaultChildForm)
                setPendingChildren([])
                setEditingExistingChildren([])
                setRemovedExistingChildIds([])
              }}
              className="px-4 py-2 bg-figma-accent text-white rounded-md"
            >
              Add Family
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-figma-error-surface border border-figma-error rounded-md">
            <p className="text-figma-error">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {showFamilyForm && (
            <div className="bg-figma-surface rounded-lg p-6 border border-figma-border">
              <h2 className="text-xl font-bold text-white mb-4">
                {editingFamilyId ? 'Edit Family' : 'Add Family'}
              </h2>
              <form onSubmit={handleSaveFamily} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-figma-text-secondary mb-1">
                    Family Name <span className="text-figma-error">*</span>
                  </label>
                  <input
                    required
                    value={familyForm.name}
                    onChange={(event) => setFamilyForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Family name"
                    className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-figma-text-secondary mb-1">Contact Name</label>
                  <input
                    value={familyForm.contactName}
                    onChange={(event) => setFamilyForm((prev) => ({ ...prev, contactName: event.target.value }))}
                    placeholder="Contact name"
                    className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-figma-text-secondary mb-1">Phone</label>
                  <input
                    value={familyForm.phone}
                    onChange={(event) =>
                      setFamilyForm((prev) => ({
                        ...prev,
                        phone: formatPhoneNumber(event.target.value),
                      }))
                    }
                    placeholder="Phone"
                    className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-figma-text-secondary mb-1">Notes</label>
                  <textarea
                    value={familyForm.notes}
                    onChange={(event) => setFamilyForm((prev) => ({ ...prev, notes: event.target.value }))}
                    placeholder="Notes"
                    rows={3}
                    className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
                  />
                </div>

                <div className="pt-2 border-t border-figma-border">
                  <h3 className="text-lg font-semibold text-white mb-2">Children</h3>
                  {editingFamilyId && editingExistingChildren.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {editingExistingChildren.map((child) => (
                        <div key={child.id} className="flex items-center gap-2">
                          <input
                            value={child.editableName}
                            onChange={(event) => handleExistingChildNameChange(child.id, event.target.value)}
                            className="flex-1 px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
                            placeholder="Child name"
                          />
                          <button
                            type="button"
                            onClick={() => removeExistingChild(child.id)}
                            className="px-3 py-2 bg-figma-error text-white text-sm rounded-md"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-figma-text-secondary mb-1">
                      Child Name <span className="text-figma-error">*</span>
                    </label>
                    <input
                      value={childForm.name}
                      onChange={(event) => setChildForm((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Child name"
                      className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
                    />
                  </div>
                  <button type="button" onClick={handleAddChildToForm} className="px-3 py-2 bg-figma-elevated text-white rounded-md">
                    Add Child
                  </button>

                  {pendingChildren.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {pendingChildren.map((child) => (
                        <div key={child.id} className="flex items-center justify-between bg-figma-elevated p-2 rounded-md">
                          <span className="text-sm text-white">{child.name}</span>
                          <button type="button" onClick={() => removePendingChild(child.id)} className="text-xs text-figma-error hover:underline">
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-figma-accent text-white rounded-md" type="submit">
                    {editingFamilyId ? 'Update Family' : 'Save Family'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFamilyForm(false)
                      setEditingFamilyId(null)
                      setFamilyForm(defaultFamilyForm)
                      setChildForm(defaultChildForm)
                      setPendingChildren([])
                      setEditingExistingChildren([])
                      setRemovedExistingChildIds([])
                    }}
                    className="px-4 py-2 bg-figma-elevated text-white rounded-md"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {!showFamilyForm && (
            <div className="bg-figma-surface rounded-lg p-6 border border-figma-border">
              <h2 className="text-xl font-bold text-white mb-4">Hourly Rates</h2>
              {rates && (
                isEditingRates ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-figma-text-secondary mb-1">Minimum Family Hourly Rate</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#beff8b]">$</span>
                          <input
                            type="number"
                            value={hourlyRatesForm.minFamilyHourlyRate}
                            onChange={(event) =>
                              setHourlyRatesForm((prev) => ({ ...prev, minFamilyHourlyRate: event.target.value }))
                            }
                            className="w-full pl-8 pr-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
                            placeholder="e.g. 12"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-figma-text-secondary mb-1">Lunch Fee Per Child</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#beff8b]">$</span>
                          <input
                            type="number"
                            value={hourlyRatesForm.lunchFeePerChild}
                            onChange={(event) =>
                              setHourlyRatesForm((prev) => ({ ...prev, lunchFeePerChild: event.target.value }))
                            }
                            className="w-full pl-8 pr-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
                            placeholder="e.g. 5"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-figma-text-secondary mb-1">Minimum Nanny Hourly Rate</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#beff8b]">$</span>
                          <input
                            type="number"
                            value={hourlyRatesForm.minNannyHourlyRate}
                            onChange={(event) =>
                              setHourlyRatesForm((prev) => ({ ...prev, minNannyHourlyRate: event.target.value }))
                            }
                            className="w-full pl-8 pr-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
                            placeholder="e.g. 18"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-figma-text-secondary mb-1">Maximum Nanny Hourly Rate</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#beff8b]">$</span>
                          <input
                            type="number"
                            value={hourlyRatesForm.maxNannyHourlyRate}
                            onChange={(event) =>
                              setHourlyRatesForm((prev) => ({ ...prev, maxNannyHourlyRate: event.target.value }))
                            }
                            className="w-full pl-8 pr-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
                            placeholder="e.g. 40"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {Object.keys(hourlyRatesForm.tierRates || {})
                        .map(Number)
                        .sort((a, b) => a - b)
                        .map((key) => (
                          <div key={key}>
                            <label className="block text-sm font-medium text-figma-text-secondary mb-1">Rate for {key} Child{key > 1 ? 'ren' : ''}</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#beff8b]">$</span>
                              <input
                                type="number"
                                value={hourlyRatesForm.tierRates[String(key)]}
                                onChange={(event) => updateTierRate(key, event.target.value)}
                                className="w-full pl-8 pr-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
                                placeholder="e.g. 20"
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={addTier} className="px-3 py-2 bg-figma-elevated text-white rounded-md">
                        Add Tier
                      </button>
                      <button type="button" onClick={saveRates} className="px-3 py-2 bg-figma-accent text-white rounded-md">
                        Save Rates
                      </button>
                      <button type="button" onClick={cancelRatesEdit} className="px-3 py-2 bg-figma-elevated text-white rounded-md">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-figma-elevated rounded-lg border border-figma-border p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-figma-text-secondary">Minimum Family Hourly Rate</p>
                        <p className="text-white font-semibold">${Number(rates.minFamilyHourlyRate || 0).toFixed(2)}</p>
                      </div>
                      <button type="button" onClick={startRatesEdit} className="px-3 py-2 bg-figma-accent text-white rounded-md">
                        Edit
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-sm text-figma-text-secondary">Minimum Nanny Hourly Rate</p>
                        <p className="text-white">${Number(rates.minNannyHourlyRate || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-figma-text-secondary">Maximum Nanny Hourly Rate</p>
                        <p className="text-white">${Number(rates.maxNannyHourlyRate || 0).toFixed(2)}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-figma-text-secondary">Lunch Fee Per Child</p>
                      <p className="text-white">${Number(rates.lunchFeePerChild || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-figma-text-secondary mb-1">Rates by Child Count</p>
                      <div className="space-y-1">
                        {Object.keys(rates.hourlyRateByChildCount || {})
                          .map(Number)
                          .sort((a, b) => a - b)
                          .map((key) => (
                            <p key={key} className="text-sm text-white">
                              {key} Child{key > 1 ? 'ren' : ''}: ${Number(rates.hourlyRateByChildCount[String(key)] || 0).toFixed(2)}
                            </p>
                          ))}
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {families.length === 0 ? (
          <div className="text-center py-12 bg-figma-surface rounded-lg border border-figma-border">
            <p className="text-figma-text-secondary">No families yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {families
              .filter((family) => !(showFamilyForm && editingFamilyId === family.id))
              .map((family) => (
              <div key={family.id} className="bg-figma-surface rounded-lg border border-figma-border p-6">
                <h3 className="text-lg font-bold text-white mb-2">{family.name}</h3>
                {family.contactName && (
                  <p className="text-sm text-figma-text-secondary">{family.contactName}</p>
                )}
                {family.phone && (
                  <p className="text-sm text-figma-text-secondary">{family.phone}</p>
                )}

                <div className="mt-4 mb-4">
                  <p className="text-sm text-figma-text-secondary mb-2">Children</p>
                  {(childrenByFamily[family.id] || []).length === 0 ? (
                    <p className="text-sm text-figma-text-placeholder">No children yet</p>
                  ) : (
                    <div className="space-y-2">
                      {(childrenByFamily[family.id] || []).map((child) => (
                        <div key={child.id} className="bg-figma-elevated p-2 rounded-md">
                          <span className="text-sm text-white">{child.displayName || child.firstName}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {familyIdsWithLogs.has(family.id) && (
                    <button
                      onClick={() => navigate(`/families/${family.id}/logs`)}
                      className="px-3 py-2 bg-figma-accent text-white text-sm rounded-md"
                    >
                      Family Logs
                    </button>
                  )}
                  <button onClick={() => startFamilyEdit(family)} className="px-3 py-2 bg-figma-elevated text-white text-sm rounded-md">
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteFamily(family.id)}
                    className="px-3 py-2 bg-figma-error text-white text-sm rounded-md"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
