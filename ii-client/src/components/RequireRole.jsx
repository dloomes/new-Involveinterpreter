// src/components/RequireRole.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function RequireRole({ roles, children }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />; // not logged in

  // check if user has at least one required role
  const hasRole = roles?.some(r =>
    user.roles.some(ur => ur.toLowerCase() === r.toLowerCase())
  );

  if (!hasRole) return <Navigate to="/" replace />; // forbidden

  return children;
}