import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { getFamilies } from "../services/familyService";
import {
  addTimeEntry,
  getRecentTimeEntries,
  updateTimeEntry,
  deleteTimeEntry,
} from "../services/timeEntryService";

function getAvailableChildCounts(family) {
  if (!family || !family.rates) return [];

  return Object.keys(family.rates)
    .map(Number)
    .filter((count) => Number.isInteger(count) && count > 0)
    .sort((a, b) => a - b);
}

export default function LogHours() {
  const { user } = useAuth();
  const defaultFormData = {
    familyId: "",
    date: new Date().toISOString().split("T")[0],
    startTime: "09:00",
    endTime: "12:00",
    numChildren: 1,
    rate: "",
    notes: "",
  };

  const [families, setFamilies] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [formData, setFormData] = useState(defaultFormData);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      if (user) {
        const familiesData = await getFamilies(user.uid);
        setFamilies(familiesData);

        const entriesData = await getRecentTimeEntries(user.uid, 10);
        setEntries(entriesData);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFamilyChange = (e) => {
    const familyId = e.target.value;
    const selectedFamily = families.find((f) => f.id === familyId);
    const availableChildCounts = getAvailableChildCounts(selectedFamily);

    if (!selectedFamily || availableChildCounts.length === 0) {
      setFormData({ ...formData, familyId, rate: "" });
      return;
    }

    const nextChildCount = availableChildCounts.includes(formData.numChildren)
      ? formData.numChildren
      : availableChildCounts[0];

    setFormData({
      ...formData,
      familyId,
      numChildren: nextChildCount,
      rate: selectedFamily.rates[nextChildCount].toString(),
    });
  };

  const handleChildCountChange = (e) => {
    const numChildren = parseInt(e.target.value);
    const selectedFamily = families.find((f) => f.id === formData.familyId);

    if (selectedFamily && numChildren in selectedFamily.rates) {
      setFormData({
        ...formData,
        numChildren,
        rate: selectedFamily.rates[numChildren].toString(),
      });
    } else {
      setFormData({ ...formData, numChildren, rate: "" });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const payload = {
        familyId: formData.familyId,
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        numChildren: formData.numChildren,
        rate: parseFloat(formData.rate),
        notes: formData.notes,
      };

      if (editingEntryId) {
        await updateTimeEntry(user.uid, editingEntryId, payload);
        setSuccess("Entry updated successfully!");
      } else {
        await addTimeEntry(user.uid, payload);
        setSuccess("Hours logged successfully!");
      }

      setFormData(defaultFormData);
      setEditingEntryId(null);

      await loadData();

      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this entry?")) {
      try {
        await deleteTimeEntry(user.uid, id);
        await loadData();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleEdit = (entry) => {
    setError("");
    setSuccess("");
    setEditingEntryId(entry.id);
    setFormData({
      familyId: entry.familyId,
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      numChildren: entry.numChildren,
      rate: entry.rate.toString(),
      notes: entry.notes || "",
    });
  };

  const handleCancelEdit = () => {
    setEditingEntryId(null);
    setError("");
    setSuccess("");
    setFormData(defaultFormData);
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

  const selectedFamily = families.find((f) => f.id === formData.familyId);
  const availableChildCounts = getAvailableChildCounts(selectedFamily);
  const childCountsForForm = availableChildCounts.includes(formData.numChildren)
    ? availableChildCounts
    : [...availableChildCounts, formData.numChildren].sort((a, b) => a - b);

  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white mb-8">Log Hours</h1>

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

        {families.length === 0 ? (
          <div className="bg-figma-surface border border-figma-border rounded-lg p-6">
            <p className="text-figma-text-secondary">
              Please add families first before logging hours.{" "}
              <a
                href="/families"
                className="font-bold underline text-figma-accent"
              >
                Go to Families
              </a>
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form */}
              <div className="lg:col-span-1 bg-figma-surface rounded-lg border border-figma-border p-6">
                <h2 className="text-xl font-bold text-white mb-4">
                  {editingEntryId ? "Edit Entry" : "New Entry"}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-figma-text-secondary mb-1">
                      Family
                    </label>
                    <select
                      required
                      value={formData.familyId}
                      onChange={handleFamilyChange}
                      className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md focus:outline-none focus:ring-figma-accent focus:border-figma-accent"
                    >
                      <option value="">Select a family</option>
                      {families.map((fam) => (
                        <option key={fam.id} value={fam.id}>
                          {fam.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-figma-text-secondary mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) =>
                        setFormData({ ...formData, date: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md focus:outline-none focus:ring-figma-accent focus:border-figma-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-figma-text-secondary mb-1">
                      Number of Children
                    </label>
                    <select
                      value={formData.numChildren}
                      onChange={handleChildCountChange}
                      disabled={childCountsForForm.length === 0}
                      className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md focus:outline-none focus:ring-figma-accent focus:border-figma-accent"
                    >
                      {childCountsForForm.length === 0 ? (
                        <option value={formData.numChildren}>
                          {formData.numChildren} child
                        </option>
                      ) : (
                        childCountsForForm.map((num) => (
                          <option key={num} value={num}>
                            {num} child{num > 1 ? "ren" : ""}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-figma-text-secondary mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        required
                        value={formData.startTime}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            startTime: e.target.value,
                          })
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
                        required
                        value={formData.endTime}
                        onChange={(e) =>
                          setFormData({ ...formData, endTime: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md focus:outline-none focus:ring-figma-accent focus:border-figma-accent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-figma-text-secondary mb-1">
                      Rate (USD/hr) - Can override
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-3 flex items-center text-figma-text-secondary pointer-events-none">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={formData.rate}
                        onChange={(e) =>
                          setFormData({ ...formData, rate: e.target.value })
                        }
                        className="w-full pl-7 pr-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md focus:outline-none focus:ring-figma-accent focus:border-figma-accent placeholder-figma-text-placeholder"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-figma-text-secondary mb-1">
                      Notes (optional)
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md focus:outline-none focus:ring-figma-accent focus:border-figma-accent placeholder-figma-text-placeholder"
                      placeholder="e.g., Afternoon care"
                      rows="2"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-figma-accent text-white rounded-md hover:bg-figma-accent-hover transition font-medium"
                    >
                      {editingEntryId ? "Update Entry" : "Log Hours"}
                    </button>
                    {editingEntryId && (
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-4 py-2 bg-figma-elevated text-white rounded-md hover:bg-[#464646] transition font-medium"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Entries List */}
              <div className="lg:col-span-2">
                <h2 className="text-xl font-bold text-white mb-4">
                  Recent Entries (Most Recent 10)
                </h2>
                {entries.length === 0 ? (
                  <div className="text-center py-8 bg-figma-surface rounded-lg border border-figma-border">
                    <p className="text-figma-text-secondary">No entries yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-figma-border">
                      <thead className="bg-figma-elevated">
                        <tr>
                          <th className="border border-figma-border px-4 py-2 text-left text-figma-text-secondary">
                            Date
                          </th>
                          <th className="border border-figma-border px-4 py-2 text-left text-figma-text-secondary">
                            Family
                          </th>
                          <th className="border border-figma-border px-4 py-2 text-center text-figma-text-secondary">
                            Duration (hours)
                          </th>
                          <th className="border border-figma-border px-4 py-2 text-right text-figma-text-secondary">
                            Rate
                          </th>
                          <th className="border border-figma-border px-4 py-2 text-right text-figma-text-secondary">
                            Total
                          </th>
                          <th className="border border-figma-border px-4 py-2 text-center text-figma-text-secondary">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry) => {
                          const family = families.find(
                            (f) => f.id === entry.familyId,
                          );
                          const isEditingRow = editingEntryId === entry.id;
                          return (
                            <tr
                              key={entry.id}
                              className={`hover:bg-figma-elevated ${
                                isEditingRow
                                  ? "bg-figma-elevated ring-2 ring-figma-accent/40"
                                  : ""
                              }`}
                            >
                              <td className="border border-figma-border px-4 py-2 text-white">
                                {entry.date}
                              </td>
                              <td className="border border-figma-border px-4 py-2 text-white">
                                {family?.name || "Unknown"}
                              </td>
                              <td className="border border-figma-border px-4 py-2 text-center text-white">
                                {Number(entry.duration || 0).toFixed(2)}
                              </td>
                              <td className="border border-figma-border px-4 py-2 text-right text-white">
                                ${entry.rate}
                              </td>
                              <td className="border border-figma-border px-4 py-2 text-right font-bold text-figma-success">
                                ${entry.totalEarned}
                              </td>
                              <td className="border border-figma-border px-4 py-2 text-center">
                                <button
                                  onClick={() => handleEdit(entry)}
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
            </div>
          </>
        )}
      </div>
    </>
  );
}
