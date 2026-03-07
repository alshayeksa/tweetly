import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { AdminHeader } from "./_shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, Plus, Trash2, Pencil, ChevronDown, ChevronRight } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PromptTemplate {
  id: number;
  categoryId: number;
  titleAr: string;
  titleEn: string;
  promptText: string;
  language: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

interface Category {
  id: number;
  value: string;
  labelAr: string;
  labelEn: string;
  sortOrder: number;
  createdAt: string;
  templates: PromptTemplate[];
}

const EMPTY_TEMPLATE: Omit<PromptTemplate, "id" | "createdAt"> = {
  categoryId: 0,
  titleAr: "",
  titleEn: "",
  promptText: "",
  language: "ar",
  isActive: true,
  sortOrder: 0,
};

const EMPTY_CATEGORY = { value: "", labelAr: "", labelEn: "", sortOrder: 0 };

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminPromptTemplatesPage() {
  const { session, isLoading: authLoading } = useAdminAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set());

  // Template dialog
  const [templateDialog, setTemplateDialog] = useState<{ open: boolean; editing: PromptTemplate | null }>({
    open: false,
    editing: null,
  });
  const [tmplForm, setTmplForm] = useState(EMPTY_TEMPLATE);
  const [savingTmpl, setSavingTmpl] = useState(false);
  const [deleteTemplateId, setDeleteTemplateId] = useState<number | null>(null);

  // Category dialog
  const [catDialog, setCatDialog] = useState<{ open: boolean; editing: Category | null }>({
    open: false,
    editing: null,
  });
  const [catForm, setCatForm] = useState(EMPTY_CATEGORY);
  const [savingCat, setSavingCat] = useState(false);
  const [deleteCatId, setDeleteCatId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && (!session || !session.isAdmin)) {
      setLocation("/admin/login");
    }
  }, [authLoading, session]);

  useEffect(() => {
    if (!session?.isAdmin) return;
    fetchAll();
  }, [session]);

  async function fetchAll() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/prompt-templates", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      const data: Category[] = await res.json();
      setCategories(data);
      // Expand all by default
      setExpandedCats(new Set(data.map((c) => c.id)));
    } catch {
      toast({ title: "Failed to load templates", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // ── Template CRUD ──────────────────────────────────────────────────────────

  function openCreateTemplate(catId?: number) {
    setTmplForm({ ...EMPTY_TEMPLATE, categoryId: catId ?? 0 });
    setTemplateDialog({ open: true, editing: null });
  }

  function openEditTemplate(tmpl: PromptTemplate) {
    setTmplForm({
      categoryId: tmpl.categoryId,
      titleAr: tmpl.titleAr,
      titleEn: tmpl.titleEn,
      promptText: tmpl.promptText,
      language: tmpl.language,
      isActive: tmpl.isActive,
      sortOrder: tmpl.sortOrder,
    });
    setTemplateDialog({ open: true, editing: tmpl });
  }

  async function saveTemplate() {
    if (!tmplForm.titleAr || !tmplForm.titleEn || !tmplForm.promptText || !tmplForm.categoryId) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    setSavingTmpl(true);
    try {
      const isEdit = !!templateDialog.editing;
      const url = isEdit
        ? `/api/admin/prompt-templates/${templateDialog.editing!.id}`
        : "/api/admin/prompt-templates";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tmplForm),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: isEdit ? "Template updated" : "Template created" });
      setTemplateDialog({ open: false, editing: null });
      fetchAll();
    } catch {
      toast({ title: "Failed to save template", variant: "destructive" });
    } finally {
      setSavingTmpl(false);
    }
  }

  async function deleteTemplate(id: number) {
    try {
      const res = await fetch(`/api/admin/prompt-templates/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Template deleted" });
      setDeleteTemplateId(null);
      fetchAll();
    } catch {
      toast({ title: "Failed to delete template", variant: "destructive" });
    }
  }

  // ── Category CRUD ──────────────────────────────────────────────────────────

  function openCreateCategory() {
    setCatForm(EMPTY_CATEGORY);
    setCatDialog({ open: true, editing: null });
  }

  function openEditCategory(cat: Category) {
    setCatForm({ value: cat.value, labelAr: cat.labelAr, labelEn: cat.labelEn, sortOrder: cat.sortOrder });
    setCatDialog({ open: true, editing: cat });
  }

  async function saveCategory() {
    if (!catForm.value || !catForm.labelAr || !catForm.labelEn) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    setSavingCat(true);
    try {
      const isEdit = !!catDialog.editing;
      const url = isEdit
        ? `/api/admin/prompt-categories/${catDialog.editing!.id}`
        : "/api/admin/prompt-categories";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(catForm),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: isEdit ? "Category updated" : "Category created" });
      setCatDialog({ open: false, editing: null });
      fetchAll();
    } catch {
      toast({ title: "Failed to save category", variant: "destructive" });
    } finally {
      setSavingCat(false);
    }
  }

  async function deleteCategory(id: number) {
    try {
      const res = await fetch(`/api/admin/prompt-categories/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Category deleted" });
      setDeleteCatId(null);
      fetchAll();
    } catch {
      toast({ title: "Failed to delete category", variant: "destructive" });
    }
  }

  function toggleCat(id: number) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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
      <AdminHeader title="Prompt Templates" />

      <main className="p-6 space-y-4 max-w-4xl mx-auto">
        {/* Header actions */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-muted-foreground">
            Manage prompt template categories and templates shown to users.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={openCreateCategory}>
              <Plus className="h-4 w-4 mr-1" />
              New Category
            </Button>
            <Button size="sm" onClick={() => openCreateTemplate()}>
              <Plus className="h-4 w-4 mr-1" />
              New Template
            </Button>
          </div>
        </div>

        {/* Categories + templates list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              No categories yet. Create one to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {categories.map((cat) => (
              <Card key={cat.id}>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      className="flex items-center gap-2 flex-1 text-left"
                      onClick={() => toggleCat(cat.id)}
                    >
                      {expandedCats.has(cat.id) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <CardTitle className="text-base">
                        {cat.labelAr}
                        <span className="text-muted-foreground font-normal ml-2 text-sm">
                          / {cat.labelEn}
                        </span>
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {cat.templates.length} templates
                      </Badge>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => openCreateTemplate(cat.id)}
                        title="Add template to this category"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => openEditCategory(cat)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteCatId(cat.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {expandedCats.has(cat.id) && cat.templates.length > 0 && (
                  <CardContent className="pt-0 pb-3 px-4">
                    <div className="border rounded-md divide-y">
                      {cat.templates.map((tmpl) => (
                        <div key={tmpl.id} className="flex items-start gap-3 p-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{tmpl.titleAr}</span>
                              <span className="text-muted-foreground text-xs">/ {tmpl.titleEn}</span>
                              <Badge variant={tmpl.isActive ? "default" : "secondary"} className="text-xs">
                                {tmpl.isActive ? "Active" : "Inactive"}
                              </Badge>
                              <Badge variant="outline" className="text-xs uppercase">
                                {tmpl.language}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {tmpl.promptText}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => openEditTemplate(tmpl)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTemplateId(tmpl.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* ── Template Dialog ────────────────────────────────────────────────── */}
      <Dialog
        open={templateDialog.open}
        onOpenChange={(v) => !v && setTemplateDialog({ open: false, editing: null })}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {templateDialog.editing ? "Edit Template" : "New Template"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select
                value={String(tmplForm.categoryId || "")}
                onValueChange={(v) => setTmplForm((f) => ({ ...f, categoryId: Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.labelAr} / {c.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Title (Arabic) *</Label>
                <Input
                  value={tmplForm.titleAr}
                  onChange={(e) => setTmplForm((f) => ({ ...f, titleAr: e.target.value }))}
                  placeholder="اسم القالب"
                  dir="rtl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Title (English) *</Label>
                <Input
                  value={tmplForm.titleEn}
                  onChange={(e) => setTmplForm((f) => ({ ...f, titleEn: e.target.value }))}
                  placeholder="Template name"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Prompt Text *</Label>
              <Textarea
                value={tmplForm.promptText}
                onChange={(e) => setTmplForm((f) => ({ ...f, promptText: e.target.value }))}
                placeholder="Full prompt text..."
                rows={4}
                dir="rtl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Language</Label>
                <Select
                  value={tmplForm.language}
                  onValueChange={(v) => setTmplForm((f) => ({ ...f, language: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">Arabic</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={tmplForm.sortOrder}
                  onChange={(e) => setTmplForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="tmpl-active"
                checked={tmplForm.isActive}
                onCheckedChange={(v) => setTmplForm((f) => ({ ...f, isActive: v }))}
              />
              <Label htmlFor="tmpl-active">Active (visible to users)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialog({ open: false, editing: null })}>
              Cancel
            </Button>
            <Button onClick={saveTemplate} disabled={savingTmpl}>
              {savingTmpl && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {templateDialog.editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Category Dialog ────────────────────────────────────────────────── */}
      <Dialog
        open={catDialog.open}
        onOpenChange={(v) => !v && setCatDialog({ open: false, editing: null })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {catDialog.editing ? "Edit Category" : "New Category"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Value (slug) *</Label>
              <Input
                value={catForm.value}
                onChange={(e) => setCatForm((f) => ({ ...f, value: e.target.value.toLowerCase().replace(/\s+/g, "_") }))}
                placeholder="e.g. ai, marketing, crypto"
                disabled={!!catDialog.editing}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Label (Arabic) *</Label>
              <Input
                value={catForm.labelAr}
                onChange={(e) => setCatForm((f) => ({ ...f, labelAr: e.target.value }))}
                placeholder="🤖 ذكاء اصطناعي"
                dir="rtl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Label (English) *</Label>
              <Input
                value={catForm.labelEn}
                onChange={(e) => setCatForm((f) => ({ ...f, labelEn: e.target.value }))}
                placeholder="🤖 AI"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={catForm.sortOrder}
                onChange={(e) => setCatForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialog({ open: false, editing: null })}>
              Cancel
            </Button>
            <Button onClick={saveCategory} disabled={savingCat}>
              {savingCat && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {catDialog.editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm delete template ────────────────────────────────────────── */}
      <AlertDialog
        open={deleteTemplateId !== null}
        onOpenChange={(v) => !v && setDeleteTemplateId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTemplateId !== null && deleteTemplate(deleteTemplateId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirm delete category ────────────────────────────────────────── */}
      <AlertDialog
        open={deleteCatId !== null}
        onOpenChange={(v) => !v && setDeleteCatId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category?</AlertDialogTitle>
            <AlertDialogDescription>
              All templates in this category will also be deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteCatId !== null && deleteCategory(deleteCatId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
