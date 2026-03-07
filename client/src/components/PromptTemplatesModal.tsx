import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import type { PromptCategory, PromptTemplate } from "@shared/schema";

interface CategoryWithTemplates extends PromptCategory {
  templates: PromptTemplate[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (promptText: string) => void;
}

export function PromptTemplatesModal({ open, onClose, onSelect }: Props) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const currentLang = i18n.language; // 'ar' | 'en' | any future language

  const { data: categories, isLoading } = useQuery<CategoryWithTemplates[]>({
    queryKey: ["/api/prompt-templates"],
    queryFn: async () => {
      const res = await fetch("/api/prompt-templates", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const [activeTab, setActiveTab] = useState<string>("");

  // Set initial tab when data loads
  const filteredCategories = (categories ?? []).map((cat) => ({
    ...cat,
    templates: cat.templates.filter((t) => t.language === currentLang),
  })).filter((cat) => cat.templates.length > 0);

  const firstCat = filteredCategories[0]?.value;
  const currentTab = activeTab || firstCat || "";

  function handleSelect(promptText: string) {
    onSelect(promptText);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className={isAr ? "text-right" : ""}>
            {isAr ? "📋 قوالب جاهزة" : "📋 Prompt Templates"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !categories || categories.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              {isAr ? "لا توجد قوالب متاحة" : "No templates available"}
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              {isAr ? "لا توجد قوالب بهذه اللغة" : "No templates available for this language"}
            </div>
          ) : (
            <Tabs
              value={currentTab}
              onValueChange={setActiveTab}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="px-4 pt-3 border-b overflow-x-auto">
                <TabsList className="h-auto flex-wrap gap-1 bg-transparent p-0 justify-start">
                  {filteredCategories.map((cat) => (
                    <TabsTrigger
                      key={cat.value}
                      value={cat.value}
                      className="text-xs sm:text-sm whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      {isAr ? cat.labelAr : cat.labelEn}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto">
                {filteredCategories.map((cat) => (
                  <TabsContent key={cat.value} value={cat.value} className="m-0 p-4 space-y-2">
                    {cat.templates.map((tmpl) => (
                      <button
                        key={tmpl.id}
                        onClick={() => handleSelect(tmpl.promptText)}
                        className="w-full text-start p-4 rounded-lg border bg-card hover:bg-accent hover:border-primary transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                              {isAr ? tmpl.titleAr : tmpl.titleEn}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {tmpl.promptText}
                            </p>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-xs">
                            {tmpl.language === "ar" ? "AR" : tmpl.language === "en" ? "EN" : "AR/EN"}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          )}
        </div>

        <div className="px-6 py-3 border-t flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            {isAr ? "إغلاق" : "Close"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
