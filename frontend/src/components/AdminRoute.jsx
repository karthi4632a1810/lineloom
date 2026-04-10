import { Navigate } from "react-router-dom";

export const AdminRoute = ({ children }) => {
  const role = localStorage.getItem("auth_role") ?? "";
  if (role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};
