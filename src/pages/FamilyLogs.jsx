import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { getFamilies } from "../services/familyService";
import {
  getTimeEntriesByFamily,
  updateTimeEntry,
  deleteTimeEntry,
} from "../services/timeEntryService";

export default function FamilyLogs() {
  const { user } = useAuth();
  const { familyId } = useParams();
  const navigate = useNavigate();

  const [family, setFamily] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editForm, setEditForm] = useState({
    date: "",
    startTime: "09:00",
    endTime: "12:00",
    numChildren: 1,
    rate: "",
    notes: "",
    hadLunch: false,
  });
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });

  const availableChildCounts = useMemo(() => {
    if (!family || !family.rates) return [1];

    const counts = Object.keys(family.rates)
      .map(Number)
      .filter((count) => Number.isInteger(count) && count > 0)
      .sort((a, b) => a - b);

    if (counts.length === 0) return [1];
    if (editingEntryId && !counts.includes(editForm.numChildren)) {
      return [...counts, editForm.numChildren].sort((a, b) => a - b);
    }
    return counts;
  }, [family, editingEntryId, editForm.numChildren]);

  useEffect(() => {
    loadData();
  }, [user, familyId, dateRange.startDate, dateRange.endDate]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      if (!user || !familyId) return;

      const families = await getFamilies(user.uid);
      const selectedFamily = families.find((f) => f.id === familyId);
      if (!selectedFamily) {
        setError("Family not found");
        return;
      }

      setFamily(selectedFamily);

      const familyEntries = await getTimeEntriesByFamily(
        user.uid,
        familyId,
        dateRange.startDate,
        dateRange.endDate,
      );
      setEntries(familyEntries);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (entry) => {
    setError("");
    setSuccess("");
    setEditingEntryId(entry.id);
    
    // If hadLunch was true when saved, the stored rate is the effective rate
    // Recover the base rate by adding back the lunch discount (multiplied by children count)
    let baseRate = entry.rate;
    if (entry.hadLunch && family?.lunchDiscount) {
      baseRate = entry.rate + (family.lunchDiscount * entry.numChildren);
    }
    
    setEditForm({
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      numChildren: entry.numChildren,
      rate: baseRate.toString(),
      notes: entry.notes || "",
      hadLunch: entry.hadLunch || false,
    });
  };

  const cancelEdit = () => {
    setEditingEntryId(null);
    setEditForm({
      date: "",
      startTime: "09:00",
      endTime: "12:00",
      numChildren: 1,
      rate: "",
      notes: "",
      hadLunch: false,
    });
  };

  const handleChildCountChange = (value) => {
    const numChildren = parseInt(value, 10);
    const rateFromFamily = family?.rates?.[numChildren.toString()];

    setEditForm((prev) => ({
      ...prev,
      numChildren,
      rate:
        rateFromFamily !== undefined ? rateFromFamily.toString() : prev.rate,
    }));
  };

  const getEffectiveRate = () => {
    const baseRate = parseFloat(editForm.rate) || 0;
    const lunchDiscount = (family?.lunchDiscount || 0) * editForm.numChildren;
    return editForm.hadLunch ? Math.max(0, baseRate - lunchDiscount) : baseRate;
  };

  const saveEdit = async () => {
    if (!editingEntryId || !user || !family) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const baseRate = parseFloat(editForm.rate);
      
      // Calculate effective rate with lunch discount (multiplied by number of children)
      let effectiveRate = baseRate;
      if (editForm.hadLunch && family?.lunchDiscount) {
        const totalLunchDiscount = family.lunchDiscount * editForm.numChildren;
        effectiveRate = Math.max(0, baseRate - totalLunchDiscount);
      }

      await updateTimeEntry(user.uid, editingEntryId, {
        familyId: family.id,
        date: editForm.date,
        startTime: editForm.startTime,
        endTime: editForm.endTime,
        numChildren: parseInt(editForm.numChildren, 10),
        rate: effectiveRate,
        notes: editForm.notes,
        hadLunch: editForm.hadLunch,
      });

      setSuccess("Entry updated successfully!");
      cancelEdit();
      await loadData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entryId) => {
    if (!user) return;
    if (!window.confirm("Delete this entry?")) return;

    try {
      setError("");
      setSuccess("");
      await deleteTimeEntry(user.uid, entryId);

      if (editingEntryId === entryId) {
        cancelEdit();
      }

      await loadData();
      setSuccess("Entry deleted successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-figma-accent"></div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Family Logs</h1>
            <p className="text-figma-text-secondary mt-1">
              {family ? family.name : "Unknown Family"}
            </p>
          </div>
          <button
            onClick={() => navigate("/families")}
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
            <p className="text-figma-text-secondary mb-4">
              This family could not be found.
            </p>
            <Link
              to="/families"
              className="text-figma-accent font-medium hover:underline"
            >
              Go back to Families
            </Link>
          </div>
        ) : (
          <>
            <div className="bg-figma-surface rounded-lg border border-figma-border p-6 mb-6">
              <h2 className="text-xl font-bold text-white mb-4">
                Filter by Date
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-figma-text-secondary mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) =>
                      setDateRange((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
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
                      setDateRange((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md focus:outline-none focus:ring-figma-accent focus:border-figma-accent"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={loadData}
                    className="w-full px-4 py-2 bg-figma-accent text-white rounded-md hover:bg-figma-accent-hover transition"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-figma-surface rounded-lg border border-figma-border p-6 mb-6">
              <h2 className="text-xl font-bold text-white mb-4">
                {editingEntryId ? "Edit Entry" : "Select an Entry to Edit"}
              </h2>

              {editingEntryId ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-figma-text-secondary mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={editForm.date}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          date: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md focus:outline-none focus:ring-figma-accent focus:border-figma-accent"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-figma-text-secondary mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={editForm.startTime}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            startTime: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md focus:outline-none focus:ring-figma-accent focus:border-figma-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-figma-text-secondary mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={editForm.endTime}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            endTime: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md focus:outline-none focus:ring-figma-accent focus:border-figma-accent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-figma-text-secondary mb-1">
                      Number of Children
                    </label>
                    <select
                      value={editForm.numChildren}
                      onChange={(e) => handleChildCountChange(e.target.value)}
                      className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md focus:outline-none focus:ring-figma-accent focus:border-figma-accent"
                    >
                      {availableChildCounts.map((count) => (
                        <option key={count} value={count}>
                          {count} child{count > 1 ? "ren" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-figma-text-secondary mb-1">
                      Rate (USD/hr)
                    </label>
                    <div className="relative mb-4">
                    <span className="absolute inset-y-0 left-3 flex items-center text-figma-text-secondary pointer-events-none">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.rate}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          rate: e.target.value,
                        }))
                      }
                      className="w-full pl-7 px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md focus:outline-none focus:ring-figma-accent focus:border-figma-accent"
                    />
                    </div>
                    {family?.lunchDiscount && (
                      <div className="mb-4 p-3 bg-figma-elevated rounded-md border border-figma-border">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.hadLunch}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                hadLunch: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-figma-border bg-figma-surface cursor-pointer"
                          />
                          <span className="text-sm font-medium text-figma-text-secondary">
                            Lunch provided (-${family.lunchDiscount}/hr per child)
                          </span>
                        </label>
                        <p className="text-xs text-figma-text-placeholder mt-2">
                          Effective rate: ${getEffectiveRate().toFixed(2)}/hr
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-figma-text-secondary mb-1">
                      Notes
                    </label>
                    <textarea
                      value={editForm.notes}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      rows="2"
                      className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md focus:outline-none focus:ring-figma-accent focus:border-figma-accent"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="px-4 py-2 bg-figma-accent text-white rounded-md hover:bg-figma-accent-hover transition disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-2 bg-figma-elevated text-white rounded-md hover:bg-[#464646] transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-figma-text-secondary">
                  Choose any entry below and click Edit.
                </p>
              )}
            </div>

            <div className="bg-figma-surface rounded-lg border border-figma-border p-6">
              <h2 className="text-xl font-bold text-white mb-4">Entries</h2>
              {entries.length === 0 ? (
                <div className="text-center py-8 bg-figma-elevated rounded-lg">
                  <p className="text-figma-text-secondary">
                    No entries for this date range
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-figma-border">
                    <thead className="bg-figma-elevated">
                      <tr>
                        <th className="border border-figma-border px-4 py-2 text-left text-figma-text-secondary">
                          Date
                        </th>
                        <th className="border border-figma-border px-4 py-2 text-center text-figma-text-secondary">
                          Duration (hours)
                        </th>
                        <th className="border border-figma-border px-4 py-2 text-right text-figma-text-secondary">
                          Rate
                        </th>
                        <th className="border border-figma-border px-4 py-2 text-center text-figma-text-secondary">
                          Lunch
                        </th>
                        <th className="border border-figma-border px-4 py-2 text-right text-figma-text-secondary">
                          Total
                        </th>
                        <th className="border border-figma-border px-4 py-2 text-center text-figma-text-secondary">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => {
                        const isEditingRow = editingEntryId === entry.id;
                        return (
                          <tr
                            key={entry.id}
                            className={`hover:bg-figma-elevated ${isEditingRow ? "bg-figma-elevated ring-2 ring-figma-accent/40" : ""}`}
                          >
                            <td className="border border-figma-border px-4 py-2 text-white">
                              {entry.date}
                            </td>
                            <td className="border border-figma-border px-4 py-2 text-center text-white">
                              {Number(entry.duration || 0).toFixed(2)}
                            </td>
                            <td className="border border-figma-border px-4 py-2 text-right text-white">
                              ${entry.rate}
                            </td>
                            <td className="border border-figma-border px-4 py-2 text-center text-white">
                              {entry.hadLunch ? "✓" : "-"}
                            </td>
                            <td className="border border-figma-border px-4 py-2 text-right font-bold text-figma-success">
                              ${entry.totalEarned}
                            </td>
                            <td className="border border-figma-border px-4 py-2 text-center">
                              <button
                                onClick={() => startEdit(entry)}
                                className="text-figma-accent hover:text-figma-accent-hover font-medium mr-3"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(entry.id)}
                                className="text-figma-error hover:text-[#d13e1e] font-medium"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
