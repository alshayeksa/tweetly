import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { AdminHeader, UsersTable, useAdminUsers } from "./_shared";
import { Loader2 } from "lucide-react";

export default function AdminUsersPage() {
  const { session, isLoading: authLoading } = useAdminAuth();
  const [, setLocation] = useLocation();
  const { users, setUsers, loading } = useAdminUsers();

  useEffect(() => {
    if (!authLoading && (!session || !session.isAdmin)) {
      setLocation("/admin/login");
    }
  }, [authLoading, session]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session?.isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title="Users" />
      <main className="p-6 max-w-7xl mx-auto">
        <UsersTable users={users} setUsers={setUsers} loading={loading} />
      </main>
    </div>
  );
}
