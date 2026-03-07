import type { Express } from "express";
import { db } from "./db";
import { promptCategories, promptTemplates } from "@shared/schema";
import { eq, asc } from "drizzle-orm";

function isAdminAuthenticated(req: any, res: any, next: any) {
  if (req.session?.isAdmin === true) return next();
  return res.status(401).json({ message: "Admin authentication required" });
}

export function registerPromptTemplatesRoutes(app: Express) {
  // ── Public route ──────────────────────────────────────────────────────────

  // GET /api/prompt-templates — returns active templates grouped by category
  app.get("/api/prompt-templates", async (_req: any, res: any) => {
    try {
      const categories = await db
        .select()
        .from(promptCategories)
        .orderBy(asc(promptCategories.sortOrder));

      const templates = await db
        .select()
        .from(promptTemplates)
        .where(eq(promptTemplates.isActive, true))
        .orderBy(asc(promptTemplates.sortOrder));

      const grouped = categories
        .map((cat) => ({
          ...cat,
          templates: templates.filter((t) => t.categoryId === cat.id),
        }))
        .filter((cat) => cat.templates.length > 0);

      res.json(grouped);
    } catch (error) {
      console.error("Get prompt templates error:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  // ── Admin: Templates ──────────────────────────────────────────────────────

  // GET /api/admin/prompt-templates — all templates (with inactive) grouped by category
  app.get("/api/admin/prompt-templates", isAdminAuthenticated, async (_req: any, res: any) => {
    try {
      const categories = await db
        .select()
        .from(promptCategories)
        .orderBy(asc(promptCategories.sortOrder));

      const templates = await db
        .select()
        .from(promptTemplates)
        .orderBy(asc(promptTemplates.sortOrder));

      const grouped = categories.map((cat) => ({
        ...cat,
        templates: templates.filter((t) => t.categoryId === cat.id),
      }));

      res.json(grouped);
    } catch (error) {
      console.error("Admin get prompt templates error:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  // POST /api/admin/prompt-templates — create template
  app.post("/api/admin/prompt-templates", isAdminAuthenticated, async (req: any, res: any) => {
    try {
      const { categoryId, titleAr, titleEn, promptText, language, isActive, sortOrder } = req.body;
      if (!categoryId || !titleAr || !titleEn || !promptText) {
        return res.status(400).json({ message: "Missing required fields: categoryId, titleAr, titleEn, promptText" });
      }
      const [template] = await db
        .insert(promptTemplates)
        .values({
          categoryId: Number(categoryId),
          titleAr,
          titleEn,
          promptText,
          language: language || "ar",
          isActive: isActive ?? true,
          sortOrder: sortOrder ?? 0,
        })
        .returning();
      res.json(template);
    } catch (error) {
      console.error("Create prompt template error:", error);
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  // PUT /api/admin/prompt-templates/:id — update template
  app.put("/api/admin/prompt-templates/:id", isAdminAuthenticated, async (req: any, res: any) => {
    try {
      const id = Number(req.params.id);
      const { categoryId, titleAr, titleEn, promptText, language, isActive, sortOrder } = req.body;
      const [template] = await db
        .update(promptTemplates)
        .set({
          ...(categoryId !== undefined && { categoryId: Number(categoryId) }),
          ...(titleAr !== undefined && { titleAr }),
          ...(titleEn !== undefined && { titleEn }),
          ...(promptText !== undefined && { promptText }),
          ...(language !== undefined && { language }),
          ...(isActive !== undefined && { isActive }),
          ...(sortOrder !== undefined && { sortOrder }),
        })
        .where(eq(promptTemplates.id, id))
        .returning();
      if (!template) return res.status(404).json({ message: "Template not found" });
      res.json(template);
    } catch (error) {
      console.error("Update prompt template error:", error);
      res.status(500).json({ message: "Failed to update template" });
    }
  });

  // DELETE /api/admin/prompt-templates/:id — delete template
  app.delete("/api/admin/prompt-templates/:id", isAdminAuthenticated, async (req: any, res: any) => {
    try {
      const id = Number(req.params.id);
      await db.delete(promptTemplates).where(eq(promptTemplates.id, id));
      res.json({ message: "Deleted" });
    } catch (error) {
      console.error("Delete prompt template error:", error);
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // ── Admin: Categories ─────────────────────────────────────────────────────

  // GET /api/admin/prompt-categories
  app.get("/api/admin/prompt-categories", isAdminAuthenticated, async (_req: any, res: any) => {
    try {
      const cats = await db
        .select()
        .from(promptCategories)
        .orderBy(asc(promptCategories.sortOrder));
      res.json(cats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // POST /api/admin/prompt-categories
  app.post("/api/admin/prompt-categories", isAdminAuthenticated, async (req: any, res: any) => {
    try {
      const { value, labelAr, labelEn, sortOrder } = req.body;
      if (!value || !labelAr || !labelEn) {
        return res.status(400).json({ message: "Missing required fields: value, labelAr, labelEn" });
      }
      const [cat] = await db
        .insert(promptCategories)
        .values({ value, labelAr, labelEn, sortOrder: sortOrder ?? 0 })
        .returning();
      res.json(cat);
    } catch (error) {
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  // PUT /api/admin/prompt-categories/:id
  app.put("/api/admin/prompt-categories/:id", isAdminAuthenticated, async (req: any, res: any) => {
    try {
      const id = Number(req.params.id);
      const { value, labelAr, labelEn, sortOrder } = req.body;
      const [cat] = await db
        .update(promptCategories)
        .set({
          ...(value !== undefined && { value }),
          ...(labelAr !== undefined && { labelAr }),
          ...(labelEn !== undefined && { labelEn }),
          ...(sortOrder !== undefined && { sortOrder }),
        })
        .where(eq(promptCategories.id, id))
        .returning();
      if (!cat) return res.status(404).json({ message: "Category not found" });
      res.json(cat);
    } catch (error) {
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  // DELETE /api/admin/prompt-categories/:id
  app.delete("/api/admin/prompt-categories/:id", isAdminAuthenticated, async (req: any, res: any) => {
    try {
      const id = Number(req.params.id);
      await db.delete(promptCategories).where(eq(promptCategories.id, id));
      res.json({ message: "Deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete category" });
    }
  });
}
