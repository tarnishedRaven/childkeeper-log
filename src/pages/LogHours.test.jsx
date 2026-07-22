import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LogHours from './LogHours'

vi.mock('../components/Navbar', () => ({
  default: function MockNavbar() {
    return <nav>Navbar</nav>
  },
}))

vi.mock('../components/SyncStatusBanner', () => ({
  default: function MockSyncStatusBanner() {
    return <div>Sync Status</div>
  },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../services/familyService', () => ({
  getFamilies: vi.fn(),
}))

vi.mock('../services/childService', () => ({
  getChildren: vi.fn(),
}))

vi.mock('../services/attendanceService', () => ({
  addAttendanceBatch: vi.fn(),
  backfillAttendanceSortKeys: vi.fn(),
  getAttendancePage: vi.fn(),
  getAttendanceTotalCount: vi.fn(),
  updateAttendance: vi.fn(),
  deleteAttendance: vi.fn(),
}))

vi.mock('../hooks/useConnectivityStatus', () => ({
  default: vi.fn(),
}))

import { useAuth } from '../context/AuthContext'
import { getFamilies } from '../services/familyService'
import { getChildren } from '../services/childService'
import {
  addAttendanceBatch,
  backfillAttendanceSortKeys,
  getAttendancePage,
  getAttendanceTotalCount,
} from '../services/attendanceService'
import useConnectivityStatus from '../hooks/useConnectivityStatus'

const mockFamilies = [{ id: 'fam-1', name: 'Smith Family' }]
const mockChildren = [
  { id: 'child-1', familyId: 'fam-1', displayName: 'Ava' },
  { id: 'child-2', familyId: 'fam-1', displayName: 'Ben' },
]

function getChildCard(name) {
  const cardHeading = screen.getAllByText(name).find((element) => element.tagName === 'P')
  if (!cardHeading) {
    throw new Error(`Could not find attendance card for ${name}`)
  }
  return cardHeading.closest('div')
}

describe('LogHours bulk time behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { uid: 'user-1' } })
    getFamilies.mockResolvedValue(mockFamilies)
    getChildren.mockResolvedValue(mockChildren)
    getAttendancePage.mockResolvedValue({
      rows: [],
      hasPrev: false,
      hasNext: false,
      firstCursor: null,
      lastCursor: null,
    })
    getAttendanceTotalCount.mockResolvedValue(0)
    backfillAttendanceSortKeys.mockResolvedValue(2)
    addAttendanceBatch.mockResolvedValue(['row-1', 'row-2'])

    useConnectivityStatus.mockReturnValue({
      isOnline: true,
      hasPendingSync: false,
      isSyncing: false,
      syncError: '',
      isStaleVersion: false,
      markPendingSync: vi.fn(),
      markSyncing: vi.fn(),
      clearPendingSync: vi.fn(),
      markSyncError: vi.fn(),
      clearSyncError: vi.fn(),
    })
  })

  it('applies bulk start and end times to all selected children immediately', async () => {
    const user = userEvent.setup()
    render(<LogHours />)

    await waitFor(() => {
      expect(getChildren).toHaveBeenCalledWith('user-1')
    })

    await user.click(screen.getByLabelText('Select Ava'))
    await user.click(screen.getByLabelText('Select Ben'))

    fireEvent.change(screen.getByLabelText('Bulk Start Time'), { target: { value: '08:30' } })
    fireEvent.change(screen.getByLabelText('Bulk End Time'), { target: { value: '13:45' } })

    const avaCard = getChildCard('Ava')
    const benCard = getChildCard('Ben')

    expect(within(avaCard).getByDisplayValue('08:30')).toBeDefined()
    expect(within(avaCard).getByDisplayValue('13:45')).toBeDefined()
    expect(within(benCard).getByDisplayValue('08:30')).toBeDefined()
    expect(within(benCard).getByDisplayValue('13:45')).toBeDefined()
  })

  it('uses current bulk times when selecting a new child after bulk update', async () => {
    const user = userEvent.setup()
    render(<LogHours />)

    await waitFor(() => {
      expect(getChildren).toHaveBeenCalledWith('user-1')
    })

    await user.click(screen.getByLabelText('Select Ava'))

    fireEvent.change(screen.getByLabelText('Bulk Start Time'), { target: { value: '07:45' } })
    fireEvent.change(screen.getByLabelText('Bulk End Time'), { target: { value: '11:15' } })

    await user.click(screen.getByLabelText('Select Ben'))

    const benCard = getChildCard('Ben')
    expect(within(benCard).getByDisplayValue('07:45')).toBeDefined()
    expect(within(benCard).getByDisplayValue('11:15')).toBeDefined()
  })

  it('submits bulk-applied times for all selected children', async () => {
    const user = userEvent.setup()
    render(<LogHours />)

    await waitFor(() => {
      expect(getChildren).toHaveBeenCalledWith('user-1')
    })

    await user.click(screen.getByLabelText('Select Ava'))
    await user.click(screen.getByLabelText('Select Ben'))
    await user.click(screen.getByLabelText('Lunch brought for Ben'))

    fireEvent.change(screen.getByLabelText('Bulk Start Time'), { target: { value: '08:00' } })
    fireEvent.change(screen.getByLabelText('Bulk End Time'), { target: { value: '14:00' } })

    await user.type(screen.getByPlaceholderText('Notes'), 'Group schedule')
    await user.click(screen.getByRole('button', { name: 'Save Attendance' }))

    await waitFor(() => {
      expect(addAttendanceBatch).toHaveBeenCalledTimes(1)
    })

    expect(addAttendanceBatch).toHaveBeenCalledWith('user-1', [
      {
        childId: 'child-1',
        familyId: 'fam-1',
        date: expect.any(String),
        startTime: '08:00',
        endTime: '14:00',
        lunchBrought: false,
        notes: 'Group schedule',
        numChildren: 2,
      },
      {
        childId: 'child-2',
        familyId: 'fam-1',
        date: expect.any(String),
        startTime: '08:00',
        endTime: '14:00',
        lunchBrought: true,
        notes: 'Group schedule',
        numChildren: 2,
      },
    ])
  })

  it('resets to first page with new query when sort column is changed', async () => {
    const user = userEvent.setup()
    getAttendancePage
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'entry-1',
            familyId: 'fam-1',
            childId: 'child-1',
            date: '2026-07-20',
            startTime: '09:00',
            endTime: '12:00',
            lunchBrought: false,
          },
        ],
        hasPrev: false,
        hasNext: true,
        firstCursor: null,
        lastCursor: null,
      })
      .mockResolvedValueOnce({
        rows: [],
        hasPrev: false,
        hasNext: false,
        firstCursor: null,
        lastCursor: null,
      })

    render(<LogHours />)

    await waitFor(() => {
      expect(getAttendancePage).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ sortKey: 'date', sortDir: 'desc' })
      )
    })

    expect(screen.getByText('Page 1 of 1')).toBeDefined()

    await user.click(screen.getByRole('columnheader', { name: /^Family/i }))

    await waitFor(() => {
      expect(getAttendancePage).toHaveBeenLastCalledWith(
        'user-1',
        expect.objectContaining({ sortKey: 'family', sortDir: 'asc' })
      )
    })
  })

  it('navigates to a clicked page number', async () => {
    const user = userEvent.setup()
    const pageOneLastCursor = { snapshot: { id: 'cursor-page-1-last' } }

    getAttendanceTotalCount.mockResolvedValue(80)
    getAttendancePage
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'entry-1',
            familyId: 'fam-1',
            childId: 'child-1',
            date: '2026-07-20',
            startTime: '09:00',
            endTime: '12:00',
            lunchBrought: false,
          },
        ],
        hasPrev: false,
        hasNext: true,
        firstCursor: { snapshot: { id: 'cursor-page-1-first' } },
        lastCursor: pageOneLastCursor,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'entry-2',
            familyId: 'fam-1',
            childId: 'child-2',
            date: '2026-07-19',
            startTime: '10:00',
            endTime: '13:00',
            lunchBrought: true,
          },
        ],
        hasPrev: true,
        hasNext: true,
        firstCursor: { snapshot: { id: 'cursor-page-2-first' } },
        lastCursor: { snapshot: { id: 'cursor-page-2-last' } },
      })

    render(<LogHours />)

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 4')).toBeDefined()
    })

    await user.click(screen.getByRole('button', { name: 'Go to page 2' }))

    await waitFor(() => {
      expect(getAttendancePage).toHaveBeenLastCalledWith(
        'user-1',
        expect.objectContaining({
          pageSize: 25,
          sortKey: 'date',
          sortDir: 'desc',
          direction: 'next',
          cursor: pageOneLastCursor,
        })
      )
    })

    expect(screen.getByText('Page 2 of 4')).toBeDefined()
  })

  it('returns to previous page after page-number navigation', async () => {
    const user = userEvent.setup()
    const pageOneLastCursor = { snapshot: { id: 'cursor-page-1-last' } }
    const pageTwoFirstCursor = { snapshot: { id: 'cursor-page-2-first' } }

    getAttendanceTotalCount.mockResolvedValue(80)
    getAttendancePage
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'entry-1',
            familyId: 'fam-1',
            childId: 'child-1',
            date: '2026-07-20',
            startTime: '09:00',
            endTime: '12:00',
            lunchBrought: false,
          },
        ],
        hasPrev: false,
        hasNext: true,
        firstCursor: { snapshot: { id: 'cursor-page-1-first' } },
        lastCursor: pageOneLastCursor,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'entry-2',
            familyId: 'fam-1',
            childId: 'child-2',
            date: '2026-07-19',
            startTime: '10:00',
            endTime: '13:00',
            lunchBrought: true,
          },
        ],
        hasPrev: true,
        hasNext: true,
        firstCursor: pageTwoFirstCursor,
        lastCursor: { snapshot: { id: 'cursor-page-2-last' } },
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'entry-1',
            familyId: 'fam-1',
            childId: 'child-1',
            date: '2026-07-20',
            startTime: '09:00',
            endTime: '12:00',
            lunchBrought: false,
          },
        ],
        hasPrev: false,
        hasNext: true,
        firstCursor: { snapshot: { id: 'cursor-page-1-first-return' } },
        lastCursor: { snapshot: { id: 'cursor-page-1-last-return' } },
      })

    render(<LogHours />)

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 4')).toBeDefined()
    })

    await user.click(screen.getByRole('button', { name: 'Go to page 2' }))

    await waitFor(() => {
      expect(screen.getByText('Page 2 of 4')).toBeDefined()
    })

    await user.click(screen.getByRole('button', { name: 'Previous' }))

    await waitFor(() => {
      expect(getAttendancePage).toHaveBeenLastCalledWith(
        'user-1',
        expect.objectContaining({
          pageSize: 25,
          sortKey: 'date',
          sortDir: 'desc',
          direction: 'prev',
          cursor: pageTwoFirstCursor,
        })
      )
    })

    expect(screen.getByText('Page 1 of 4')).toBeDefined()
  })

  it('runs attendance sort repair and reloads page data', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<LogHours />)

    await waitFor(() => {
      expect(getAttendancePage).toHaveBeenCalledTimes(1)
    })

    await user.click(screen.getByRole('button', { name: 'Repair Attendance Sorting' }))

    await waitFor(() => {
      expect(backfillAttendanceSortKeys).toHaveBeenCalledWith('user-1')
    })

    await waitFor(() => {
      expect(getAttendancePage).toHaveBeenCalledTimes(2)
    })
  })
})
