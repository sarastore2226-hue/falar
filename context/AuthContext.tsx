"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

interface User {
  userid: number;
  usercode: string;
  username: string;
  phone: string | null;
  address?: string;
  position: string;
  permissions: string;
}

interface AuthContextType {
  user: User | null;
  isEmployee: boolean;
  isCustomer: boolean;
  login: (
    userData: User,
    token: string,
    userType: "employee" | "customer"
  ) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = () => {
      try {
        const employee = localStorage.getItem("employee");
        const customer = localStorage.getItem("customer");

        if (employee) {
          setUser(JSON.parse(employee));
        } else if (customer) {
          setUser(JSON.parse(customer));
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = useCallback(
    (
      userData: User,
      token: string,
      userType: "employee" | "customer"
    ) => {
      setUser(userData);
      if (userType === "employee") {
        localStorage.setItem("employee", JSON.stringify(userData));
        localStorage.setItem("employeeToken", token);
        localStorage.removeItem("customer");
        localStorage.removeItem("customerToken");
      } else {
        localStorage.setItem("customer", JSON.stringify(userData));
        localStorage.setItem("customerToken", token);
        localStorage.removeItem("employee");
        localStorage.removeItem("employeeToken");
      }
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("employee");
    localStorage.removeItem("employeeToken");
    localStorage.removeItem("customer");
    localStorage.removeItem("customerToken");
    localStorage.removeItem("customer_address");
  }, []);

  const value = {
    user,
    isEmployee: user?.position === "موظف" || user?.position === "مدير",
    isCustomer: user?.position === "عميل",
    login,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}