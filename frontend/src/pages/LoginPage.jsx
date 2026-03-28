import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginRequest } from "../services/authService";

const initialForm = { email: "", password: "" };

export const LoginPage = () => {
  const [form, setForm] = useState(initialForm);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

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
      localStorage.setItem("auth_token", payload?.token ?? "");
      localStorage.setItem("auth_role", payload?.user?.role ?? "nurse");
      navigate("/dashboard");
    } catch (requestError) {
      setError(requestError?.message ?? "Invalid login attempt");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="page">
      <h2>Login</h2>
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
