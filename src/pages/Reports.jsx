import { useState, useEffect, useRef } from "react";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { getFamilies } from "../services/familyService";
import { getTimeEntries } from "../services/timeEntryService";
import {
  generateMonthlySummary,
  formatCurrency,
  formatHours,
} from "../services/reportService";
import {
  exportElementToPdf,
  generateReportPdfFilename,
} from "../services/pdfService";

function formatReportDate(dateStr) {
  if (!dateStr) return "";

  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function Reports() {
  const { user } = useAuth();
  const reportRef = useRef(null);
  const [families, setFamilies] = useState([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState("all");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    loadFamilies();
  }, [user]);

  const loadFamilies = async () => {
    try {
      if (user) {
        const data = await getFamilies(user.uid);
        setFamilies(data);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGenerateReport = async () => {
    try {
      setLoading(true);
      setError("");

      if (!user) return;

      const entries = await getTimeEntries(
        user.uid,
        dateRange.startDate,
        dateRange.endDate,
      );
      const filteredEntries =
        selectedFamilyId === "all"
          ? entries
          : entries.filter((entry) => entry.familyId === selectedFamilyId);
      const filteredFamilies =
        selectedFamilyId === "all"
          ? families
          : families.filter((family) => family.id === selectedFamilyId);

      const report = generateMonthlySummary(filteredEntries, filteredFamilies);
      setSummary(report);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      if (reportRef.current) {
        const filename = generateReportPdfFilename(
          dateRange.startDate,
          dateRange.endDate,
        );
        await exportElementToPdf(reportRef.current, filename);
      }
    } catch (err) {
      setError(err.message);
    }
  };

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
            <div>
              <label className="block text-sm font-medium text-figma-text-secondary mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) =>
                  setDateRange({ ...dateRange, startDate: e.target.value })
                }
                className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md focus:outline-none focus:ring-figma-accent focus:border-figma-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-figma-text-secondary mb-1">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) =>
                  setDateRange({ ...dateRange, endDate: e.target.value })
                }
                className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md focus:outline-none focus:ring-figma-accent focus:border-figma-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-figma-text-secondary mb-1">
                Family
              </label>
              <select
                value={selectedFamilyId}
                onChange={(e) => setSelectedFamilyId(e.target.value)}
                className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md focus:outline-none focus:ring-figma-accent focus:border-figma-accent"
              >
                <option value="all">All Families</option>
                {families.map((family) => (
                  <option key={family.id} value={family.id}>
                    {family.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleGenerateReport}
                disabled={loading}
                className="w-full px-4 py-2 bg-figma-accent text-white rounded-md hover:bg-figma-accent-hover transition disabled:opacity-50 font-medium"
              >
                {loading ? "Generating..." : "Generate Report"}
              </button>
            </div>
          </div>
        </div>

        {summary && (
          <div className="bg-figma-surface rounded-lg border border-figma-border overflow-hidden">
            <div ref={reportRef} className="p-8 bg-white text-gray-900">
              {/* Report Header */}
              <div className="mb-8 pb-4 border-b border-gray-300">
                <h2 className="text-2xl font-bold text-gray-900">
                  Childcare Hours
                </h2>
                <p className="text-gray-600 mt-2">
                  {formatReportDate(dateRange.startDate)} to{" "}
                  {formatReportDate(dateRange.endDate)}
                </p>
                <p className="text-gray-600 mt-1">
                  Family:{" "}
                  {selectedFamilyId === "all"
                    ? "All Families"
                    : families.find((family) => family.id === selectedFamilyId)
                        ?.name || "Unknown Family"}
                </p>
              </div>

              {/* Family Summaries */}
              {summary.byFamily.length > 0 ? (
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    Summary
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border border-gray-300 px-4 py-2 text-left">
                            Family
                          </th>
                          <th className="border border-gray-300 px-4 py-2 text-center">
                            Total Hours
                          </th>
                          <th className="border border-gray-300 px-4 py-2 text-right">
                            Total Earned
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.byFamily.map((family) => (
                          <tr
                            key={family.familyId}
                            className="hover:bg-gray-50"
                          >
                            <td className="border border-gray-300 px-4 py-2">
                              {family.familyName}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-center">
                              {formatHours(family.totalHours)}
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
                  <p className="text-gray-600">
                    No entries for this date range
                  </p>
                </div>
              )}

              {/* Daily Breakdown */}
              {summary.byFamily.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    Daily Breakdown
                  </h3>
                  <div className="space-y-6">
                    {summary.byFamily.map((family) => (
                      <div
                        key={family.familyId}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <h4 className="text-md font-semibold text-gray-900 mb-3">
                          {family.familyName}
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse border border-gray-300">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="border border-gray-300 px-4 py-2 text-left">
                                  Date
                                </th>
                                <th className="border border-gray-300 px-4 py-2 text-center">
                                  Time
                                </th>
                                <th className="border border-gray-300 px-4 py-2 text-right">
                                  Amount
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {family.byDate.map((day) => (
                                <tr
                                  key={`${family.familyId}-${day.date}`}
                                  className="hover:bg-gray-50"
                                >
                                  <td className="border border-gray-300 px-4 py-2">
                                    {formatReportDate(day.date)}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-center">
                                    {formatHours(day.totalHours)}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-right font-medium">
                                    {formatCurrency(day.totalEarned)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grand Totals */}
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

            {/* Export Button - Outside of print area */}
            {summary.byFamily.length > 0 && (
              <div className="p-6 bg-figma-elevated border-t border-figma-border">
                <button
                  onClick={handleExportPdf}
                  className="px-6 py-2 bg-figma-accent text-white rounded-md hover:bg-figma-accent-hover transition font-medium"
                >
                  Export to PDF
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
