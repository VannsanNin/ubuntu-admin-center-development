
import React, { createContext, useContext } from "react";

interface User {
  id: number;
  username: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
}

const LOCAL_USER: User = { id: 1, username: "admin", role: "admin" };

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Desktop app: always authenticated as the local administrator.
  return (
    <AuthContext.Provider value={{ user: LOCAL_USER }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
