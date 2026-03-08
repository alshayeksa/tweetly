import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles, Send, Trash2, LayoutTemplate } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useXReconnectToast } from "@/hooks/use-x-reconnect-toast";
import { useSubscription } from "@/hooks/use-subscription";
import { usePlanConfig } from "@/hooks/use-plan-config";
import { TrialLimitModal } from "@/components/TrialLimitModal";
import { XConnectionBanner } from "@/components/XConnectionBanner";
import { PromptTemplatesModal } from "@/components/PromptTemplatesModal";
import type { Suggestion } from "@shared/schema";
import { TweetCard } from "@/components/TweetCard";

export default function ThreadsPage() {
  const [promptText, setPromptText] = useState("");
  const [language, setLanguage] = useState("English");
  const [tone, setTone] = useState("professional");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [showTrialLimitModal, setShowTrialLimitModal] = useState(false);
  const [trialLimitMessage, setTrialLimitMessage] = useState("");
  const [trialLimitMessageAr, setTrialLimitMessageAr] = useState("");
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const showXReconnectToast = useXReconnectToast();
  const { subscription, isLoading: subLoading } = useSubscription();
  const { plans: planConfig } = usePlanConfig();
  const isAr = i18n.language === "ar";

  const { data: suggestionsList, isLoading } = useQuery<Suggestion[]>({
    queryKey: ["/api/suggestions"],
  });

  const { data: xStatus } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/x/status"],
    staleTime: 1000 * 60 * 2,
  });
  const xNotConnected = !xStatus?.connected;

  // Group suggestions by threadId
  const threads = suggestionsList?.reduce((acc, s) => {
    if (s.threadId) {
      if (!acc[s.threadId]) acc[s.threadId] = [];
      acc[s.threadId].push(s);
    }
    return acc;
  }, {} as Record<string, Suggestion[]>) || {};

  // Sort each thread by threadOrder
  Object.values(threads).forEach(t => t.sort((a, b) => (a.threadOrder || 0) - (b.threadOrder || 0)));

  const activeThreads = Object.entries(threads)
    .filter(([_, items]) => items.some(s => s.status === "pending" || s.status === "approved"))
    .map(([id, items]) => ({ id, items }));

  const generateMutation = useMutation({
    mutationFn: async ({ prompt, language, tone }: { prompt: string; language: string; tone: string }) => {
      const res = await apiRequest("POST", "/api/threads/generate", { prompt, language, tone });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
      setPromptText("");
      toast({ title: "Thread generated successfully!" });
    },
    onError: (err: any) => {
      const isLimitError = (err.code === "TWEET_LIMIT_REACHED" || err.code === "TRIAL_TWEET_LIMIT_EXCEEDED" || err.code === "PLAN_UPGRADE_REQUIRED") || err.status === 402 || err.status === 403;
      if (isLimitError) {
        setTrialLimitMessage(err.messageEn || err.message);
        setTrialLimitMessageAr(err.messageAr || err.message);
        setShowTrialLimitModal(true);
      } else if (err.code === "GENERATION_RATE_LIMIT" || err.status === 429) {
        setTrialLimitMessage(err.message);
        setTrialLimitMessageAr(err.messageAr || err.message);
        setShowTrialLimitModal(true);
      } else {
        toast({ title: err.message || "Failed to generate thread", variant: "destructive" });
      }
    },
  });

  const improveMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const res = await apiRequest("POST", "/api/prompt/improve", { prompt });
      return res.json();
    },
    onSuccess: (data) => {
      setPromptText(data.improvedPrompt);
      toast({ title: "Prompt improved!" });
    },
    onError: (err: any) => {
      if (err.code === "GENERATION_RATE_LIMIT" || err.status === 429) {
        setTrialLimitMessage(err.message);
        setTrialLimitMessageAr(err.messageAr || err.message);
        setShowTrialLimitModal(true);
      } else {
        toast({ title: "Failed to improve prompt", variant: "destructive" });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, editedContent }: { id: number; status: string; editedContent?: string }) => {
      const res = await apiRequest("PATCH", `/api/suggestions/${id}`, { status, editedContent });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
      setEditingId(null);
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/suggestions/${id}/publish`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      
      if (!res.ok) {
        const error = new Error(data.message || "Request failed") as any;
        error.status = res.status;
        error.code = data.code;
        error.messageAr = data.messageAr;
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Tweet published!" });
    },
    onError: (error: any) => {
      const isLimitError = (error.code === "TWEET_LIMIT_REACHED" || error.code === "TRIAL_TWEET_LIMIT_EXCEEDED") && error.status === 402;
      if (isLimitError) {
        setTrialLimitMessage(error.message);
        setTrialLimitMessageAr(error.messageAr);
        setShowTrialLimitModal(true);
      } else if (showXReconnectToast(error)) {
        // reconnect toast shown
      } else {
        toast({ title: error.message || "Failed to publish", variant: "destructive" });
      }
    },
  });

  const publishThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const res = await fetch(`/api/threads/${threadId}/publish`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      
      if (!res.ok) {
        const error = new Error(data.message || "Request failed") as any;
        error.status = res.status;
        error.code = data.code;
        error.messageAr = data.messageAr;
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Thread published successfully!" });
    },
    onError: (error: any) => {
      const isLimitError = (error.code === "TWEET_LIMIT_REACHED" || error.code === "TRIAL_TWEET_LIMIT_EXCEEDED") && error.status === 402;
      if (isLimitError) {
        setTrialLimitMessage(error.message);
        setTrialLimitMessageAr(error.messageAr);
        setShowTrialLimitModal(true);
      } else if (showXReconnectToast(error)) {
        // reconnect toast shown
      } else {
        toast({ title: error.message || "Failed to publish thread", variant: "destructive" });
      }
    },
  });

  const rejectFullThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const threadItems = threads[threadId];
      await Promise.all(threadItems.map(item => 
        apiRequest("PATCH", `/api/suggestions/${item.id}`, { status: "rejected" })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
      toast({ title: "Thread rejected" });
    },
  });

  return (
    <>
      <div className="flex flex-col h-full">
      <div className="px-4 pt-4"><XConnectionBanner /></div>

      
      <div className="sticky top-0 z-40 bg-background border-b p-4 space-y-3">
        <h1 className="text-2xl font-bold">{t("nav.threads")}</h1>
        <div className="relative">
          <Textarea
            placeholder={t("threads.placeholder")}
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            className="min-h-[80px] pr-36"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="absolute top-2 right-2 gap-1 text-xs"
            onClick={() => setShowTemplatesModal(true)}
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            {isAr ? "قوالب" : "Templates"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("common.templatesHint")}</p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium whitespace-nowrap">{t("threads.languageLabel")}</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t("threads.langOptions.any")}</SelectItem>
                <SelectItem value="Arabic">{t("threads.langOptions.Arabic")}</SelectItem>
                <SelectItem value="English">{t("threads.langOptions.English")}</SelectItem>
                <SelectItem value="French">{t("threads.langOptions.French")}</SelectItem>
                <SelectItem value="Spanish">{t("threads.langOptions.Spanish")}</SelectItem>
                <SelectItem value="German">{t("threads.langOptions.German")}</SelectItem>
                <SelectItem value="Japanese">{t("threads.langOptions.Japanese")}</SelectItem>
                <SelectItem value="Chinese">{t("threads.langOptions.Chinese")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium whitespace-nowrap">{t("threads.toneLabel")}</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t("threads.toneOptions.any")}</SelectItem>
                <SelectItem value="professional">{t("threads.toneOptions.professional")}</SelectItem>
                <SelectItem value="casual">{t("threads.toneOptions.casual")}</SelectItem>
                <SelectItem value="humorous">{t("threads.toneOptions.humorous")}</SelectItem>
                <SelectItem value="inspirational">{t("threads.toneOptions.inspirational")}</SelectItem>
                <SelectItem value="educational">{t("threads.toneOptions.educational")}</SelectItem>
                <SelectItem value="informative">{t("threads.toneOptions.informative")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => {
              const plan = subscription?.plan ?? "free";
              // Free plan: allowed but backend caps at 3 tweets — just proceed
              // Starter plan: threads allowed up to 6 tweets — just proceed
              // Trial: blocked
              if (subscription?.isTrial) {
                setTrialLimitMessage("Threads require an active paid plan. Upgrade to unlock thread generation.");
                setTrialLimitMessageAr("الثريدات تتطلب باقة مدفوعة نشطة. قم بالترقية لتفعيل إنشاء الثريدات.");
                setShowTrialLimitModal(true);
                return;
              }
              if (!subscription?.isActive && plan !== "free") {
                setTrialLimitMessage("Your subscription has expired. Please renew to continue.");
                setTrialLimitMessageAr("انتهت صلاحية اشتراكك. يرجى التجديد للمتابعة.");
                setShowTrialLimitModal(true);
                return;
              }
              generateMutation.mutate({ prompt: promptText, language, tone });
            }}
            disabled={!promptText.trim() || generateMutation.isPending || xNotConnected}
          >
            {generateMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" />{t("threads.generating")}</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-1" />{t("threads.generate")}</>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => improveMutation.mutate(promptText)}
            disabled={!promptText.trim() || improveMutation.isPending || xNotConnected}
          >
            {improveMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" />{t("threads.improving")}</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-1" />{t("threads.improvePrompt")}</>
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-12 pb-20">
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : activeThreads.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {t("threads.noThreads")}
          </div>
        ) : (
          activeThreads.map(({ id: threadId, items }) => (
            <div key={threadId} className="space-y-6">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-bold text-lg text-primary">{t("threads.threadStructure")}</h3>
                <div className="flex gap-2">
                  <Button 
                    size="sm"
                    variant="outline"
                    className="text-destructive border-destructive hover:bg-destructive/10"
                    onClick={() => rejectFullThreadMutation.mutate(threadId)}
                    disabled={rejectFullThreadMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> {t("threads.rejectFullThread")}
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => publishThreadMutation.mutate(threadId)}
                    disabled={publishThreadMutation.isPending || items.some(s => s.status === "published")}
                  >
                    <Send className="w-4 h-4 mr-1" /> {publishThreadMutation.isPending ? t("threads.publishing") : t("threads.publishFullThread")}
                  </Button>
                </div>
              </div>
              <div className="space-y-4">
                {items.map((suggestion, index) => (
                  <div key={suggestion.id} className="relative pl-8">
                    {/* Vertical line connector */}
                    {index < items.length - 1 && (
                      <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-border" />
                    )}
                    {/* Circle marker */}
                    <div className={`absolute left-0 top-6 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-background z-10 ${index === 0 ? 'border-primary' : 'border-muted-foreground'}`}>
                      <span className="text-[10px] font-bold">{index + 1}</span>
                    </div>
                    
                    <div className={index > 0 ? "opacity-90 scale-[0.98] origin-top-left" : ""}>
                      {index === 0 && <p className="text-xs font-bold text-primary mb-1 uppercase tracking-wider">{t("threads.mainTweet")}</p>}
                      {index > 0 && <p className="text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wider">{t("threads.subTweet", { n: index })}</p>}
                      <TweetCard
                        suggestion={suggestion}
                        editingId={editingId}
                        editText={editText}
                        setEditingId={setEditingId}
                        setEditText={setEditText}
                        saveEdit={(id) => updateMutation.mutate({ id, status: "pending", editedContent: editText })}
                        startEdit={(s) => {
                          setEditingId(s.id);
                          setEditText(s.editedContent || s.content);
                        }}
                        updateMutation={updateMutation}
                        publishMutation={publishMutation}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>

    <TrialLimitModal
      isOpen={showTrialLimitModal}
      onClose={() => setShowTrialLimitModal(false)}
      message={trialLimitMessage}
      messageAr={trialLimitMessageAr}
    />
    <PromptTemplatesModal
      open={showTemplatesModal}
      onClose={() => setShowTemplatesModal(false)}
      onSelect={(text) => { setPromptText(text); setShowTemplatesModal(false); }}
    />
    </>
  );
}
