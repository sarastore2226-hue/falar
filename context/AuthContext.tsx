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

function safeBase64DecodeUtf8(base64Payload: string): string {
  const base64 = base64Payload.replace(/-/g, "+").replace(/_/g, "/");
  const binaryString = atob(base64);
  const bytes = Uint8Array.from(binaryString, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const loadUser = () => {
      try {
        // 1. فحص وجود توكن دخول مباشر في الرابط (مثل https://www.vooy.shop/?token=...)
        if (typeof window !== "undefined") {
          const urlParams = new URLSearchParams(window.location.search);
          const urlToken = urlParams.get("token");

          if (urlToken) {
            const [base64Payload] = urlToken.split(".");
            if (base64Payload) {
              const decodedJson = safeBase64DecodeUtf8(base64Payload);
              const payload = JSON.parse(decodedJson);

              if (payload && payload.phone) {
                const tokenAddress =
                  payload.address && payload.address !== "استلام من المعرض"
                    ? String(payload.address).trim()
                    : "";

                if (tokenAddress) {
                  localStorage.setItem("customer_address", tokenAddress);
                } else {
                  localStorage.removeItem("customer_address");
                }

                login(
                  {
                    userid: Number(payload.userId),
                    usercode: String(payload.usercode || ""),
                    username: String(payload.username || "عميل المعرض"),
                    phone: String(payload.phone),
                    address: tokenAddress,
                    position: "عميل",
                    permissions: "view_products",
                  },
                  `customer_${payload.userId}_pos`,
                  "customer"
                );

                // تنظيف الرابط من التوكن في الصفحة الرئيسية والصفحات العامة
                if (!window.location.pathname.startsWith("/order/view")) {
                  urlParams.delete("token");
                  const remainingQuery = urlParams.toString();
                  const cleanUrl = `${window.location.pathname}${
                    remainingQuery ? `?${remainingQuery}` : ""
                  }${window.location.hash}`;
                  window.history.replaceState({}, "", cleanUrl);
                }
                return;
              }
            }
          }
        }

        // 2. التحميل المعتاد من localStorage
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
  }, [login]);

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