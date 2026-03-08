import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { AdminHeader } from "./_shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Loader2, Plus, Trash2, Eye, Pencil } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Voucher {
  id: number;
  code: string;
  discountPercent: number;
  expiresAt: string | null;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  plan: string | null;
  createdAt: string;
}

interface VoucherUse {
  id: number;
  voucherId: number;
  userId: string;
  usedAt: string;
  plan: string;
  originalAmount: number;
  discountedAmount: number;
  userEmail: string | null;
  userFirstName: string | null;
  userLastName: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString();
}

function fmtDateTime(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString();
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminVouchersPage() {
  const { session, isLoading: authLoading } = useAdminAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [vouchers, setVouchers]   = useState<Voucher[]>([]);
  const [loading, setLoading]     = useState(true);

  // Create dialog
  const [showCreate, setShowCreate]       = useState(false);
  const [createCode, setCreateCode]       = useState("");
  const [createDiscount, setCreateDiscount] = useState("10");
  const [createExpiry, setCreateExpiry]   = useState("");
  const [createMaxUses, setCreateMaxUses] = useState("");
  const [createPlan, setCreatePlan]       = useState("all");
  const [createActive, setCreateActive]   = useState(true);
  const [creating, setCreating]           = useState(false);

  // Edit dialog
  const [editVoucher, setEditVoucher]     = useState<Voucher | null>(null);
  const [editDiscount, setEditDiscount]   = useState("");
  const [editExpiry, setEditExpiry]       = useState("");
  const [editMaxUses, setEditMaxUses]     = useState("");
  const [editPlan, setEditPlan]           = useState("all");
  const [editActive, setEditActive]       = useState(true);
  const [saving, setSaving]               = useState(false);

  // Delete dialog
  const [deleteId, setDeleteId]   = useState<number | null>(null);
  const [deleting, setDeleting]   = useState(false);

  // Uses dialog
  const [usesVoucher, setUsesVoucher]     = useState<Voucher | null>(null);
  const [uses, setUses]                   = useState<VoucherUse[]>([]);
  const [loadingUses, setLoadingUses]     = useState(false);

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && (!session || !session.isAdmin)) {
      setLocation("/admin/login");
    }
  }, [authLoading, session]);

  // ── Load vouchers ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.isAdmin) return;
    fetch("/api/admin/vouchers", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setVouchers(Array.isArray(data) ? data : []))
      .catch(() => toast({ title: "Failed to load vouchers", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [session]);

  // ── Create voucher ─────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!createCode.trim()) {
      toast({ title: "Code is required", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/vouchers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code:            createCode.trim().toUpperCase(),
          discountPercent: Number(createDiscount),
          expiresAt:       createExpiry || null,
          maxUses:         createMaxUses ? Number(createMaxUses) : null,
          isActive:        createActive,
          plan:            createPlan === "all" ? null : createPlan,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed");
      setVouchers((prev) => [data, ...prev]);
      toast({ title: "Voucher created successfully" });
      setShowCreate(false);
      setCreateCode(""); setCreateDiscount("10"); setCreateExpiry("");
      setCreateMaxUses(""); setCreatePlan("all"); setCreateActive(true);
    } catch (err: any) {
      toast({ title: err.message || "Failed to create voucher", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  // ── Open edit dialog ───────────────────────────────────────────────────────
  function openEdit(v: Voucher) {
    setEditVoucher(v);
    setEditDiscount(String(v.discountPercent));
    setEditExpiry(v.expiresAt ? v.expiresAt.slice(0, 10) : "");
    setEditMaxUses(v.maxUses != null ? String(v.maxUses) : "");
    setEditPlan(v.plan ?? "all");
    setEditActive(v.isActive);
  }

  // ── Save edit ──────────────────────────────────────────────────────────────
  async function handleEdit() {
    if (!editVoucher) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/vouchers/${editVoucher.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discountPercent: Number(editDiscount),
          expiresAt:       editExpiry || null,
          maxUses:         editMaxUses ? Number(editMaxUses) : null,
          isActive:        editActive,
          plan:            editPlan === "all" ? null : editPlan,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed");
      setVouchers((prev) => prev.map((v) => (v.id === data.id ? data : v)));
      toast({ title: "Voucher updated" });
      setEditVoucher(null);
    } catch (err: any) {
      toast({ title: err.message || "Failed to update voucher", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // ── Quick toggle active ────────────────────────────────────────────────────
  async function toggleActive(v: Voucher) {
    try {
      const res = await fetch(`/api/admin/vouchers/${v.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !v.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setVouchers((prev) => prev.map((x) => (x.id === data.id ? data : x)));
    } catch {
      toast({ title: "Failed to update voucher", variant: "destructive" });
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/vouchers/${deleteId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      setVouchers((prev) => prev.filter((v) => v.id !== deleteId));
      toast({ title: "Voucher deleted" });
      setDeleteId(null);
    } catch {
      toast({ title: "Failed to delete voucher", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  // ── View uses ──────────────────────────────────────────────────────────────
  async function openUses(v: Voucher) {
    setUsesVoucher(v);
    setUses([]);
    setLoadingUses(true);
    try {
      const res = await fetch(`/api/admin/vouchers/${v.id}/uses`, { credentials: "include" });
      const data = await res.json();
      setUses(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Failed to load uses", variant: "destructive" });
    } finally {
      setLoadingUses(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!session?.isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title="Voucher Codes" />

      <main className="p-6 max-w-6xl mx-auto space-y-6">

        {/* Action row */}
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">
            All Vouchers <span className="text-muted-foreground font-normal">({vouchers.length})</span>
          </h2>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" /> New Voucher
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium">Code</th>
                    <th className="text-left px-4 py-3 font-medium">Discount</th>
                    <th className="text-left px-4 py-3 font-medium">Plan</th>
                    <th className="text-left px-4 py-3 font-medium">Expires</th>
                    <th className="text-left px-4 py-3 font-medium">Uses</th>
                    <th className="text-left px-4 py-3 font-medium">Active</th>
                    <th className="text-left px-4 py-3 font-medium">Created</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <Skeleton className="h-4 w-full" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : vouchers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                        No vouchers yet. Create your first one!
                      </td>
                    </tr>
                  ) : (
                    vouchers.map((v) => (
                      <tr key={v.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold tracking-wider">{v.code}</td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary">{v.discountPercent}% off</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {v.plan ?? <span className="italic text-xs">All plans</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {v.expiresAt ? (
                            new Date(v.expiresAt) < new Date()
                              ? <span className="text-destructive">{fmt(v.expiresAt)} (expired)</span>
                              : fmt(v.expiresAt)
                          ) : "Never"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {v.usedCount}{v.maxUses != null ? ` / ${v.maxUses}` : ""}
                        </td>
                        <td className="px-4 py-3">
                          <Switch
                            checked={v.isActive}
                            onCheckedChange={() => toggleActive(v)}
                          />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{fmt(v.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon" variant="ghost"
                              onClick={() => openUses(v)}
                              title="View uses"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon" variant="ghost"
                              onClick={() => openEdit(v)}
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon" variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(v.id)}
                              title="Delete"
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
      </main>

      {/* ── Create Dialog ──────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Voucher</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Code <span className="text-muted-foreground text-xs">(uppercase, no spaces)</span></Label>
              <Input
                placeholder="TWEETLY50"
                value={createCode}
                onChange={(e) => setCreateCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
                className="font-mono tracking-widest"
              />
            </div>
            <div className="space-y-2">
              <Label>Discount %</Label>
              <Input
                type="number" min={1} max={100}
                value={createDiscount}
                onChange={(e) => setCreateDiscount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Valid for Plan</Label>
              <Select value={createPlan} onValueChange={setCreatePlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All plans</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="creator">Creator</SelectItem>
                  <SelectItem value="autopilot">Autopilot</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Expires At <span className="text-muted-foreground text-xs">(leave blank = never)</span></Label>
              <Input
                type="date"
                value={createExpiry}
                onChange={(e) => setCreateExpiry(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Uses <span className="text-muted-foreground text-xs">(leave blank = unlimited)</span></Label>
              <Input
                type="number" min={1}
                placeholder="e.g. 100"
                value={createMaxUses}
                onChange={(e) => setCreateMaxUses(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="font-medium">Active</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Allow users to apply this code</p>
              </div>
              <Switch checked={createActive} onCheckedChange={setCreateActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ────────────────────────────────────────────── */}
      <Dialog open={!!editVoucher} onOpenChange={(open) => !open && setEditVoucher(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Voucher — <span className="font-mono">{editVoucher?.code}</span></DialogTitle>
          </DialogHeader>
          {editVoucher && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Discount %</Label>
                <Input
                  type="number" min={1} max={100}
                  value={editDiscount}
                  onChange={(e) => setEditDiscount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Valid for Plan</Label>
                <Select value={editPlan} onValueChange={setEditPlan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All plans</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="creator">Creator</SelectItem>
                    <SelectItem value="autopilot">Autopilot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Expires At <span className="text-muted-foreground text-xs">(blank = never)</span></Label>
                <Input
                  type="date"
                  value={editExpiry}
                  onChange={(e) => setEditExpiry(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Uses <span className="text-muted-foreground text-xs">(blank = unlimited)</span></Label>
                <Input
                  type="number" min={1}
                  value={editMaxUses}
                  onChange={(e) => setEditMaxUses(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="font-medium">Active</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Allow users to apply this code</p>
                </div>
                <Switch checked={editActive} onCheckedChange={setEditActive} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditVoucher(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ─────────────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Voucher</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the voucher and all its usage history. This cannot be undone.
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

      {/* ── View Uses Dialog ───────────────────────────────────────── */}
      <Dialog open={!!usesVoucher} onOpenChange={(open) => !open && setUsesVoucher(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Usage History — <span className="font-mono">{usesVoucher?.code}</span>
            </DialogTitle>
          </DialogHeader>

          {loadingUses ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : uses.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">No uses yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium">User</th>
                    <th className="text-left px-3 py-2 font-medium">Plan</th>
                    <th className="text-left px-3 py-2 font-medium">Original</th>
                    <th className="text-left px-3 py-2 font-medium">Paid</th>
                    <th className="text-left px-3 py-2 font-medium">Saved</th>
                    <th className="text-left px-3 py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {uses.map((u) => (
                    <tr key={u.id} className="border-b hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <div className="font-medium text-xs">
                          {u.userFirstName || u.userLastName
                            ? `${u.userFirstName ?? ""} ${u.userLastName ?? ""}`.trim()
                            : u.userId}
                        </div>
                        <div className="text-muted-foreground text-xs">{u.userEmail ?? "—"}</div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary">{u.plan}</Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{u.originalAmount} SAR</td>
                      <td className="px-3 py-2 font-medium text-emerald-600">{u.discountedAmount} SAR</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {u.originalAmount - u.discountedAmount} SAR
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{fmtDateTime(u.usedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground mt-3 px-3">
                Total uses: {uses.length} &nbsp;·&nbsp;
                Total saved: {uses.reduce((acc, u) => acc + (u.originalAmount - u.discountedAmount), 0)} SAR
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setUsesVoucher(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
