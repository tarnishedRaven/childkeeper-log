import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await resetPassword(email);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-figma-bg py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Reset your password
          </h2>
          <p className="mt-2 text-center text-sm text-figma-text-secondary">
            Enter your email and we'll send you a reset link
          </p>
        </div>

        {success ? (
          <div className="rounded-md bg-figma-elevated border border-figma-border p-4 text-center space-y-4">
            <p className="text-sm font-medium text-white">
              Check your email for a password reset link.
            </p>
            <Link
              to="/login"
              className="font-medium text-figma-accent hover:text-figma-accent-hover text-sm"
            >
              Back to login
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-md bg-figma-error-surface border border-figma-error p-4">
                <p className="text-sm font-medium text-figma-error">{error}</p>
              </div>
            )}

            <div className="rounded-md shadow-sm">
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-figma-border bg-figma-elevated placeholder-figma-text-placeholder text-white rounded-md focus:outline-none focus:ring-figma-accent focus:border-figma-accent focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-figma-accent hover:bg-figma-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-figma-accent focus:ring-offset-figma-bg disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </div>

            <div className="text-center">
              <Link
                to="/login"
                className="font-medium text-figma-accent hover:text-figma-accent-hover text-sm"
              >
                Back to login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
