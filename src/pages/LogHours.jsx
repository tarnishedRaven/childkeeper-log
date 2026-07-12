import { useEffect, useMemo, useState } from 'react'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { getFamilies } from '../services/familyService'
import { getChildren } from '../services/childService'
import {
  addAttendanceBatch,
  getRecentAttendance,
  updateAttendance,
  deleteAttendance,
} from '../services/attendanceService'
import SyncStatusBanner from '../components/SyncStatusBanner'
import useConnectivityStatus from '../hooks/useConnectivityStatus'

function todayIsoDate() {
  return new Date().toISOString().split('T')[0]
}

const defaultFormData = {
  selectedChildIds: [],
  date: todayIsoDate(),
  startTime: '09:00',
  endTime: '12:00',
  notes: '',
  lunchByChild: {},
  childTimesById: {},
}

export default function LogHours() {
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

  const [families, setFamilies] = useState([])
  const [children, setChildren] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingEntryId, setEditingEntryId] = useState(null)
  const [editingEntryFamilyId, setEditingEntryFamilyId] = useState('')
  const [editingChildId, setEditingChildId] = useState('')
  const [formData, setFormData] = useState(defaultFormData)

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')
      clearSyncError()

      if (!user) return

      const [familiesData, childrenData, entriesData] = await Promise.all([
        getFamilies(user.uid),
        getChildren(user.uid),
        getRecentAttendance(user.uid, 25),
      ])

      setFamilies(familiesData)
      setChildren(childrenData)
      setEntries(entriesData)

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

  const childNameById = useMemo(
    () =>
      children.reduce((acc, child) => {
        acc[child.id] = child.displayName || child.firstName || 'Unknown Child'
        return acc
      }, {}),
    [children]
  )

  const childById = useMemo(
    () =>
      children.reduce((acc, child) => {
        acc[child.id] = child
        return acc
      }, {}),
    [children]
  )

  const toggleChildSelection = (childId) => {
    setFormData((prev) => {
      const exists = prev.selectedChildIds.includes(childId)
      const selectedChildIds = exists
        ? prev.selectedChildIds.filter((id) => id !== childId)
        : [...prev.selectedChildIds, childId].sort((a, b) => a.localeCompare(b))

      const childTimesById = { ...prev.childTimesById }
      const lunchByChild = { ...prev.lunchByChild }

      if (exists) {
        delete childTimesById[childId]
        delete lunchByChild[childId]
      } else {
        childTimesById[childId] = {
          startTime: prev.startTime,
          endTime: prev.endTime,
        }
      }

      return {
        ...prev,
        selectedChildIds,
        childTimesById,
        lunchByChild,
      }
    })
  }

  const updateChildTime = (childId, key, value) => {
    setFormData((prev) => ({
      ...prev,
      childTimesById: {
        ...prev.childTimesById,
        [childId]: {
          ...(prev.childTimesById[childId] || {
            startTime: prev.startTime,
            endTime: prev.endTime,
          }),
          [key]: value,
        },
      },
    }))
  }

  const toggleLunchForChild = (childId, checked) => {
    setFormData((prev) => ({
      ...prev,
      lunchByChild: {
        ...prev.lunchByChild,
        [childId]: checked,
      },
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    try {
      if (editingEntryId) {
        const editTimes = formData.childTimesById[editingChildId] || {
          startTime: formData.startTime,
          endTime: formData.endTime,
        }

        const resolvedFamilyId = childById[editingChildId]?.familyId || editingEntryFamilyId
        if (!resolvedFamilyId) {
          throw new Error('Unable to determine family for selected child')
        }

        await updateAttendance(user.uid, editingEntryId, {
          childId: editingChildId,
          familyId: resolvedFamilyId,
          date: formData.date,
          startTime: editTimes.startTime,
          endTime: editTimes.endTime,
          lunchBrought: Boolean(formData.lunchByChild[editingChildId]),
          notes: formData.notes,
          numChildren: 1,
        })
        setSuccess('Attendance updated successfully')
      } else {
        if (formData.selectedChildIds.length === 0) {
          throw new Error('Select at least one child')
        }

        const payload = formData.selectedChildIds.map((childId) => {
          const child = childById[childId]
          if (!child?.familyId) {
            throw new Error('Each selected child must belong to a family')
          }

          const times = formData.childTimesById[childId] || {
            startTime: formData.startTime,
            endTime: formData.endTime,
          }

          return {
            childId,
            familyId: child.familyId,
            date: formData.date,
            startTime: times.startTime,
            endTime: times.endTime,
            lunchBrought: Boolean(formData.lunchByChild[childId]),
            notes: formData.notes,
            numChildren: formData.selectedChildIds.length,
          }
        })

        await addAttendanceBatch(user.uid, payload)
        setSuccess('Attendance logged successfully')
      }

      if (!isOnline) {
        markPendingSync()
      }

      setEditingEntryId(null)
  setEditingEntryFamilyId('')
      setEditingChildId('')
      setFormData(defaultFormData)
      await loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
      markSyncError(err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this attendance entry?')) return

    try {
      await deleteAttendance(user.uid, id)
      if (!isOnline) {
        markPendingSync()
      }
      await loadData()
    } catch (err) {
      setError(err.message)
      markSyncError(err.message)
    }
  }

  const handleEdit = (entry) => {
    setEditingEntryId(entry.id)
    setEditingEntryFamilyId(entry.familyId)
    setEditingChildId(entry.childId)
    setFormData({
      selectedChildIds: [entry.childId],
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      notes: entry.notes || '',
      lunchByChild: {
        [entry.childId]: Boolean(entry.lunchBrought),
      },
      childTimesById: {
        [entry.childId]: {
          startTime: entry.startTime,
          endTime: entry.endTime,
        },
      },
    })
  }

  const handleCancelEdit = () => {
    setEditingEntryId(null)
    setEditingEntryFamilyId('')
    setEditingChildId('')
    setFormData(defaultFormData)
  }

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
        <h1 className="text-3xl font-bold text-white mb-8">Log Attendance</h1>

        {error && (
          <div className="mb-4 p-4 bg-figma-error-surface border border-figma-error rounded-md">
            <p className="text-figma-error">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-figma-success-surface border border-figma-success rounded-md">
            <p className="text-figma-success">{success}</p>
          </div>
        )}

        {children.length === 0 ? (
          <div className="bg-figma-surface border border-figma-border rounded-lg p-6">
            <p className="text-figma-text-secondary">Add families and children before logging attendance.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-figma-surface rounded-lg border border-figma-border p-6">
              <h2 className="text-xl font-bold text-white mb-4">
                {editingEntryId ? 'Edit Attendance' : 'New Attendance'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-figma-text-secondary mb-1">Children</label>
                  <div className="max-h-40 overflow-auto space-y-2 bg-figma-elevated border border-figma-border rounded-md p-3">
                    {children.length === 0 ? (
                      <p className="text-sm text-figma-text-placeholder">No children available</p>
                    ) : (
                      children.map((child) => (
                        <label key={child.id} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-white">{child.displayName || child.firstName}</span>
                          <span className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              disabled={editingEntryId && child.id !== editingChildId}
                              checked={formData.selectedChildIds.includes(child.id)}
                              onChange={() => toggleChildSelection(child.id)}
                            />
                            <label className="text-xs text-figma-text-secondary flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={Boolean(formData.lunchByChild[child.id])}
                                onChange={(event) => toggleLunchForChild(child.id, event.target.checked)}
                                disabled={!formData.selectedChildIds.includes(child.id)}
                              />
                              Lunch brought
                            </label>
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-figma-text-secondary mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(event) => setFormData((prev) => ({ ...prev, date: event.target.value }))}
                    className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
                  />
                </div>

                {editingEntryId ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="time"
                      required
                      value={formData.childTimesById[editingChildId]?.startTime || formData.startTime}
                      onChange={(event) => updateChildTime(editingChildId, 'startTime', event.target.value)}
                      className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
                    />
                    <input
                      type="time"
                      required
                      value={formData.childTimesById[editingChildId]?.endTime || formData.endTime}
                      onChange={(event) => updateChildTime(editingChildId, 'endTime', event.target.value)}
                      className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-figma-text-secondary mb-1">Times By Child</label>
                    {formData.selectedChildIds.length === 0 ? (
                      <p className="text-sm text-figma-text-placeholder">Select children to set individual start and end times</p>
                    ) : (
                      formData.selectedChildIds.map((childId) => (
                        <div key={childId} className="bg-figma-elevated border border-figma-border rounded-md p-3 space-y-2">
                          <p className="text-sm text-white">{childNameById[childId] || 'Unknown Child'}</p>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="time"
                              required
                              value={formData.childTimesById[childId]?.startTime || formData.startTime}
                              onChange={(event) => updateChildTime(childId, 'startTime', event.target.value)}
                              className="w-full px-3 py-2 border border-figma-border bg-figma-surface text-white rounded-md"
                            />
                            <input
                              type="time"
                              required
                              value={formData.childTimesById[childId]?.endTime || formData.endTime}
                              onChange={(event) => updateChildTime(childId, 'endTime', event.target.value)}
                              className="w-full px-3 py-2 border border-figma-border bg-figma-surface text-white rounded-md"
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                <textarea
                  value={formData.notes}
                  onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                  className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
                  rows={2}
                  placeholder="Notes"
                />

                <div className="flex gap-2">
                  <button type="submit" className="flex-1 px-4 py-2 bg-figma-accent text-white rounded-md">
                    {editingEntryId ? 'Update' : 'Save Attendance'}
                  </button>
                  {editingEntryId && (
                    <button type="button" onClick={handleCancelEdit} className="px-4 py-2 bg-figma-elevated text-white rounded-md">
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="lg:col-span-2">
              <h2 className="text-xl font-bold text-white mb-4">Recent Attendance</h2>
              {entries.length === 0 ? (
                <div className="text-center py-8 bg-figma-surface rounded-lg border border-figma-border">
                  <p className="text-figma-text-secondary">No attendance yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-figma-border">
                    <thead className="bg-figma-elevated">
                      <tr>
                        <th className="border border-figma-border px-4 py-2 text-left text-figma-text-secondary">Date</th>
                        <th className="border border-figma-border px-4 py-2 text-left text-figma-text-secondary">Family</th>
                        <th className="border border-figma-border px-4 py-2 text-left text-figma-text-secondary">Child</th>
                        <th className="border border-figma-border px-4 py-2 text-center text-figma-text-secondary">Time</th>
                        <th className="border border-figma-border px-4 py-2 text-center text-figma-text-secondary">Lunch</th>
                        <th className="border border-figma-border px-4 py-2 text-center text-figma-text-secondary">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => {
                        const family = families.find((row) => row.id === entry.familyId)
                        return (
                          <tr key={entry.id} className="hover:bg-figma-elevated">
                            <td className="border border-figma-border px-4 py-2 text-white">{entry.date}</td>
                            <td className="border border-figma-border px-4 py-2 text-white">{family?.name || 'Unknown'}</td>
                            <td className="border border-figma-border px-4 py-2 text-white">
                              {childNameById[entry.childId] || 'Unknown Child'}
                            </td>
                            <td className="border border-figma-border px-4 py-2 text-center text-white">
                              {entry.startTime} - {entry.endTime}
                            </td>
                            <td className="border border-figma-border px-4 py-2 text-center text-white">
                              {entry.lunchBrought ? 'Home' : 'Fee'}
                            </td>
                            <td className="border border-figma-border px-4 py-2 text-center">
                              <button onClick={() => handleEdit(entry)} className="text-figma-accent hover:underline mr-3">
                                Edit
                              </button>
                              <button onClick={() => handleDelete(entry.id)} className="text-figma-error hover:underline">
                                Delete
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
