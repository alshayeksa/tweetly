import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, Send, Pencil, FileText, Sparkles, Loader2, Wand2, X, LayoutTemplate } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useXReconnectToast } from "@/hooks/use-x-reconnect-toast";
import type { Suggestion } from "@shared/schema";
import { useTranslation } from "react-i18next";
import { TweetCard } from "@/components/TweetCard";
import { TrialLimitModal } from "@/components/TrialLimitModal";
import { XConnectionBanner } from "@/components/XConnectionBanner";
import { PromptTemplatesModal } from "@/components/PromptTemplatesModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SuggestionsPage() {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [promptText, setPromptText] = useState("");
  const [tweetCount, setTweetCount] = useState<string>("1");
  const [language, setLanguage] = useState("English");
  const [tone, setTone] = useState("professional");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");
  const [showTrialLimitModal, setShowTrialLimitModal] = useState(false);
  const [trialLimitMessage, setTrialLimitMessage] = useState("");
  const [trialLimitMessageAr, setTrialLimitMessageAr] = useState("");
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const { toast } = useToast();
  const showXReconnectToast = useXReconnectToast();

  const { data: suggestionsList, isLoading } = useQuery<Suggestion[]>({
    queryKey: ["/api/suggestions"],
    queryFn: async () => {
      const res = await fetch("/api/suggestions", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: xStatus } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/x/status"],
    staleTime: 1000 * 60 * 2,
  });
  const xNotConnected = !xStatus?.connected;

  const activeSuggestions = suggestionsList?.filter(s => s.status === "pending" || s.status === "approved") || [];
  const historySuggestions = suggestionsList?.filter(s => s.status === "published" || s.status === "rejected") || [];

  const generateMutation = useMutation({
    mutationFn: async ({ prompt, count, language, tone, hashtags }: { prompt: string; count: number; language?: string; tone?: string; hashtags?: string[] }) => {
      const res = await apiRequest("POST", "/api/suggestions/generate", { prompt, count, language, tone, hashtags });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setPromptText("");
      toast({ title: t("suggestions.generate") });
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
        const msg = isAr ? (err.messageAr || err.message) : (err.messageEn || err.message);
        toast({ title: msg || t("common.error"), variant: "destructive" });
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
      toast({ title: t("suggestions.improvePrompt") });
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, editedContent }: { id: number; status: string; editedContent?: string }) => {
      const res = await apiRequest("PATCH", `/api/suggestions/${id}`, { status, editedContent });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setEditingId(null);
    },
    onError: () => {
      toast({ title: "Failed to update suggestion", variant: "destructive" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      toast({ title: t("suggestions.publishedToast") });
    },
    onError: (error: any) => {
      // Handle tweet limit exceeded error (free plan or legacy trial)
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

  function handleGenerate() {
    if (!promptText.trim()) return;
    generateMutation.mutate({
      prompt: promptText,
      count: Number(tweetCount),
      language: language !== "any" ? language : undefined,
      tone: tone !== "any" ? tone : undefined,
      hashtags: hashtags.length > 0 ? hashtags : undefined,
    });
  }

  function addHashtag() {
    const tag = hashtagInput.trim().replace(/^#/, "");
    if (tag && !hashtags.includes(tag)) {
      setHashtags([...hashtags, tag]);
    }
    setHashtagInput("");
  }

  function handleImprove() {
    if (!promptText.trim()) return;
    improveMutation.mutate(promptText);
  }

  function startEdit(suggestion: Suggestion) {
    setEditingId(suggestion.id);
    setEditText(suggestion.editedContent || suggestion.content);
  }

  function saveEdit(id: number) {
    updateMutation.mutate({ id, status: "pending", editedContent: editText });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-1">
        <XConnectionBanner />
      </div>
      <div className="sticky top-0 z-40 bg-background border-b px-4 pt-2 pb-3 space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold" data-testid="text-suggestions-title">{t("suggestions.title")}</h1>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs"
                  onClick={() => setShowTemplatesModal(true)}
                  data-testid="button-prompt-templates"
                >
                  <LayoutTemplate className="w-3.5 h-3.5" />
                  {isAr ? "💡 أفكار للكتابة" : "💡 Prompt Ideas"}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-center text-xs">
                {isAr
                  ? "قوالب جاهزة لتوليد تغريدات — اختر موضوعاً وعدّل عليه"
                  : "Ready-made prompts to generate tweets — pick one and customize it"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Textarea
          placeholder={t("suggestions.placeholder")}
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          className="min-h-[80px]"
          data-testid="textarea-prompt"
        />
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium whitespace-nowrap">{t("suggestions.countLabel")}</Label>
            <Select value={tweetCount} onValueChange={setTweetCount}>
              <SelectTrigger className="w-[80px]" data-testid="select-tweet-count">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 3, 5, 10].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium whitespace-nowrap">{t("suggestions.languageLabel")}</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-[120px]" data-testid="select-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t("suggestions.languages.any")}</SelectItem>
                <SelectItem value="Arabic">{t("suggestions.languages.Arabic")}</SelectItem>
                <SelectItem value="English">{t("suggestions.languages.English")}</SelectItem>
                <SelectItem value="French">{t("suggestions.languages.French")}</SelectItem>
                <SelectItem value="Spanish">{t("suggestions.languages.Spanish")}</SelectItem>
                <SelectItem value="German">{t("suggestions.languages.German")}</SelectItem>
                <SelectItem value="Japanese">{t("suggestions.languages.Japanese")}</SelectItem>
                <SelectItem value="Chinese">{t("suggestions.languages.Chinese")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium whitespace-nowrap">{t("suggestions.toneLabel")}</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="w-[130px]" data-testid="select-tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t("suggestions.tones.any")}</SelectItem>
                <SelectItem value="professional">{t("suggestions.tones.professional")}</SelectItem>
                <SelectItem value="casual">{t("suggestions.tones.casual")}</SelectItem>
                <SelectItem value="humorous">{t("suggestions.tones.humorous")}</SelectItem>
                <SelectItem value="inspirational">{t("suggestions.tones.inspirational")}</SelectItem>
                <SelectItem value="educational">{t("suggestions.tones.educational")}</SelectItem>
                <SelectItem value="informative">{t("suggestions.tones.informative")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={handleGenerate}
            disabled={!promptText.trim() || generateMutation.isPending || xNotConnected}
            data-testid="button-generate"
          >
            {generateMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" />{t("suggestions.generating")}</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-1" />{t("suggestions.generateLabel")}</>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleImprove}
            disabled={!promptText.trim() || improveMutation.isPending || xNotConnected}
            data-testid="button-improve-prompt"
          >
            {improveMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" />{t("suggestions.improving")}</>
            ) : (
              <><Wand2 className="w-4 h-4 mr-1" />{t("suggestions.improvePrompt")}</>
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="active">{t("suggestions.activeTab")} ({activeSuggestions.length})</TabsTrigger>
            <TabsTrigger value="history">{t("suggestions.historyTabLabel")} ({historySuggestions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
                ))}
              </div>
            ) : activeSuggestions.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2" data-testid="text-no-suggestions">{t("suggestions.noActiveTweets")}</h3>
                  <p className="text-muted-foreground">{t("suggestions.noActiveTweetsDesc")}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {activeSuggestions.map((suggestion) => (
                  <TweetCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    editingId={editingId}
                    editText={editText}
                    setEditingId={setEditingId}
                    setEditText={setEditText}
                    saveEdit={saveEdit}
                    startEdit={startEdit}
                    updateMutation={updateMutation}
                    publishMutation={publishMutation}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {historySuggestions.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">{t("suggestions.noHistory")}</h3>
                  <p className="text-muted-foreground">{t("suggestions.noHistoryDesc")}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {historySuggestions.map((suggestion) => (
                  <TweetCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    editingId={editingId}
                    editText={editText}
                    setEditingId={setEditingId}
                    setEditText={setEditText}
                    saveEdit={saveEdit}
                    startEdit={startEdit}
                    updateMutation={updateMutation}
                    publishMutation={publishMutation}
                    isHistory
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
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
        onSelect={(text) => setPromptText(text)}
      />
    </div>
  );
}
