import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { loginRequest } from "../services/authService";
import { resetAuthRedirectFlag } from "../services/apiClient";

const initialForm = { email: "", password: "" };

export const LoginPage = () => {
  const [form, setForm] = useState(initialForm);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
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
    <section className="page">
      <h2>Login</h2>
      {sessionExpired ? (
        <p className="error-text" role="status">
          Your session expired or the token is invalid. Please sign in again to search HIS patients.
        </p>
      ) : null}
      <form className="card" onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleInput}
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          value={form.password}
          onChange={handleInput}
          required
        />
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </section>
  );
};
