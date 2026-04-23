import { createContext, useContext, useEffect, useState } from "react";
import api from "./api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    try {
      const res = await api.get("/auth/me");
      setUser({
        ...res.data, roles: res.data.roles || []});
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };
  const refreshUser = async () => {
  try {
    const { data } = await api.get("/auth/me");
    setUser(data);
  } catch {
    setUser(null);
  }
};

  useEffect(() => {
    fetchMe();
  }, []);

  const login = async (email, password, rememberMe = false) => {
    await api.post("/auth/login", { email, password, rememberMe });
    await fetchMe();
  };

  const logout = async () => {
    await api.post("/auth/logout");
    setUser(null);
  };
  const hasRole = (requiredRoles) => {
  if (!requiredRoles) return true; // no roles required
  if (!user?.roles?.length) return false;
  return requiredRoles.some(role =>
    user.roles.some(r => r.toLowerCase() === role.toLowerCase())
  );
};
  const value = {
    user,
    setUser,
    login,
    logout,
    hasRole
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);