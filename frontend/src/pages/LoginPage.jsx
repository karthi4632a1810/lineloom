import { useId, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { loginRequest } from "../services/authService";
import { resetAuthRedirectFlag } from "../services/apiClient";

const initialForm = { email: "", password: "" };

export const LoginPage = () => {
  const brandGradId = useId().replace(/:/g, "");
  const [form, setForm] = useState(initialForm);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get("expired") === "1";

  const handleInput = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const payload = await loginRequest(form);
      resetAuthRedirectFlag();
      localStorage.setItem("auth_token", payload?.token ?? "");
      localStorage.setItem("auth_role", payload?.user?.role ?? "nurse");
      const next = searchParams.get("next");
      if (next && next.startsWith("/") && !next.startsWith("//")) {
        navigate(next);
      } else {
        navigate("/dashboard");
      }
    } catch (requestError) {
      setError(requestError?.message ?? "Invalid login attempt");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-backdrop" aria-hidden="true" />
      <section className="login-card" aria-labelledby="login-heading">
        <header className="login-card-header">
          <div className="login-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 40 40" width="40" height="40" fill="none">
              <rect width="40" height="40" rx="12" fill={`url(#${brandGradId})`} />
              <path
                d="M20 11v18M11 20h18"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id={brandGradId} x1="8" y1="4" x2="36" y2="36">
                  <stop stopColor="#1d4ed8" />
                  <stop offset="1" stopColor="#1e3a8a" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 id="login-heading" className="login-title">
            Welcome back
          </h1>
          <p className="login-subtitle">
            Sign in to <strong>Clinical Curator</strong> to manage queues, visits, and patient journeys.
          </p>
        </header>

        {sessionExpired ? (
          <div className="login-alert" role="status">
            <span className="login-alert-title">Session ended</span>
            <p>
              Your session expired or the token is invalid. Please sign in again to continue.
            </p>
          </div>
        ) : null}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@hospital.local"
              value={form.email}
              onChange={handleInput}
              required
            />
          </div>
          <div className="login-field">
            <label htmlFor="password">Password</label>
            <div className="login-password-wrapper">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleInput}
                required
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((previous) => !previous)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.83 21.83 0 0 1-3.17 4.19" />
                    <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          {error ? (
            <p className="login-form-error error-text" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="login-submit" disabled={isLoading}>
            {isLoading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="login-footer-note">Hospital staff access only.</p>
      </section>
    </div>
  );
};
