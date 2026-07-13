import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { getFamilies } from '../services/familyService'
import { getChildren } from '../services/childService'
import {
  getAttendanceByFamilyDateRange,
  updateAttendance,
  deleteAttendance,
} from '../services/attendanceService'

function defaultDateRange() {
  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]
  return { startDate, endDate }
}

export default function FamilyLogs() {
  const { user } = useAuth()
  const { familyId } = useParams()
  const navigate = useNavigate()

  const [family, setFamily] = useState(null)
  const [children, setChildren] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingEntryId, setEditingEntryId] = useState(null)
  const [editForm, setEditForm] = useState({
    childId: '',
    date: '',
    startTime: '09:00',
    endTime: '12:00',
    notes: '',
    lunchBrought: true,
  })
  const [dateRange, setDateRange] = useState(defaultDateRange)

  useEffect(() => {
    loadData()
  }, [user, familyId, dateRange.startDate, dateRange.endDate])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      if (!user || !familyId) return

      const [families, familyChildren, familyEntries] = await Promise.all([
        getFamilies(user.uid),
        getChildren(user.uid, { familyId, activeOnly: true }),
        getAttendanceByFamilyDateRange(user.uid, familyId, dateRange.startDate, dateRange.endDate),
      ])

      const selectedFamily = families.find((entry) => entry.id === familyId)
      if (!selectedFamily) {
        setError('Family not found')
        return
      }

      setFamily(selectedFamily)
      setChildren(familyChildren)
      setEntries(familyEntries)
    } catch (err) {
      setError(err.message)
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

  const startEdit = (entry) => {
    setError('')
    setSuccess('')
    setEditingEntryId(entry.id)
    setEditForm({
      childId: entry.childId,
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      notes: entry.notes || '',
      lunchBrought: Boolean(entry.lunchBrought),
    })
  }

  const cancelEdit = () => {
    setEditingEntryId(null)
    setEditForm({
      childId: '',
      date: '',
      startTime: '09:00',
      endTime: '12:00',
      notes: '',
      lunchBrought: true,
    })
  }

  const saveEdit = async () => {
    if (!editingEntryId || !user || !family) return

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      await updateAttendance(user.uid, editingEntryId, {
        childId: editForm.childId,
        familyId: family.id,
        date: editForm.date,
        startTime: editForm.startTime,
        endTime: editForm.endTime,
        notes: editForm.notes,
        lunchBrought: Boolean(editForm.lunchBrought),
      })

      setSuccess('Attendance updated successfully')
      cancelEdit()
      await loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (entryId) => {
    if (!user) return
    if (!window.confirm('Delete this attendance entry?')) return

    try {
      await deleteAttendance(user.uid, entryId)
      if (editingEntryId === entryId) {
        cancelEdit()
      }
      await loadData()
      setSuccess('Entry deleted successfully')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    }
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Family Logs</h1>
            <p className="text-figma-text-secondary mt-1">{family ? family.name : 'Unknown Family'}</p>
          </div>
          <button
            onClick={() => navigate('/families')}
            className="px-4 py-2 bg-figma-elevated text-white rounded-md hover:bg-[#464646] transition"
          >
            Back to Families
          </button>
        </div>

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

        {!family ? (
          <div className="bg-figma-surface rounded-lg border border-figma-border p-6">
            <p className="text-figma-text-secondary mb-4">This family could not be found.</p>
            <Link to="/families" className="text-figma-accent font-medium hover:underline">
              Go back to Families
            </Link>
          </div>
        ) : (
          <>
            <div className="bg-figma-surface rounded-lg border border-figma-border p-6 mb-6">
              <h2 className="text-xl font-bold text-white mb-4">Filter by Date</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(event) =>
                    setDateRange((prev) => ({
                      ...prev,
                      startDate: event.target.value,
                    }))
                  }
                  className="px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
                />
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(event) =>
                    setDateRange((prev) => ({
                      ...prev,
                      endDate: event.target.value,
                    }))
                  }
                  className="px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
                />
                <button onClick={loadData} className="px-4 py-2 bg-figma-accent text-white rounded-md">
                  Refresh
                </button>
              </div>
            </div>

            <div className="bg-figma-surface rounded-lg border border-figma-border p-6 mb-6">
              <h2 className="text-xl font-bold text-white mb-4">
                {editingEntryId ? 'Edit Attendance Entry' : 'Select an Entry to Edit'}
              </h2>

              {editingEntryId ? (
                <div className="space-y-3">
                  <select
                    value={editForm.childId}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, childId: event.target.value }))}
                    className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
                  >
                    {children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.displayName || child.firstName}
                      </option>
                    ))}
                  </select>

                  <input
                    type="date"
                    value={editForm.date}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, date: event.target.value }))}
                    className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="time"
                      value={editForm.startTime}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, startTime: event.target.value }))}
                      className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
                    />
                    <input
                      type="time"
                      value={editForm.endTime}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, endTime: event.target.value }))}
                      className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
                    />
                  </div>

                  <label className="text-sm text-figma-text-secondary flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editForm.lunchBrought}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, lunchBrought: event.target.checked }))}
                    />
                    Lunch brought from home
                  </label>

                  <textarea
                    value={editForm.notes}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))}
                    className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
                    rows={2}
                    placeholder="Notes"
                  />

                  <div className="flex gap-2">
                    <button onClick={saveEdit} disabled={saving} className="px-4 py-2 bg-figma-accent text-white rounded-md">
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={cancelEdit} className="px-4 py-2 bg-figma-elevated text-white rounded-md">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-figma-text-secondary">Click Edit in the table below.</p>
              )}
            </div>

            <div className="overflow-x-auto bg-figma-surface border border-figma-border rounded-lg">
              <table className="w-full border-collapse">
                <thead className="bg-figma-elevated">
                  <tr>
                    <th className="border border-figma-border px-4 py-2 text-left text-figma-text-secondary">Date</th>
                    <th className="border border-figma-border px-4 py-2 text-left text-figma-text-secondary">Child</th>
                    <th className="border border-figma-border px-4 py-2 text-center text-figma-text-secondary">Time</th>
                    <th className="border border-figma-border px-4 py-2 text-center text-figma-text-secondary">Home Lunch</th>
                    <th className="border border-figma-border px-4 py-2 text-left text-figma-text-secondary">Notes</th>
                    <th className="border border-figma-border px-4 py-2 text-center text-figma-text-secondary">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-figma-text-secondary">
                        No attendance entries in this date range.
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-figma-elevated">
                        <td className="border border-figma-border px-4 py-2 text-white">{entry.date}</td>
                        <td className="border border-figma-border px-4 py-2 text-white">
                          {childNameById[entry.childId] || 'Unknown Child'}
                        </td>
                        <td className="border border-figma-border px-4 py-2 text-center text-white">
                          {entry.startTime} - {entry.endTime}
                        </td>
                        <td className="border border-figma-border px-4 py-2 text-center text-white">
                          {entry.lunchBrought ? 'Yes' : 'No'}
                        </td>
                        <td className="border border-figma-border px-4 py-2 text-white">{entry.notes || '-'}</td>
                        <td className="border border-figma-border px-4 py-2 text-center">
                          <button onClick={() => startEdit(entry)} className="text-figma-accent hover:underline mr-3">
                            Edit
                          </button>
                          <button onClick={() => handleDelete(entry.id)} className="text-figma-error hover:underline">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  )
}
