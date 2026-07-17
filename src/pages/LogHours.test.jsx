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
  getRecentAttendance: vi.fn(),
  updateAttendance: vi.fn(),
  deleteAttendance: vi.fn(),
}))

vi.mock('../hooks/useConnectivityStatus', () => ({
  default: vi.fn(),
}))

import { useAuth } from '../context/AuthContext'
import { getFamilies } from '../services/familyService'
import { getChildren } from '../services/childService'
import { addAttendanceBatch, getRecentAttendance } from '../services/attendanceService'
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
    getRecentAttendance.mockResolvedValue([])
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
})
