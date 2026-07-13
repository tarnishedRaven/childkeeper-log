import { Fragment, useState, useEffect, useRef } from 'react'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { getFamilies } from '../services/familyService'
import {
  getGeneralInvoice,
  getItemizedInvoice,
  formatCurrency,
  formatHours,
} from '../services/reportService'
import { formatDisplayDate, formatTime12Hour } from '../utils/timeFormatting'
import { exportElementToPdf, generateReportPdfFilename } from '../services/pdfService'

export default function Invoices() {
  const { user } = useAuth()
  const reportRef = useRef(null)
  const [families, setFamilies] = useState([])
  const [selectedFamilyId, setSelectedFamilyId] = useState('all')
  const [invoiceType, setInvoiceType] = useState('general')
  const [invoiceData, setInvoiceData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    loadFamilies()
  }, [user])

  const loadFamilies = async () => {
    try {
      if (!user) return
      const familiesData = await getFamilies(user.uid)
      setFamilies(familiesData)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleGenerateInvoice = async () => {
    if (!user || families.length === 0) return
    setLoading(true)
    setError('')
    setInvoiceData(null)
    try {
      const targetFamilies = selectedFamilyId === 'all'
        ? families
        : families.filter((f) => f.id === selectedFamilyId)
      const results = await Promise.all(
        targetFamilies.map(async (family) => {
          const data = invoiceType === 'general'
            ? await getGeneralInvoice(user.uid, family.id, dateRange.startDate, dateRange.endDate)
            : await getItemizedInvoice(user.uid, family.id, dateRange.startDate, dateRange.endDate)
          return { familyId: family.id, familyName: family.name, data }
        })
      )
      setInvoiceData({ families: results })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExportPdf = async () => {
    try {
      if (reportRef.current) {
        const filename = generateReportPdfFilename(dateRange.startDate, dateRange.endDate)
        await exportElementToPdf(reportRef.current, filename)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const invoiceFamilyLabel = selectedFamilyId === 'all' ? 'All Families' : (families.find((f) => f.id === selectedFamilyId)?.name || '')

  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white mb-8">Invoices</h1>

        {error && (
          <div className="mb-4 p-4 bg-figma-error-surface border border-figma-error rounded-md">
            <p className="text-figma-error">{error}</p>
          </div>
        )}

        {/* Controls */}
        <div className="bg-figma-surface rounded-lg border border-figma-border p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Generate Invoice</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Start Date</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(event) => setDateRange({ ...dateRange, startDate: event.target.value })}
                className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">End Date</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(event) => setDateRange({ ...dateRange, endDate: event.target.value })}
                className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Family</label>
              <select
                value={selectedFamilyId}
                onChange={(event) => { setSelectedFamilyId(event.target.value); setInvoiceData(null) }}
                className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
              >
                <option value="all">All Families</option>
                {families.map((family) => (
                  <option key={family.id} value={family.id}>
                    {family.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Invoice Type</label>
              <select
                value={invoiceType}
                onChange={(event) => { setInvoiceType(event.target.value); setInvoiceData(null) }}
                className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
              >
                <option value="general">General Invoice</option>
                <option value="itemized">Itemized Invoice</option>
              </select>
            </div>
            <button
              onClick={handleGenerateInvoice}
              disabled={loading || families.length === 0}
              className="w-full px-4 py-2 bg-figma-accent text-white rounded-md disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Invoice'}
            </button>
          </div>
        </div>

        {/* Invoice output */}
        {invoiceData && (
          <div className="bg-figma-surface rounded-lg border border-figma-border overflow-hidden">
            <div ref={reportRef} className="p-8 bg-white text-gray-900">

              {/* Header */}
              <div className="mb-8 pb-4 border-b border-gray-300">
                <h2 className="text-2xl font-bold text-gray-900">
                  {invoiceType === 'general' ? 'General Invoice' : 'Itemized Invoice'}
                </h2>
                <p className="text-gray-600 mt-2">
                  {formatDisplayDate(dateRange.startDate)} – {formatDisplayDate(dateRange.endDate)}
                </p>
                <p className="text-gray-600 mt-1">Family: {invoiceFamilyLabel}</p>
              </div>

              {/* General invoice table */}
              {invoiceType === 'general' && (
                <div className="mb-8">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead className="bg-gray-100">
                        <tr>
                          {invoiceData.families.length > 1 && (
                            <th className="border border-gray-300 px-4 py-2 text-left">Family</th>
                          )}
                          <th className="border border-gray-300 px-4 py-2 text-center">Total Hours</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Hourly Charges</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Lunch Fees</th>
                          <th className="border border-gray-300 px-4 py-2 text-right font-bold">Grand Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceData.families.map(({ familyId, familyName, data }) => (
                          <Fragment key={familyId}>
                            <tr className="hover:bg-gray-50">
                              {invoiceData.families.length > 1 && (
                                <td className="border border-gray-300 px-4 py-2 font-medium">{familyName}</td>
                              )}
                              <td className="border border-gray-300 px-4 py-2 text-center">
                                {formatHours(data.hours)}
                              </td>
                              <td className="border border-gray-300 px-4 py-2 text-right">
                                {formatCurrency(data.segmentTotal)}
                              </td>
                              <td className="border border-gray-300 px-4 py-2 text-right">
                                {formatCurrency(data.lunchFees)}
                              </td>
                              <td className="border border-gray-300 px-4 py-2 text-right font-bold">
                                {formatCurrency(data.grandTotal)}
                              </td>
                            </tr>
                            {data.children?.length > 0 && (
                              <tr className="bg-gray-50/60">
                                <td
                                  className="border border-gray-300 px-4 py-3"
                                  colSpan={invoiceData.families.length > 1 ? 5 : 4}
                                >
                                  <div className="text-sm text-gray-700">
                                    <p className="font-medium text-gray-900 mb-2 text-center">Included Children</p>
                                    <table className="w-full border-collapse text-sm">
                                      <thead>
                                        <tr className="text-gray-600">
                                          <th className="py-1 pr-4 text-left font-medium">Child</th>
                                          <th className="py-1 px-4 text-center font-medium">Hours</th>
                                          <th className="py-1 pl-4 text-right font-medium">Total</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {data.children.map((child) => (
                                          <tr key={child.childId} className="border-t border-gray-200 first:border-t-0">
                                            <td className="py-2 pr-4">{child.childName}</td>
                                            <td className="py-2 px-4 text-center whitespace-nowrap">
                                              {formatHours(child.hours)}
                                            </td>
                                            <td className="py-2 pl-4 text-right whitespace-nowrap font-medium">
                                              {formatCurrency(child.amount)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                      </tbody>
                      {invoiceData.families.length > 1 && (
                        <tfoot className="bg-gray-100 font-bold">
                          <tr>
                            <td className="border border-gray-300 px-4 py-2">Grand Total</td>
                            <td className="border border-gray-300 px-4 py-2 text-center">
                              {formatHours(invoiceData.families.reduce((s, f) => s + f.data.hours, 0))}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right">
                              {formatCurrency(invoiceData.families.reduce((s, f) => s + f.data.segmentTotal, 0))}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right">
                              {formatCurrency(invoiceData.families.reduce((s, f) => s + f.data.lunchFees, 0))}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right">
                              {formatCurrency(invoiceData.families.reduce((s, f) => s + f.data.grandTotal, 0))}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}

              {/* Itemized invoice */}
              {invoiceType === 'itemized' && invoiceData.families.map(({ familyId, familyName, data }) => (
                <div key={familyId} className="mb-8">
                  {invoiceData.families.length > 1 && (
                    <h3 className="text-lg font-bold text-gray-900 mb-3">{familyName}</h3>
                  )}
                  {data.lineItems.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-gray-600">No attendance for this date range</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="border border-gray-300 px-4 py-2 text-left">Date</th>
                            <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                            <th className="border border-gray-300 px-4 py-2 text-left">Children</th>
                            <th className="border border-gray-300 px-4 py-2 text-center">Total Children</th>
                            <th className="border border-gray-300 px-4 py-2 text-center">Rate/hr</th>
                            <th className="border border-gray-300 px-4 py-2 text-center">Effective Rate</th>
                            <th className="border border-gray-300 px-4 py-2 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.lineItems.map((row, index) =>
                            row.type === 'segment' ? (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="border border-gray-300 px-4 py-2 whitespace-nowrap">
                                  {formatDisplayDate(row.date)}
                                </td>
                                <td className="border border-gray-300 px-4 py-2 whitespace-nowrap">
                                  {formatTime12Hour(row.startTime)} – {formatTime12Hour(row.endTime)}
                                </td>
                                <td className="border border-gray-300 px-4 py-2">
                                  {row.childNames.join(', ')}
                                </td>
                                <td className="border border-gray-300 px-4 py-2 text-center">
                                  {row.childCount}
                                </td>
                                <td className="border border-gray-300 px-4 py-2 text-center">
                                  {formatCurrency(row.ratePerHour)}/hr
                                </td>
                                <td className="border border-gray-300 px-4 py-2 text-center">
                                  {formatCurrency(row.familyShare / row.hours)}/hr
                                </td>
                                <td className="border border-gray-300 px-4 py-2 text-right">
                                  {formatCurrency(row.familyShare)}
                                </td>
                              </tr>
                            ) : (
                              <tr key={index} className="hover:bg-gray-50 bg-gray-50">
                                <td className="border border-gray-300 px-4 py-2 whitespace-nowrap">
                                  {formatDisplayDate(row.date)}
                                </td>
                                <td className="border border-gray-300 px-4 py-2 italic" colSpan={4}>
                                  Lunch fee — {row.childName}
                                </td>
                                <td className="border border-gray-300 px-4 py-2 text-center text-gray-400">
                                  —
                                </td>
                                <td className="border border-gray-300 px-4 py-2 text-right">
                                  {formatCurrency(row.fee)}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                        <tfoot className="bg-gray-100 font-bold">
                          <tr>
                            <td className="border border-gray-300 px-4 py-2" colSpan={6}>
                              {invoiceData.families.length > 1 ? `${familyName} Total` : 'Grand Total'}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right">
                              {formatCurrency(data.grandTotal)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              ))}

              {/* Flags */}
              {invoiceData.families.flatMap((f) => f.data.flags || []).length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-2">Notices</h3>
                  <ul className="list-disc list-inside text-sm text-gray-600">
                    {invoiceData.families.flatMap((f) => f.data.flags || []).map((flag, index) => (
                      <li key={`${flag.type}-${index}`}>{flag.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Grand total footer for single-family general invoice */}
              {invoiceType === 'general' && invoiceData.families.length === 1 && invoiceData.families[0].data.grandTotal > 0 && (
                <div className="border-t-2 border-gray-400 pt-4">
                  <div className="text-right">
                    <p className="text-gray-600">Grand Total</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(invoiceData.families[0].data.grandTotal)}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-figma-elevated border-t border-figma-border">
              <button onClick={handleExportPdf} className="px-6 py-2 bg-figma-accent text-white rounded-md">
                Export to PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
