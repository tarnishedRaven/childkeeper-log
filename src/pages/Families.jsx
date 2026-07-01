import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import {
  addFamily,
  getFamilies,
  updateFamily,
  deleteFamily,
} from "../services/familyService";

const DEFAULT_RATES = { 1: "", 2: "", 3: "" };

function getSortedChildCounts(rates) {
  return Object.keys(rates || {})
    .map(Number)
    .filter((count) => Number.isInteger(count) && count > 0)
    .sort((a, b) => a - b);
}

export default function Families() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    rates: DEFAULT_RATES,
  });

  useEffect(() => {
    loadFamilies();
  }, [user]);

  const loadFamilies = async () => {
    try {
      setLoading(true);
      setError("");
      if (user) {
        const data = await getFamilies(user.uid);
        setFamilies(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      // Filter out empty rates
      const rates = {};
      Object.entries(formData.rates).forEach(([key, value]) => {
        if (value !== "") {
          rates[key] = parseFloat(value);
        }
      });

      if (editingId) {
        await updateFamily(user.uid, editingId, {
          name: formData.name,
          rates,
        });
      } else {
        await addFamily(user.uid, {
          name: formData.name,
          rates,
        });
      }

      setFormData({ name: "", rates: DEFAULT_RATES });
      setEditingId(null);
      setShowForm(false);
      await loadFamilies();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (family) => {
    const sortedCounts = getSortedChildCounts(family.rates);
    const normalizedRates =
      sortedCounts.length > 0
        ? sortedCounts.reduce((acc, count) => {
            acc[count] = family.rates[count];
            return acc;
          }, {})
        : DEFAULT_RATES;

    setEditingId(family.id);
    setFormData({
      name: family.name,
      rates: normalizedRates,
    });
    setShowForm(true);
  };

  const handleAddChildTier = () => {
    const childCounts = getSortedChildCounts(formData.rates);
    const nextCount =
      childCounts.length > 0 ? childCounts[childCounts.length - 1] + 1 : 1;

    setFormData({
      ...formData,
      rates: {
        ...formData.rates,
        [nextCount]: "",
      },
    });
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this family?")) {
      try {
        await deleteFamily(user.uid, id);
        await loadFamilies();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: "", rates: DEFAULT_RATES });
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
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Families</h1>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-figma-accent text-white rounded-md hover:bg-figma-accent-hover transition"
            >
              Add Family
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-figma-error-surface border border-figma-error rounded-md">
            <p className="text-figma-error">{error}</p>
          </div>
        )}

        {showForm && (
          <div className="bg-figma-surface rounded-lg p-6 mb-8 border border-figma-border">
            <h2 className="text-xl font-bold text-white mb-4">
              {editingId ? "Edit Family" : "Add New Family"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-figma-text-secondary mb-1">
                  Family Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md focus:outline-none focus:ring-figma-accent focus:border-figma-accent placeholder-figma-text-placeholder"
                  placeholder="e.g., Smith Family"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-figma-text-secondary mb-4">
                  Hourly Rates (USD)
                </label>
                <div className="mb-3">
                  <button
                    type="button"
                    onClick={handleAddChildTier}
                    className="px-3 py-2 text-sm bg-figma-elevated text-figma-text-secondary rounded-md hover:bg-[#464646] transition"
                  >
                    + Add Child Tier
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {getSortedChildCounts(formData.rates).map((childCount) => (
                    <div key={childCount}>
                      <label className="block text-xs text-figma-text-placeholder mb-1">
                        {childCount} child{childCount > 1 ? "ren" : ""}
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-3 flex items-center text-figma-text-secondary pointer-events-none">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.rates[childCount] || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              rates: {
                                ...formData.rates,
                                [childCount]: e.target.value,
                              },
                            })
                          }
                          className="w-full pl-7 pr-3 py-2 border border-figma-border bg-figma-elevated text-white rounded-md focus:outline-none focus:ring-figma-accent focus:border-figma-accent placeholder-figma-text-placeholder"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="px-4 py-2 bg-figma-accent text-white rounded-md hover:bg-figma-accent-hover transition"
                >
                  {editingId ? "Update Family" : "Add Family"}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 bg-figma-elevated text-white rounded-md hover:bg-[#464646] transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {families.length === 0 ? (
          <div className="text-center py-12 bg-figma-surface rounded-lg border border-figma-border">
            <p className="text-figma-text-secondary">
              No families yet. Add one to get started!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {families.map((family) => (
              <div
                key={family.id}
                className="bg-figma-surface rounded-lg border border-figma-border p-6"
              >
                <h3 className="text-lg font-bold text-white mb-4">
                  {family.name}
                </h3>
                <div className="mb-4">
                  <p className="text-sm text-figma-text-secondary mb-2">
                    Rates:
                  </p>
                  <ul className="space-y-1">
                    {Object.entries(family.rates)
                      .sort(([a], [b]) => parseInt(a) - parseInt(b))
                      .map(([childCount, rate]) => (
                        <li
                          key={childCount}
                          className="text-sm text-figma-text-secondary"
                        >
                          {childCount} child{childCount > 1 ? "ren" : ""}: $
                          {rate}/hr
                        </li>
                      ))}
                  </ul>
                </div>
                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => navigate(`/families/${family.id}/logs`)}
                    className="flex-1 px-3 py-2 bg-figma-accent text-white text-sm rounded-md hover:bg-figma-accent-hover transition"
                  >
                    Edit Logs
                  </button>
                  <button
                    onClick={() => handleEdit(family)}
                    className="flex-1 px-3 py-2 bg-figma-elevated text-white text-sm rounded-md hover:bg-[#464646] transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(family.id)}
                    className="flex-1 px-3 py-2 bg-figma-error text-white text-sm rounded-md hover:bg-[#d13e1e] transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
