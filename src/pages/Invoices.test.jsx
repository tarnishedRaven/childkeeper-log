import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Invoices from './Invoices'

vi.mock('../components/Navbar', () => ({
  default: function MockNavbar() {
    return <nav>Navbar</nav>
  },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../services/familyService', () => ({
  getFamilies: vi.fn(),
}))

vi.mock('../services/reportService', () => ({
  getGeneralInvoice: vi.fn(),
  getItemizedInvoice: vi.fn(),
  formatCurrency: vi.fn((value) => `$${value.toFixed(2)}`),
  formatHours: vi.fn((value) => String(value)),
}))

vi.mock('../services/rateConfigService', () => ({
  getGlobalRates: vi.fn(),
}))

vi.mock('../services/pdfService', () => ({
  exportElementToPdf: vi.fn(),
  generateReportPdfFilename: vi.fn(() => 'ChildkeeperLog-Receipt-July-2026.pdf'),
}))

import { useAuth } from '../context/AuthContext'
import { getFamilies } from '../services/familyService'
import { getGeneralInvoice, getItemizedInvoice } from '../services/reportService'
import { getGlobalRates } from '../services/rateConfigService'

const mockFamilies = [
  { id: 'fam1', name: 'Smith Family' },
  { id: 'fam2', name: 'Jones Family' },
]

const mockGeneralInvoice = {
  hours: 8,
  segmentTotal: 200,
  lunchFees: 6,
  grandTotal: 206,
  children: [
    { childId: 'child1', childName: 'Ava Smith', hours: 8, amount: 206 },
  ],
  flags: [],
}

describe('Invoices receipt mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { uid: 'user-1' } })
    getFamilies.mockResolvedValue(mockFamilies)
    getGlobalRates.mockResolvedValue({
      providerName: 'Jamie Carter',
      companyName: 'Carter Childcare LLC',
    })
    getGeneralInvoice.mockResolvedValue(mockGeneralInvoice)
    getItemizedInvoice.mockResolvedValue({ lineItems: [], grandTotal: 0, flags: [] })
  })

  it('limits family selection to single-family mode when receipt is selected', async () => {
    const user = userEvent.setup()
    render(<Invoices />)

    await waitFor(() => {
      expect(getFamilies).toHaveBeenCalledWith('user-1')
    })

    const [familySelect, invoiceTypeSelect] = screen.getAllByRole('combobox')
    await user.selectOptions(invoiceTypeSelect, 'receipt')

    expect(within(familySelect).queryByRole('option', { name: 'All Families' })).toBeNull()
    expect(familySelect.value).toBe('fam1')
    expect(screen.getByText('Receipts can only be generated for one family at a time.')).toBeDefined()
  })

  it('generates receipt using general invoice data for one selected family only', async () => {
    const user = userEvent.setup()
    render(<Invoices />)

    await waitFor(() => {
      expect(getFamilies).toHaveBeenCalledWith('user-1')
    })

    const [familySelect, invoiceTypeSelect] = screen.getAllByRole('combobox')
    await user.selectOptions(familySelect, 'fam2')
    await user.selectOptions(invoiceTypeSelect, 'receipt')

    await user.click(screen.getByRole('button', { name: 'Generate Receipt' }))

    await waitFor(() => {
      expect(getGeneralInvoice).toHaveBeenCalledTimes(1)
    })

    expect(getGeneralInvoice).toHaveBeenCalledWith('user-1', 'fam2', expect.any(String), expect.any(String))
    expect(getItemizedInvoice).not.toHaveBeenCalled()
    expect(screen.getByText('Acknowledgement of Payment to Carter Childcare LLC')).toBeDefined()
    expect(screen.getByText('Provider Signature:')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Export Receipt to PDF' })).toBeDefined()
  })
})
