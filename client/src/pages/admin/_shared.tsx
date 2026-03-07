import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Shield, LogOut, Search, Pencil, Trash2, ArrowLeft, Eye } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

export interface AdminUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  plan: string;
  subscriptionStatus: string | null;
  paddleCustomerId: string | null;
  paddleSubscriptionId: string | null;
  monthlyTweetLimit: number;
  tweetsUsed: number;
  tweetsResetAt: string | null;
  xUsername: string | null;
  googleId: string | null;
  xAuthId: string | null;
  aiProvider: string;
  isAdmin: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
}

function planColor(plan: string): "default" | "secondary" | "outline" | "destructive" {
  if (plan === "pro") return "destructive";
  if (plan === "creator") return "default";
  if (plan === "starter") return "secondary";
  return "outline";
}

function statusColor(status: string | null): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "trial") return "secondary";
  if (status === "expired" || status === "canceled" || status === "past_due") return "destructive";
  return "outline";
}

function fmt(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString();
}

export function AdminHeader({ title }: { title: string }) {
  const { session, logout } = useAdminAuth();
  const [, setLocation] = useLocation();

  return (
    <header className="border-b sticky top-0 z-50 bg-background px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Shield className="h-5 w-5 text-destructive" />
        <span className="font-semibold text-lg">{title}</span>
        {session?.email && (
          <span className="text-sm text-muted-foreground hidden sm:block">— {session.email}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {title !== "Admin Dashboard" && (
          <Button variant="ghost" size="sm" onClick={() => setLocation("/admin/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={logout}>
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </header>
  );
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/admin/users", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => toast({ title: "Failed to load users", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  return { users, setUsers, loading };
}

export function UsersTable({
  users,
  setUsers,
  loading,
}: {
  users: AdminUser[];
  setUsers: React.Dispatch<React.SetStateAction<AdminUser[]>>;
  loading: boolean;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  // Edit dialog state
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editPlan, setEditPlan] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editLimit, setEditLimit] = useState("");
  const [editUsed, setEditUsed] = useState("");
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete dialog state
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // View detail dialog
  const [viewUser, setViewUser] = useState<AdminUser | null>(null);

  function openEdit(user: AdminUser) {
    setEditUser(user);
    setEditPlan(user.plan);
    setEditStatus(user.subscriptionStatus ?? "none");
    setEditLimit(String(user.monthlyTweetLimit));
    setEditUsed(String(user.tweetsUsed));
    setEditIsAdmin(user.isAdmin ?? false);
  }

  async function saveEdit() {
    if (!editUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          plan: editPlan,
          subscriptionStatus: editStatus,
          monthlyTweetLimit: Number(editLimit),
          tweetsUsed: Number(editUsed),
          isAdmin: editIsAdmin,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
      toast({ title: "User updated successfully" });
      setEditUser(null);
    } catch {
      toast({ title: "Failed to update user", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteUserId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteUserId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      setUsers((prev) => prev.filter((u) => u.id !== deleteUserId));
      toast({ title: "User deleted" });
      setDeleteUserId(null);
    } catch {
      toast({ title: "Failed to delete user", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.email?.toLowerCase().includes(q) ||
      u.firstName?.toLowerCase().includes(q) ||
      u.lastName?.toLowerCase().includes(q) ||
      u.xUsername?.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle>Users ({users.length})</CardTitle>
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email, name, @username…"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Plan</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Usage</th>
                  <th className="text-left px-4 py-3 font-medium">Sub Ends</th>
                  <th className="text-left px-4 py-3 font-medium">X Account</th>
                  <th className="text-left px-4 py-3 font-medium">AI</th>
                  <th className="text-left px-4 py-3 font-medium">Admin</th>
                  <th className="text-left px-4 py-3 font-medium">Joined</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 10 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                      {search ? "No users match your search." : "No users found."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {user.firstName || user.lastName
                            ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                            : "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={planColor(user.plan)}>{user.plan}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusColor(user.subscriptionStatus)}>
                          {user.subscriptionStatus ?? "none"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {user.tweetsUsed} / {user.monthlyTweetLimit}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {user.subscriptionEndsAt ? new Date(user.subscriptionEndsAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {user.xUsername ? `@${user.xUsername}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {user.aiProvider ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {user.isAdmin ? (
                          <Badge variant="default">Admin</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setViewUser(user)}
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(user)}
                            title="Edit user"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteUserId(user.id)}
                            title="Delete user"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">{editUser.email}</p>
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={editPlan} onValueChange={setEditPlan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">free</SelectItem>
                    <SelectItem value="starter">starter</SelectItem>
                    <SelectItem value="creator">creator</SelectItem>
                    <SelectItem value="pro">pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subscription Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">none</SelectItem>
                    <SelectItem value="trial">trial</SelectItem>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="expired">expired</SelectItem>
                    <SelectItem value="canceled">canceled</SelectItem>
                    <SelectItem value="past_due">past_due</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monthly Tweet Limit</Label>
                <Input
                  type="number"
                  value={editLimit}
                  onChange={(e) => setEditLimit(e.target.value)}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>Tweets Used</Label>
                <Input
                  type="number"
                  value={editUsed}
                  onChange={(e) => setEditUsed(e.target.value)}
                  min={0}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="font-medium">Admin Access</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Grant or revoke admin privileges
                  </p>
                </div>
                <Switch checked={editIsAdmin} onCheckedChange={setEditIsAdmin} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={(open) => !open && setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user and all their data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View User Details Dialog */}
      <Dialog open={!!viewUser} onOpenChange={(open) => !open && setViewUser(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {viewUser && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="text-muted-foreground">ID</div>
                <div className="font-mono text-xs break-all">{viewUser.id}</div>

                <div className="text-muted-foreground">Email</div>
                <div>{viewUser.email ?? "—"}</div>

                <div className="text-muted-foreground">Name</div>
                <div>{`${viewUser.firstName ?? ""} ${viewUser.lastName ?? ""}`.trim() || "—"}</div>

                <div className="text-muted-foreground">Plan</div>
                <div><Badge variant={planColor(viewUser.plan)}>{viewUser.plan}</Badge></div>

                <div className="text-muted-foreground">Sub Status</div>
                <div><Badge variant={statusColor(viewUser.subscriptionStatus)}>{viewUser.subscriptionStatus ?? "none"}</Badge></div>

                <div className="text-muted-foreground">Tweets Used</div>
                <div>{viewUser.tweetsUsed} / {viewUser.monthlyTweetLimit}</div>

                <div className="text-muted-foreground">Tweets Reset At</div>
                <div>{fmt(viewUser.tweetsResetAt)}</div>

                <div className="text-muted-foreground">Trial Ends At</div>
                <div>{fmt(viewUser.trialEndsAt)}</div>

                <div className="text-muted-foreground">Sub Ends At</div>
                <div>{fmt(viewUser.subscriptionEndsAt)}</div>

                <div className="text-muted-foreground">Paddle Customer ID</div>
                <div className="font-mono text-xs break-all">{viewUser.paddleCustomerId ?? "—"}</div>

                <div className="text-muted-foreground">Paddle Sub ID</div>
                <div className="font-mono text-xs break-all">{viewUser.paddleSubscriptionId ?? "—"}</div>

                <div className="text-muted-foreground">X Username</div>
                <div>{viewUser.xUsername ? `@${viewUser.xUsername}` : "—"}</div>

                <div className="text-muted-foreground">X Auth ID</div>
                <div className="font-mono text-xs break-all">{viewUser.xAuthId ?? "—"}</div>

                <div className="text-muted-foreground">Google ID</div>
                <div className="font-mono text-xs break-all">{viewUser.googleId ?? "—"}</div>

                <div className="text-muted-foreground">AI Provider</div>
                <div>{viewUser.aiProvider}</div>

                <div className="text-muted-foreground">Admin</div>
                <div>{viewUser.isAdmin ? <Badge variant="default">Yes</Badge> : "No"}</div>

                <div className="text-muted-foreground">Created At</div>
                <div>{fmt(viewUser.createdAt)}</div>

                <div className="text-muted-foreground">Updated At</div>
                <div>{fmt(viewUser.updatedAt)}</div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewUser(null)}>Close</Button>
            {viewUser && (
              <Button onClick={() => { openEdit(viewUser); setViewUser(null); }}>
                <Pencil className="h-4 w-4 mr-2" /> Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
