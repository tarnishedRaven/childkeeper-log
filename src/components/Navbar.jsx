import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logOut } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = React.useState(false);

  const handleLogOut = async () => {
    await logOut();
  };

  const isActive = (path) => {
    if (path === "/families") {
      return (
        location.pathname === path || location.pathname.startsWith("/families/")
      );
    }
    return location.pathname === path;
  };

  const navItems = [
    { path: "/dashboard", label: "Dashboard" },
    { path: "/families", label: "Families" },
    { path: "/log-hours", label: "Log Hours" },
    { path: "/invoices", label: "Invoices" },
  ];

  return (
    <nav className="bg-figma-surface text-white border-b border-figma-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/dashboard" className="text-2xl font-bold text-white">
            The Childkeeper's Log
          </Link>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                  isActive(item.path)
                    ? "bg-[#beff8b] text-figma-bg"
                    : "text-figma-text-secondary hover:bg-figma-elevated hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <span className="text-sm text-figma-text-secondary">
              {user?.email}
            </span>
            <button
              onClick={handleLogOut}
              className="px-4 py-2 bg-figma-error hover:bg-[#d13e1e] rounded-md text-sm font-medium transition"
            >
              Log Out
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden inline-flex items-center justify-center p-2 rounded-md hover:bg-figma-elevated"
            onClick={() => setIsOpen(!isOpen)}
          >
            <svg
              className="h-6 w-6"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {isOpen && (
          <div className="md:hidden pb-4">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  isActive(item.path)
                    ? "bg-figma-elevated text-white"
                    : "text-figma-text-secondary hover:bg-figma-elevated hover:text-white"
                }`}
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="px-3 py-2 text-sm text-figma-text-secondary">
              {user?.email}
            </div>
            <button
              onClick={handleLogOut}
              className="w-full text-left px-3 py-2 bg-figma-error hover:bg-[#d13e1e] rounded-md text-sm font-medium transition"
            >
              Log Out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
