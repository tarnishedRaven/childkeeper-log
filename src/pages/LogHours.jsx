import { useEffect, useMemo, useState } from 'react'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { getFamilies } from '../services/familyService'
import { getChildren } from '../services/childService'
import { useFormDraft } from '../hooks/useFormDraft'
import {
  addAttendanceBatch,
  backfillAttendanceSortKeys,
  getAttendancePage,
  getAttendanceTotalCount,
  updateAttendance,
  deleteAttendance,
} from '../services/attendanceService'
import SyncStatusBanner from '../components/SyncStatusBanner'
import useConnectivityStatus from '../hooks/useConnectivityStatus'
import { formatDisplayDate, formatTime12Hour } from '../utils/timeFormatting'

function todayIsoDate() {
  return new Date().toISOString().split('T')[0]
}

const defaultFormData = {
  selectedChildIds: [],
  date: todayIsoDate(),
  startTime: '09:00',
  endTime: '12:00',
  bulkStartTime: '09:00',
  bulkEndTime: '12:00',
  notes: '',
  lunchByChild: {},
  childTimesById: {},
}

const PAGE_SIZE = 25

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
  const [isDataLoaded, setIsDataLoaded] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingEntryId, setEditingEntryId] = useState(null)
  const [editingEntryFamilyId, setEditingEntryFamilyId] = useState('')
  const [editingChildId, setEditingChildId] = useState('')
  const [formData, setFormData] = useState(defaultFormData)
  const { hasDraft, saveDraft, restoreDraft, clearDraft } = useFormDraft(formData, defaultFormData, isDataLoaded)
  const [showDraftPrompt, setShowDraftPrompt] = useState(false)
  const [sortCol, setSortCol] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [pageIndex, setPageIndex] = useState(0)
  const [pageCursors, setPageCursors] = useState([])
  const [hasNextPage, setHasNextPage] = useState(false)
  const [hasPrevPage, setHasPrevPage] = useState(false)
  const [paging, setPaging] = useState(false)
  const [repairingSortKeys, setRepairingSortKeys] = useState(false)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    loadData()
  }, [user])

  // Check for draft after data loads
  useEffect(() => {
    if (hasDraft && !editingEntryId && user && !showDraftPrompt) {
      // Peek at the draft to check if it has children selected
      const draft = restoreDraft()
      if (draft && draft.selectedChildIds && draft.selectedChildIds.length > 0) {
        setShowDraftPrompt(true)
      }
    }
  }, [hasDraft, user, editingEntryId, showDraftPrompt, restoreDraft])

  // Auto-save form data (but not while draft prompt is showing or if no children selected)
  useEffect(() => {
    if (!showDraftPrompt && formData.selectedChildIds.length > 0) {
      saveDraft()
    }
  }, [formData, saveDraft, showDraftPrompt])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')
      clearSyncError()

      if (!user) return

      const [familiesData, childrenData, pageData, totalCount] = await Promise.all([
        getFamilies(user.uid),
        getChildren(user.uid),
        getAttendancePage(user.uid, {
          pageSize: PAGE_SIZE,
          sortKey: sortCol,
          sortDir,
        }),
        getAttendanceTotalCount(user.uid),
      ])

      setFamilies(familiesData)
      setChildren(childrenData)
      setEntries(pageData.rows)
      setPageIndex(0)
      setPageCursors([
        {
          first: pageData.firstCursor,
          last: pageData.lastCursor,
        },
      ])
      setHasPrevPage(pageData.hasPrev)
      setHasNextPage(pageData.hasNext)
      setTotalPages(Math.max(1, Math.ceil(totalCount / PAGE_SIZE)))

      if (isOnline && hasPendingSync) {
        markSyncing()
        clearPendingSync()
      }
    } catch (err) {
      setError(err.message)
      markSyncError(err.message)
    } finally {
      setLoading(false)
      setIsDataLoaded(true)
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

  const paginationLabel = useMemo(
    () => `Page ${pageIndex + 1} of ${totalPages}`,
    [pageIndex, totalPages]
  )

  const paginationTokens = useMemo(() => {
    const tokens = []
    const firstPageLimit = Math.min(3, totalPages)
    for (let page = 1; page <= firstPageLimit; page += 1) {
      tokens.push(page)
    }

    const currentPage = pageIndex + 1
    if (totalPages > 3) {
      if (currentPage > 3 && currentPage < totalPages) {
        tokens.push('ellipsis-current')
        tokens.push(currentPage)
      }
      if (currentPage < totalPages - 1) {
        tokens.push('ellipsis-last')
      }
      if (currentPage >= totalPages && !tokens.includes(totalPages)) {
        tokens.push(totalPages)
      } else if (currentPage < totalPages && totalPages > 3) {
        tokens.push(totalPages)
      }
    }

    return tokens
  }, [pageIndex, totalPages])

  const loadPage = async ({ direction = 'next', cursor = null, nextPageIndex = 0 }) => {
    if (!user) return

    try {
      setPaging(true)
      setError('')

      const pageData = await getAttendancePage(user.uid, {
        pageSize: PAGE_SIZE,
        sortKey: sortCol,
        sortDir,
        direction,
        cursor,
      })

      setEntries(pageData.rows)
      setPageIndex(nextPageIndex)
      setHasPrevPage(pageData.hasPrev)
      setHasNextPage(pageData.hasNext)
      setPageCursors((prev) => {
        const next = [...prev]
        next[nextPageIndex] = {
          first: pageData.firstCursor,
          last: pageData.lastCursor,
        }
        return next
      })
    } catch (err) {
      setError(err.message)
      markSyncError(err.message)
    } finally {
      setPaging(false)
    }
  }

  const resetAndLoadSortedFirstPage = async (nextSortCol, nextSortDir) => {
    if (!user) return

    try {
      setPaging(true)
      setError('')
      const pageData = await getAttendancePage(user.uid, {
        pageSize: PAGE_SIZE,
        sortKey: nextSortCol,
        sortDir: nextSortDir,
      })

      setEntries(pageData.rows)
      setPageIndex(0)
      setHasPrevPage(pageData.hasPrev)
      setHasNextPage(pageData.hasNext)
      setPageCursors([
        {
          first: pageData.firstCursor,
          last: pageData.lastCursor,
        },
      ])
    } catch (err) {
      setError(err.message)
      markSyncError(err.message)
    } finally {
      setPaging(false)
    }
  }

  const jumpToPage = async (targetPageIndex) => {
    if (!user || paging) return
    if (targetPageIndex === pageIndex || targetPageIndex < 0 || targetPageIndex >= totalPages) return

    try {
      setPaging(true)
      setError('')

      if (targetPageIndex === 0) {
        const firstPage = await getAttendancePage(user.uid, {
          pageSize: PAGE_SIZE,
          sortKey: sortCol,
          sortDir,
        })

        setEntries(firstPage.rows)
        setPageIndex(0)
        setHasPrevPage(firstPage.hasPrev)
        setHasNextPage(firstPage.hasNext)
        setPageCursors([
          {
            first: firstPage.firstCursor,
            last: firstPage.lastCursor,
          },
        ])
        return
      }

      let currentIndex = pageIndex
      let currentPage = {
        first: pageCursors[pageIndex]?.first || null,
        last: pageCursors[pageIndex]?.last || null,
      }
      let finalPageData = {
        rows: entries,
        hasPrev: hasPrevPage,
        hasNext: hasNextPage,
      }
      const nextCursors = [...pageCursors]

      while (currentIndex < targetPageIndex) {
        if (!currentPage.last) break
        const pageData = await getAttendancePage(user.uid, {
          pageSize: PAGE_SIZE,
          sortKey: sortCol,
          sortDir,
          direction: 'next',
          cursor: currentPage.last,
        })

        currentIndex += 1
        currentPage = {
          first: pageData.firstCursor,
          last: pageData.lastCursor,
        }
        nextCursors[currentIndex] = currentPage
        finalPageData = pageData
      }

      while (currentIndex > targetPageIndex) {
        if (!currentPage.first) break
        const pageData = await getAttendancePage(user.uid, {
          pageSize: PAGE_SIZE,
          sortKey: sortCol,
          sortDir,
          direction: 'prev',
          cursor: currentPage.first,
        })

        currentIndex -= 1
        currentPage = {
          first: pageData.firstCursor,
          last: pageData.lastCursor,
        }
        nextCursors[currentIndex] = currentPage
        finalPageData = pageData
      }

      setEntries(finalPageData.rows)
      setPageIndex(currentIndex)
      setHasPrevPage(finalPageData.hasPrev)
      setHasNextPage(finalPageData.hasNext)
      setPageCursors(nextCursors)
    } catch (err) {
      setError(err.message)
      markSyncError(err.message)
    } finally {
      setPaging(false)
    }
  }

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
          startTime: prev.bulkStartTime,
          endTime: prev.bulkEndTime,
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

  const updateBulkTime = (key, value) => {
    setFormData((prev) => {
      const bulkStartTime = key === 'bulkStartTime' ? value : prev.bulkStartTime
      const bulkEndTime = key === 'bulkEndTime' ? value : prev.bulkEndTime
      const childTimesById = { ...prev.childTimesById }

      prev.selectedChildIds.forEach((childId) => {
        childTimesById[childId] = {
          ...(childTimesById[childId] || {}),
          startTime: bulkStartTime,
          endTime: bulkEndTime,
        }
      })

      return {
        ...prev,
        bulkStartTime,
        bulkEndTime,
        childTimesById,
      }
    })
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

      clearDraft()
      setEditingEntryId(null)
      setEditingEntryFamilyId('')
      setEditingChildId('')
      setFormData(defaultFormData)
      setShowDraftPrompt(false)
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
      bulkStartTime: entry.startTime,
      bulkEndTime: entry.endTime,
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

  const handleSort = (col) => {
    if (sortCol === col) {
      const nextDir = sortDir === 'asc' ? 'desc' : 'asc'
      setSortDir(nextDir)
      resetAndLoadSortedFirstPage(col, nextDir)
    } else {
      setSortCol(col)
      setSortDir('asc')
      resetAndLoadSortedFirstPage(col, 'asc')
    }
  }

  const handleNextPage = async () => {
    if (pageIndex >= totalPages - 1 || paging) return
    const currentPage = pageCursors[pageIndex]
    if (!currentPage?.last) {
      await jumpToPage(pageIndex + 1)
      return
    }
    await loadPage({
      direction: 'next',
      cursor: currentPage.last,
      nextPageIndex: pageIndex + 1,
    })
  }

  const handlePrevPage = async () => {
    if (pageIndex <= 0 || paging) return
    const currentPage = pageCursors[pageIndex]
    if (!currentPage?.first) {
      await jumpToPage(pageIndex - 1)
      return
    }
    await loadPage({
      direction: 'prev',
      cursor: currentPage.first,
      nextPageIndex: pageIndex - 1,
    })
  }

  const handleRepairSortKeys = async () => {
    if (!user) return
    if (!isOnline) {
      setError('Reconnect to run attendance sort repair')
      return
    }

    if (!window.confirm('Repair attendance sorting data for this account?')) {
      return
    }

    try {
      setRepairingSortKeys(true)
      setError('')
      setSuccess('')
      const updatedCount = await backfillAttendanceSortKeys(user.uid)
      await loadData()
      setSuccess(
        updatedCount > 0
          ? `Repaired sorting data for ${updatedCount} attendance entr${updatedCount === 1 ? 'y' : 'ies'}`
          : 'Attendance sorting data is already up to date'
      )
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
      markSyncError(err.message)
    } finally {
      setRepairingSortKeys(false)
    }
  }

  const handleRestoreDraft = () => {
    const draft = restoreDraft()
    if (draft) {
      setFormData(draft)
      clearDraft() // Remove draft from localStorage after restoring
      setShowDraftPrompt(false)
      setSuccess('Draft restored')
      setTimeout(() => setSuccess(''), 2000)
    } else {
      console.warn('No draft found to restore')
      setShowDraftPrompt(false)
    }
  }

  const handleDiscardDraft = () => {
    clearDraft()
    setShowDraftPrompt(false)
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

        {showDraftPrompt && (
          <div className="mb-4 p-4 bg-figma-elevated border-l-4 border-figma-accent rounded-md flex items-center justify-between gap-4">
            <p className="text-figma-text-secondary">You have unsaved changes. Would you like to restore them?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRestoreDraft}
                className="px-4 py-2 bg-figma-accent text-white rounded-md hover:opacity-90"
              >
                Restore
              </button>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="px-4 py-2 bg-figma-elevated text-figma-text-secondary border border-figma-border rounded-md hover:bg-figma-border"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold text-white">Log Attendance</h1>
          {/* <button
            type="button"
            onClick={handleRepairSortKeys}
            disabled={!isOnline || repairingSortKeys}
            className="px-4 py-2 bg-figma-elevated text-white rounded-md disabled:opacity-60"
          >
            {repairingSortKeys ? 'Repairing Sort Data...' : 'Repair Attendance Sorting'}
          </button> */}
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
                  <div className="space-y-2 bg-figma-elevated border border-figma-border rounded-md p-3">
                    {children.length === 0 ? (
                      <p className="text-sm text-figma-text-placeholder">No children available</p>
                    ) : (
                      children.map((child) => (
                        <label key={child.id} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-white">{child.displayName || child.firstName}</span>
                          <span className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              aria-label={`Select ${child.displayName || child.firstName || 'Unknown Child'}`}
                              disabled={editingEntryId && child.id !== editingChildId}
                              checked={formData.selectedChildIds.includes(child.id)}
                              onChange={() => toggleChildSelection(child.id)}
                            />
                            <label className="text-xs text-figma-text-secondary flex items-center gap-1">
                              <input
                                type="checkbox"
                                aria-label={`Lunch brought for ${child.displayName || child.firstName || 'Unknown Child'}`}
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
                    className="ios-compact-picker w-full min-w-0 px-2.5 sm:px-3 py-2 text-sm sm:text-base border border-figma-border bg-figma-elevated text-white rounded-md"
                  />
                </div>

                {editingEntryId ? (
                  <div className="grid grid-cols-2 gap-2 min-w-0">
                    <input
                      type="time"
                      required
                      value={formData.childTimesById[editingChildId]?.startTime || formData.startTime}
                      onChange={(event) => updateChildTime(editingChildId, 'startTime', event.target.value)}
                      className="ios-compact-picker w-full min-w-0 px-2 sm:px-3 py-2 text-sm sm:text-base border border-figma-border bg-figma-elevated text-white rounded-md"
                    />
                    <input
                      type="time"
                      required
                      value={formData.childTimesById[editingChildId]?.endTime || formData.endTime}
                      onChange={(event) => updateChildTime(editingChildId, 'endTime', event.target.value)}
                      className="ios-compact-picker w-full min-w-0 px-2 sm:px-3 py-2 text-sm sm:text-base border border-figma-border bg-figma-elevated text-white rounded-md"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-figma-elevated border border-figma-border rounded-md p-3 space-y-2">
                      <label className="block text-sm font-medium text-figma-text-secondary">Set same time for selected children</label>
                      <div className="grid grid-cols-2 gap-2 min-w-0">
                        <input
                          type="time"
                          required
                          aria-label="Bulk Start Time"
                          value={formData.bulkStartTime}
                          disabled={formData.selectedChildIds.length === 0}
                          onChange={(event) => updateBulkTime('bulkStartTime', event.target.value)}
                          className="ios-compact-picker w-full min-w-0 px-2 sm:px-3 py-2 text-sm sm:text-base border border-figma-border bg-figma-surface text-white rounded-md disabled:opacity-60"
                        />
                        <input
                          type="time"
                          required
                          aria-label="Bulk End Time"
                          value={formData.bulkEndTime}
                          disabled={formData.selectedChildIds.length === 0}
                          onChange={(event) => updateBulkTime('bulkEndTime', event.target.value)}
                          className="ios-compact-picker w-full min-w-0 px-2 sm:px-3 py-2 text-sm sm:text-base border border-figma-border bg-figma-surface text-white rounded-md disabled:opacity-60"
                        />
                      </div>
                      <p className="text-xs text-figma-text-secondary">
                        Applies to {formData.selectedChildIds.length} selected child
                        {formData.selectedChildIds.length === 1 ? '' : 'ren'} and overwrites existing per-child times.
                      </p>
                    </div>

                    <label className="block text-sm font-medium text-figma-text-secondary mb-1">Times By Child</label>
                    {formData.selectedChildIds.length === 0 ? (
                      <p className="text-sm text-figma-text-placeholder">Select children to set individual start and end times</p>
                    ) : (
                      formData.selectedChildIds.map((childId) => (
                        <div key={childId} className="bg-figma-elevated border border-figma-border rounded-md p-3 space-y-2">
                          <p className="text-sm text-white">{childNameById[childId] || 'Unknown Child'}</p>
                          <div className="grid grid-cols-2 gap-2 min-w-0">
                            <input
                              type="time"
                              required
                              value={formData.childTimesById[childId]?.startTime || formData.startTime}
                              onChange={(event) => updateChildTime(childId, 'startTime', event.target.value)}
                              className="ios-compact-picker w-full min-w-0 px-2 sm:px-3 py-2 text-sm sm:text-base border border-figma-border bg-figma-surface text-white rounded-md"
                            />
                            <input
                              type="time"
                              required
                              value={formData.childTimesById[childId]?.endTime || formData.endTime}
                              onChange={(event) => updateChildTime(childId, 'endTime', event.target.value)}
                              className="ios-compact-picker w-full min-w-0 px-2 sm:px-3 py-2 text-sm sm:text-base border border-figma-border bg-figma-surface text-white rounded-md"
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
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-figma-border">
                      <thead className="bg-figma-elevated">
                        <tr>
                          <th className="border border-figma-border px-4 py-2 text-left text-figma-text-secondary cursor-pointer select-none" onClick={() => handleSort('date')}>
                            Date <span className={sortCol === 'date' ? 'text-white' : 'text-gray-600'}>{sortCol === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : '⇅'}</span>
                          </th>
                          <th className="border border-figma-border px-4 py-2 text-left text-figma-text-secondary cursor-pointer select-none" onClick={() => handleSort('family')}>
                            Family <span className={sortCol === 'family' ? 'text-white' : 'text-gray-600'}>{sortCol === 'family' ? (sortDir === 'asc' ? '↑' : '↓') : '⇅'}</span>
                          </th>
                          <th className="border border-figma-border px-4 py-2 text-left text-figma-text-secondary cursor-pointer select-none" onClick={() => handleSort('child')}>
                            Child <span className={sortCol === 'child' ? 'text-white' : 'text-gray-600'}>{sortCol === 'child' ? (sortDir === 'asc' ? '↑' : '↓') : '⇅'}</span>
                          </th>
                          <th className="border border-figma-border px-4 py-2 text-center text-figma-text-secondary cursor-pointer select-none" onClick={() => handleSort('time')}>
                            Time <span className={sortCol === 'time' ? 'text-white' : 'text-gray-600'}>{sortCol === 'time' ? (sortDir === 'asc' ? '↑' : '↓') : '⇅'}</span>
                          </th>
                          <th className="border border-figma-border px-4 py-2 text-center text-figma-text-secondary cursor-pointer select-none" onClick={() => handleSort('lunch')}>
                            Home Lunch <span className={sortCol === 'lunch' ? 'text-white' : 'text-gray-600'}>{sortCol === 'lunch' ? (sortDir === 'asc' ? '↑' : '↓') : '⇅'}</span>
                          </th>
                          <th className="border border-figma-border px-4 py-2 text-center text-figma-text-secondary">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry) => {
                          const family = families.find((row) => row.id === entry.familyId)
                          return (
                            <tr key={entry.id} className="hover:bg-figma-elevated">
                              <td className="border border-figma-border px-4 py-2 text-white">{formatDisplayDate(entry.date)}</td>
                              <td className="border border-figma-border px-4 py-2 text-white">{family?.name || 'Unknown'}</td>
                              <td className="border border-figma-border px-4 py-2 text-white">
                                {childNameById[entry.childId] || 'Unknown Child'}
                              </td>
                              <td className="border border-figma-border px-4 py-2 text-center text-white">
                                {formatTime12Hour(entry.startTime)} - {formatTime12Hour(entry.endTime)}
                              </td>
                              <td className="border border-figma-border px-4 py-2 text-center text-white">
                                {entry.lunchBrought ? 'Yes' : 'No'}
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
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={handlePrevPage}
                      disabled={!hasPrevPage || paging}
                      className="px-3 py-2 bg-figma-elevated text-white rounded-md disabled:opacity-60"
                    >
                      Previous
                    </button>
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-sm text-figma-text-secondary">{paginationLabel}</p>
                      <div className="flex items-center gap-1" aria-label="Page numbers">
                        {paginationTokens.map((token, index) => {
                          if (typeof token === 'string') {
                            return (
                              <span key={`${token}-${index}`} className="px-2 text-figma-text-secondary">
                                ...
                              </span>
                            )
                          }

                          const isCurrent = token === pageIndex + 1
                          return (
                            <button
                              type="button"
                              key={token}
                              onClick={() => jumpToPage(token - 1)}
                              disabled={paging || isCurrent}
                              aria-label={`Go to page ${token}`}
                              className={`min-w-8 px-2 py-1 rounded text-xs text-center ${
                                isCurrent
                                  ? 'bg-figma-accent text-white'
                                  : 'bg-figma-elevated text-figma-text-secondary hover:bg-figma-border disabled:opacity-60'
                              }`}
                            >
                              {token}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleNextPage}
                      disabled={!hasNextPage || paging}
                      className="px-3 py-2 bg-figma-elevated text-white rounded-md disabled:opacity-60"
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
