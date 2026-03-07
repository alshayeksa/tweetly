import { useState, useEffect } from "react";
import { useLocation } from "wouter";

interface AdminSession {
  isAdmin: boolean;
  email?: string;
}

export function useAdminAuth() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    fetch("/api/admin/verify", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.isAdmin) {
          setSession({ isAdmin: true, email: data.email });
        } else {
          setSession({ isAdmin: false });
        }
      })
      .catch(() => setSession({ isAdmin: false }))
      .finally(() => setIsLoading(false));
  }, []);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    setSession({ isAdmin: false });
    setLocation("/admin/login");
  }

  return { session, isLoading, logout };
}
