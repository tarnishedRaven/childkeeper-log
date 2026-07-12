import { useState, useEffect, useRef } from 'react'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { getFamilies } from '../services/familyService'
import { getChildren } from '../services/childService'
import { getAttendanceByDateRange } from '../services/attendanceService'
import { getGlobalRates } from '../services/rateConfigService'
import {
  generateSummaryFromPayroll,
  buildDailyBreakdownRows,
  formatCurrency,
  formatHours,
} from '../services/reportService'
import { runPayroll } from '../utils/payrollEngine'
import { exportElementToPdf, generateReportPdfFilename } from '../services/pdfService'

function formatReportDate(dateStr) {
  if (!dateStr) return ''

  const date = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateStr

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export default function Reports() {
  const { user } = useAuth()
  const reportRef = useRef(null)
  const [families, setFamilies] = useState([])
  const [children, setChildren] = useState([])
  const [selectedFamilyId, setSelectedFamilyId] = useState('all')
  const [summary, setSummary] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    loadFamiliesAndChildren()
  }, [user])

  const loadFamiliesAndChildren = async () => {
    try {
      if (!user) return

      const [familiesData, childrenData] = await Promise.all([
        getFamilies(user.uid),
        getChildren(user.uid, { activeOnly: true }),
      ])

      setFamilies(familiesData)
      setChildren(childrenData)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleGenerateReport = async () => {
    try {
      setLoading(true)
      setError('')

      if (!user) return

      const [attendance, globalRates] = await Promise.all([
        getAttendanceByDateRange(user.uid, dateRange.startDate, dateRange.endDate),
        getGlobalRates(user.uid),
      ])

      const filteredAttendance =
        selectedFamilyId === 'all'
          ? attendance
          : attendance.filter((entry) => entry.familyId === selectedFamilyId)

      const childrenById = children.reduce((acc, child) => {
        acc[child.id] = child
        return acc
      }, {})

      const normalizedAttendance = filteredAttendance.map((entry) => ({
        ...entry,
        startAt:
          entry.startAt?.toDate?.() ||
          new Date(`${entry.date}T${entry.startTime}:00`),
        endAt:
          entry.endAt?.toDate?.() ||
          new Date(`${entry.date}T${entry.endTime}:00`),
      }))

      const payroll = runPayroll(normalizedAttendance, childrenById, globalRates)
      const filteredFamilies =
        selectedFamilyId === 'all'
          ? families
          : families.filter((family) => family.id === selectedFamilyId)

      setSummary(generateSummaryFromPayroll(payroll, filteredFamilies))
      setRows(buildDailyBreakdownRows(filteredAttendance, payroll.segmentLedger, children))
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

  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white mb-8">Reports</h1>

        {error && (
          <div className="mb-4 p-4 bg-figma-error-surface border border-figma-error rounded-md">
            <p className="text-figma-error">{error}</p>
          </div>
        )}

        <div className="bg-figma-surface rounded-lg border border-figma-border p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Generate Report</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(event) => setDateRange({ ...dateRange, startDate: event.target.value })}
              className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
            />
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(event) => setDateRange({ ...dateRange, endDate: event.target.value })}
              className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
            />
            <select
              value={selectedFamilyId}
              onChange={(event) => setSelectedFamilyId(event.target.value)}
              className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md"
            >
              <option value="all">All Families</option>
              {families.map((family) => (
                <option key={family.id} value={family.id}>
                  {family.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleGenerateReport}
              disabled={loading}
              className="w-full px-4 py-2 bg-figma-accent text-white rounded-md disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>

        {summary && (
          <div className="bg-figma-surface rounded-lg border border-figma-border overflow-hidden">
            <div ref={reportRef} className="p-8 bg-white text-gray-900">
              <div className="mb-8 pb-4 border-b border-gray-300">
                <h2 className="text-2xl font-bold text-gray-900">Childcare Payroll Report</h2>
                <p className="text-gray-600 mt-2">
                  {formatReportDate(dateRange.startDate)} to {formatReportDate(dateRange.endDate)}
                </p>
                <p className="text-gray-600 mt-1">
                  Family:{' '}
                  {selectedFamilyId === 'all'
                    ? 'All Families'
                    : families.find((family) => family.id === selectedFamilyId)?.name || 'Unknown Family'}
                </p>
              </div>

              {summary.byFamily.length > 0 ? (
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Summary</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border border-gray-300 px-4 py-2 text-left">Family</th>
                          <th className="border border-gray-300 px-4 py-2 text-center">Total Hours</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Segment Total</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Lunch Fees</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Final Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.byFamily.map((family) => (
                          <tr key={family.familyId} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-2">{family.familyName}</td>
                            <td className="border border-gray-300 px-4 py-2 text-center">
                              {formatHours(family.totalHours)}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right">
                              {formatCurrency(family.segmentTotal)}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right">
                              {formatCurrency(family.lunchFees)}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right font-bold">
                              {formatCurrency(family.totalEarned)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg mb-8">
                  <p className="text-gray-600">No attendance for this date range</p>
                </div>
              )}

              {rows.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Daily Breakdown</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border border-gray-300 px-4 py-2 text-left">Date</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Child</th>
                          <th className="border border-gray-300 px-4 py-2 text-center">Time Period</th>
                          <th className="border border-gray-300 px-4 py-2 text-center">Lunch Brought</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.id} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-2">{formatReportDate(row.date)}</td>
                            <td className="border border-gray-300 px-4 py-2">{row.childName}</td>
                            <td className="border border-gray-300 px-4 py-2 text-center">
                              {row.startTime} - {row.endTime}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-center">
                              {row.lunchBrought ? 'Yes' : 'No'}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right">
                              {formatCurrency(row.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {summary.flags.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Flags</h3>
                  <ul className="list-disc list-inside text-sm text-gray-700">
                    {summary.flags.map((flag, index) => (
                      <li key={`${flag.type}-${index}`}>
                        {flag.type}: {flag.message || `${formatCurrency((flag.cents || 0) / 100)} on ${flag.date || 'N/A'}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.byFamily.length > 0 && (
                <div className="border-t-2 border-gray-400 pt-4">
                  <div className="grid grid-cols-2 gap-4 max-w-xs ml-auto">
                    <div className="text-right">
                      <p className="text-gray-600">Total Hours:</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatHours(summary.grandTotals.totalHours)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-600">Total Earned:</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(summary.grandTotals.totalEarned)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {summary.byFamily.length > 0 && (
              <div className="p-6 bg-figma-elevated border-t border-figma-border">
                <button onClick={handleExportPdf} className="px-6 py-2 bg-figma-accent text-white rounded-md">
                  Export to PDF
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
