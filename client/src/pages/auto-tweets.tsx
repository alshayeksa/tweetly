import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2, Clock, Play, Pause, Loader2, Bot, ChevronDown, ChevronUp, Pencil, LayoutTemplate } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TrialLimitModal } from "@/components/TrialLimitModal";
import { useSubscription } from "@/hooks/use-subscription";
import { usePlanConfig } from "@/hooks/use-plan-config";
import { XConnectionBanner } from "@/components/XConnectionBanner";
import { PromptTemplatesModal } from "@/components/PromptTemplatesModal";
import type { Automation, AutomationQueue } from "@shared/schema";

const INTERVAL_OPTIONS = [
  { value: "180", labelKey: "autoTweets.intervals.h3", fallback: "Every 3 hours" },
  { value: "360", labelKey: "autoTweets.intervals.h6", fallback: "Every 6 hours" },
  { value: "720", labelKey: "autoTweets.intervals.h12", fallback: "Every 12 hours" },
  { value: "1440", labelKey: "autoTweets.intervals.h24", fallback: "Every 24 hours" },
];

function formatInterval(minutes: number): string {
  const option = INTERVAL_OPTIONS.find(o => Number(o.value) === minutes);
  if (option) return option.label;
  if (minutes < 60) return `Every ${minutes}m`;
  if (minutes < 1440) return `Every ${Math.round(minutes / 60)}h`;
  return `Every ${Math.round(minutes / 1440)}d`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString();
}

function AutomationDetail({ automation, onLimitReached, subscription }: { automation: Automation; onLimitReached: (msg: {en:string;ar:string}) => void; subscription: any }) {
  const [expanded, setExpanded] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const [name, setName] = useState(automation.name);
  const [prompt, setPrompt] = useState(automation.prompt);
  const [tweetsPerBatch, setTweetsPerBatch] = useState(String(automation.tweetsPerBatch));
  const [intervalMinutes, setIntervalMinutes] = useState(
    String(automation.intervalMinutes === 60 ? 180 : automation.intervalMinutes)
  );
  const [language, setLanguage] = useState(automation.language || "any");
  const [tone, setTone] = useState(automation.tone || "any");
  const [hashtags, setHashtags] = useState<string[]>(automation.hashtags || []);
  const [hashtagInput, setHashtagInput] = useState("");
  const [showEditTemplatesModal, setShowEditTemplatesModal] = useState(false);

  const { data: queue } = useQuery<AutomationQueue[]>({
    queryKey: ["/api/automations", automation.id, "queue"],
    queryFn: async () => {
      const res = await fetch(`/api/automations/${automation.id}/queue`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: expanded,
  });

  const { data: history } = useQuery<AutomationQueue[]>({
    queryKey: ["/api/automations", automation.id, "history"],
    queryFn: async () => {
      const res = await fetch(`/api/automations/${automation.id}/history`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: expanded,
  });

  const { toast } = useToast();
  const { t } = useTranslation();

  const toggleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/automations/${automation.id}`, { active: !automation.active });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: automation.active ? t("autoTweets.pausedToast") : t("autoTweets.activatedToast") });
    },
    onError: (err: any) => {
      if (err.status === 403 || err.status === 402 || err.code === "PLAN_UPGRADE_REQUIRED" || err.code === "TWEET_LIMIT_REACHED") {
        onLimitReached({ en: err.messageEn || err.message, ar: err.messageAr || err.message });
      } else {
        toast({ title: err.message || "Failed", variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/automations/${automation.id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: t("autoTweets.deletedToast") });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/automations/${automation.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      setEditDialogOpen(false);
      toast({ title: t("autoTweets.updatedToast") });
    },
  });

  function handleUpdate() {
    updateMutation.mutate({
      name,
      prompt,
      tweetsPerBatch: Number(tweetsPerBatch),
      intervalMinutes: Number(intervalMinutes),
      language: language === "any" ? null : language,
      tone: tone === "any" ? null : tone,
      hashtags,
    });
  }

  function addHashtag() {
    const tag = hashtagInput.trim().replace(/^#/, "");
    if (tag && !hashtags.includes(tag)) {
      setHashtags([...hashtags, tag]);
      setHashtagInput("");
    }
  }

  return (
    <>
    <Card data-testid={`card-automation-${automation.id}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Bot className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold" data-testid={`text-automation-name-${automation.id}`}>{automation.name}</h3>
            <Badge variant={automation.active ? "default" : "secondary"}>
              {automation.active ? t("autoTweets.active") : t("autoTweets.paused")}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" data-testid={`button-edit-automation-${automation.id}`}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t("autoTweets.editTitle")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t("autoTweets.form.name")}</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("autoTweets.form.prompt")}</Label>
                    <div className="relative">
                      <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="min-h-[100px] pr-36" />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2 gap-1 text-xs"
                        onClick={() => setShowEditTemplatesModal(true)}
                      >
                        <LayoutTemplate className="w-3.5 h-3.5" />
                        {t("autoTweets.templates") || "Templates"}
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("autoTweets.tweetEvery")}</Label>
                      <Select value={intervalMinutes} onValueChange={setIntervalMinutes}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {INTERVAL_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{t(opt.labelKey)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("autoTweets.tweetsPerBatchLabel")}</Label>
                      <Select value={tweetsPerBatch} onValueChange={setTweetsPerBatch}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 5].map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("autoTweets.form.language")}</Label>
                      <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">{t("autoTweets.langOptions.any")}</SelectItem>
                          <SelectItem value="Arabic">{t("autoTweets.langOptions.Arabic")}</SelectItem>
                          <SelectItem value="English">{t("autoTweets.langOptions.English")}</SelectItem>
                          <SelectItem value="French">{t("autoTweets.langOptions.French")}</SelectItem>
                          <SelectItem value="Spanish">{t("autoTweets.langOptions.Spanish")}</SelectItem>
                          <SelectItem value="German">{t("autoTweets.langOptions.German")}</SelectItem>
                          <SelectItem value="Japanese">{t("autoTweets.langOptions.Japanese")}</SelectItem>
                          <SelectItem value="Chinese">{t("autoTweets.langOptions.Chinese")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("autoTweets.form.tone")}</Label>
                      <Select value={tone} onValueChange={setTone}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">{t("autoTweets.toneOptions.any")}</SelectItem>
                          <SelectItem value="professional">{t("autoTweets.toneOptions.professional")}</SelectItem>
                          <SelectItem value="casual">{t("autoTweets.toneOptions.casual")}</SelectItem>
                          <SelectItem value="humorous">{t("autoTweets.toneOptions.humorous")}</SelectItem>
                          <SelectItem value="inspirational">{t("autoTweets.toneOptions.inspirational")}</SelectItem>
                          <SelectItem value="educational">{t("autoTweets.toneOptions.educational")}</SelectItem>
                          <SelectItem value="informative">{t("autoTweets.toneOptions.informative")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("autoTweets.hashtagsOptional")}</Label>
                    <div className="flex gap-2">
                      <Input value={hashtagInput} onChange={(e) => setHashtagInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addHashtag())} />
                      <Button type="button" variant="outline" onClick={addHashtag}>{t("autoTweets.addHashtag")}</Button>
                    </div>
                    <div className="flex gap-1 flex-wrap mt-2">
                      {hashtags.map((h) => (
                        <Badge key={h} variant="secondary" className="cursor-pointer" onClick={() => setHashtags(hashtags.filter((t) => t !== h))}>
                          #{h} x
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button className="w-full" onClick={handleUpdate} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? t("autoTweets.updating") : t("autoTweets.saveChanges")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                // If trying to activate, check if enough tweets remain
                if (!automation.active) {
                  const remaining = (subscription?.monthlyLimit ?? 0) - (subscription?.tweetsUsed ?? 0);
                  const batchSize = automation.tweetsPerBatch ?? 1;
                  if (remaining < batchSize) {
                    onLimitReached({
                      en: `Not enough tweets remaining to run this autopilot (${remaining} left, needs ${batchSize}). Please renew your plan.`,
                      ar: `لا توجد تغريدات كافية لتشغيل هذا الأوتوبايلوت (${remaining} متبقية، يحتاج ${batchSize}). يرجى تجديد اشتراكك.`,
                    });
                    return;
                  }
                }
                toggleMutation.mutate();
              }}
              disabled={toggleMutation.isPending}
              data-testid={`button-toggle-automation-${automation.id}`}
            >
              {automation.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-automation-${automation.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2">{automation.prompt}</p>

        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span>{automation.tweetsPerBatch} {t("autoTweets.tweetsBatch")}</span>
          <span>{formatInterval(automation.intervalMinutes)}</span>
          {automation.language && <span>{t("autoTweets.langLabel")} {automation.language}</span>}
          {automation.tone && <span>{t("autoTweets.toneLabel")} {automation.tone}</span>}
          {automation.hashtags?.length > 0 && (
            <span>Tags: {automation.hashtags.map(h => `#${h}`).join(" ")}</span>
          )}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover-elevate rounded-md px-2 py-1"
          data-testid={`button-expand-automation-${automation.id}`}
        >
          <Clock className="w-3 h-3" />
          <span>{t("autoTweets.queueHistory")}</span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {expanded && (
          <div className="space-y-4 pt-2">
            <div>
              <h4 className="text-sm font-medium mb-2">{t("autoTweets.upcomingQueue")}</h4>
              {queue && queue.length > 0 ? (
                <div className="space-y-1">
                  {queue.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-xs p-2 rounded-md bg-muted/50" data-testid={`queue-item-${item.id}`}>
                      <Badge variant="outline" className="text-xs">{item.status}</Badge>
                      <span>{formatDate(item.scheduledAt as any)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t("autoTweets.noUpcoming")}</p>
              )}
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">{t("autoTweets.historySection")}</h4>
              {history && history.length > 0 ? (
                <div className="space-y-1">
                  {history.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-xs p-2 rounded-md bg-muted/50" data-testid={`history-item-${item.id}`}>
                      <Badge
                        variant={item.status === "published" ? "default" : item.status === "failed" ? "destructive" : "outline"}
                        className="text-xs"
                      >
                        {item.status}
                      </Badge>
                      <span className="flex-1 truncate">{item.tweetContent || "—"}</span>
                      {item.xPostId && <span className="text-muted-foreground">ID: {item.xPostId}</span>}
                      {item.error && <span className="text-destructive truncate max-w-[200px]">{item.error}</span>}
                      <span className="text-muted-foreground">{formatDate(item.executedAt as any)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t("autoTweets.noHistoryItems")}</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    <PromptTemplatesModal
      open={showEditTemplatesModal}
      onClose={() => setShowEditTemplatesModal(false)}
      onSelect={(text) => { setPrompt(text); setShowEditTemplatesModal(false); }}
    />
    </>
  );
}

export default function AutoTweetsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [limitMessage, setLimitMessage] = useState<{en:string;ar:string} | undefined>();
  const [showCreateTemplatesModal, setShowCreateTemplatesModal] = useState(false);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [tweetsPerBatch, setTweetsPerBatch] = useState("3");
  const [intervalMinutes, setIntervalMinutes] = useState("180");
  const [language, setLanguage] = useState("");
  const [tone, setTone] = useState("");
  const [hashtagInput, setHashtagInput] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const { subscription, isLoading: subLoading } = useSubscription();
  const { plans: planConfig } = usePlanConfig();
  const isAr = i18n.language === "ar";

  const { data: automationsList, isLoading } = useQuery<Automation[]>({
    queryKey: ["/api/automations"],
  });

  const { data: xStatus } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/x/status"],
    staleTime: 1000 * 60 * 2,
  });
  const xNotConnected = !xStatus?.connected;

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/automations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: t("autoTweets.createdToast") });
    },
    onError: (err: any) => {
      if (err.code === "PLAN_UPGRADE_REQUIRED" || err.status === 403 || err.code === "TWEET_LIMIT_REACHED" || err.status === 402) {
        setLimitMessage({ en: err.messageEn || err.message, ar: err.messageAr || err.message });
        setShowLimitModal(true);
      } else {
        toast({ title: "Failed to create automation", variant: "destructive" });
      }
    },
  });

  function resetForm() {
    setName("");
    setPrompt("");
    setTweetsPerBatch("3");
    setIntervalMinutes("60");
    setLanguage("");
    setTone("");
    setHashtagInput("");
    setHashtags([]);
    setActive(true);
  }

  function handleCreate() {
    if (!name.trim() || !prompt.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      prompt: prompt.trim(),
      tweetsPerBatch: Number(tweetsPerBatch),
      intervalMinutes: Number(intervalMinutes),
      language: language || null,
      tone: tone || null,
      hashtags,
      active,
    });
  }

  function addHashtag() {
    const tag = hashtagInput.trim().replace(/^#/, "");
    if (tag && !hashtags.includes(tag)) {
      setHashtags([...hashtags, tag]);
      setHashtagInput("");
    }
  }

  return (
    <>
    <div className="p-6 space-y-6">
      <XConnectionBanner autoPilot />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-auto-tweets-title">{t("autoTweets.title") || "Auto Tweets"}</h1>
        <Button
          data-testid="button-create-automation"
          disabled={xNotConnected}
          onClick={() => {
            const plan = subscription?.plan ?? "free";
            if (plan !== "autopilot") {
              setShowProModal(true);
              return;
            }
            if (subscription?.tweetsRemaining !== null && subscription?.tweetsRemaining !== undefined && subscription.tweetsRemaining <= 0) {
              setLimitMessage({
                en: `You've reached your monthly tweet limit (${subscription.tweetsUsed}/${subscription.monthlyLimit}). Upgrade your plan to get more tweets.`,
                ar: `لقد وصلت إلى حد التغريدات الشهري (${subscription.tweetsUsed}/${subscription.monthlyLimit}). قم بترقية خطتك للحصول على المزيد.`,
              });
              setShowLimitModal(true);
            } else {
              setDialogOpen(true);
            }
          }}
        >
          {t("autoTweets.newAutomation")}
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("autoTweets.createTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="auto-name">{t("autoTweets.form.name")}</Label>
                <Input
                  id="auto-name"
                  placeholder="e.g. Daily AI News"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="input-automation-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auto-prompt">{t("autoTweets.form.prompt")}</Label>
                <div className="relative">
                  <Textarea
                    id="auto-prompt"
                    placeholder="e.g. Write engaging tweets about the latest AI news..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="min-h-[100px] pr-36"
                    data-testid="textarea-automation-prompt"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="absolute top-2 right-2 gap-1 text-xs"
                    onClick={() => setShowCreateTemplatesModal(true)}
                  >
                    <LayoutTemplate className="w-3.5 h-3.5" />
                    {t("autoTweets.templates") || "Templates"}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("autoTweets.tweetEvery")}</Label>
                  <Select value={intervalMinutes} onValueChange={setIntervalMinutes}>
                    <SelectTrigger data-testid="select-interval">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERVAL_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{t(opt.labelKey)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("autoTweets.tweetsPerBatchLabel")}</Label>
                  <Select value={tweetsPerBatch} onValueChange={setTweetsPerBatch}>
                    <SelectTrigger data-testid="select-tweets-per-batch">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("autoTweets.languageOptional")}</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger data-testid="select-automation-language">
                      <SelectValue placeholder={t("autoTweets.langOptions.any")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">{t("autoTweets.langOptions.any")}</SelectItem>
                      <SelectItem value="Arabic">{t("autoTweets.langOptions.Arabic")}</SelectItem>
                      <SelectItem value="English">{t("autoTweets.langOptions.English")}</SelectItem>
                      <SelectItem value="French">{t("autoTweets.langOptions.French")}</SelectItem>
                      <SelectItem value="Spanish">{t("autoTweets.langOptions.Spanish")}</SelectItem>
                      <SelectItem value="German">{t("autoTweets.langOptions.German")}</SelectItem>
                      <SelectItem value="Japanese">{t("autoTweets.langOptions.Japanese")}</SelectItem>
                      <SelectItem value="Chinese">{t("autoTweets.langOptions.Chinese")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("autoTweets.toneOptional")}</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger data-testid="select-automation-tone">
                      <SelectValue placeholder={t("autoTweets.toneOptions.any")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">{t("autoTweets.toneOptions.any")}</SelectItem>
                      <SelectItem value="professional">{t("autoTweets.toneOptions.professional")}</SelectItem>
                      <SelectItem value="casual">{t("autoTweets.toneOptions.casual")}</SelectItem>
                      <SelectItem value="humorous">{t("autoTweets.toneOptions.humorous")}</SelectItem>
                      <SelectItem value="inspirational">{t("autoTweets.toneOptions.inspirational")}</SelectItem>
                      <SelectItem value="educational">{t("autoTweets.toneOptions.educational")}</SelectItem>
                      <SelectItem value="informative">{t("autoTweets.toneOptions.informative")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("autoTweets.hashtagsOptional")}</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder={t("suggestions.hashtagPlaceholder")}
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addHashtag())}
                    data-testid="input-automation-hashtag"
                  />
                  <Button type="button" variant="outline" onClick={addHashtag} data-testid="button-add-hashtag">{t("autoTweets.addHashtag")}</Button>
                </div>
                {hashtags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {hashtags.map((h) => (
                      <Badge
                        key={h}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => setHashtags(hashtags.filter((t) => t !== h))}
                      >
                        #{h} x
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={active} onCheckedChange={setActive} data-testid="switch-automation-active" />
                <Label>{t("autoTweets.startActive")}</Label>
              </div>
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={createMutation.isPending || !name.trim() || !prompt.trim()}
                data-testid="button-submit-automation"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("autoTweets.creating")}
                  </>
                ) : (
                  t("autoTweets.createFirst")
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : automationsList && automationsList.length > 0 ? (
        <div className="space-y-4">
          {automationsList.map((auto) => (
            <AutomationDetail key={auto.id} automation={auto} subscription={subscription} onLimitReached={(msg) => { setLimitMessage(msg); setShowLimitModal(true); }} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Bot className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t("autoTweets.noAutomationsTitle")}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("autoTweets.noAutomationsDesc")}
            </p>
            <Button
              onClick={() => {
                const plan = subscription?.plan ?? "free";
                if (plan !== "autopilot") {
                  setShowProModal(true);
                  return;
                }
                if (subscription?.tweetsRemaining !== null && subscription?.tweetsRemaining !== undefined && subscription.tweetsRemaining <= 0) {
                  setLimitMessage({
                    en: `You've reached your monthly tweet limit (${subscription.tweetsUsed}/${subscription.monthlyLimit}). Upgrade your plan to get more tweets.`,
                    ar: `لقد وصلت إلى حد التغريدات الشهري (${subscription.tweetsUsed}/${subscription.monthlyLimit}). قم بترقية خطتك للحصول على المزيد.`,
                  });
                  setShowLimitModal(true);
                } else {
                  setDialogOpen(true);
                }
              }}
              data-testid="button-create-first-automation"
              disabled={xNotConnected}
            >
              {t("autoTweets.createFirst")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
      {/* Pro Feature Modal */}
      {showProModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" dir={isAr ? "rtl" : "ltr"}>
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl"
            style={{ background: "linear-gradient(145deg,#0f0f0f 0%,#1a1a2e 50%,#0f0f0f 100%)", border: "1px solid rgba(251,191,36,0.15)", boxShadow: "0 0 60px rgba(251,191,36,0.08),0 25px 50px rgba(0,0,0,0.7)" }}>

            {/* Top glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-28 pointer-events-none"
              style={{ background: "radial-gradient(ellipse,rgba(251,191,36,0.15) 0%,transparent 70%)", filter: "blur(20px)" }} />

            {/* Close */}
            <button onClick={() => setShowProModal(false)} className="absolute top-3 right-3 z-10 text-zinc-600 hover:text-zinc-300 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>

            {/* Header */}
            <div className="relative pt-7 pb-3 px-6 text-center">
              <div className="inline-block text-xs font-bold tracking-widest uppercase mb-3 px-3 py-1 rounded-full"
                style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>
                {isAr ? "حصري لـ Autopilot" : "AUTOPILOT EXCLUSIVE"}
              </div>
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center text-2xl"
                style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", animation: "float 3s ease-in-out infinite" }}>
                🚀
              </div>
              <h2 className="text-xl font-bold text-white mb-1.5">
                {isAr ? "اجعل حسابك يعمل وحده" : "Put Your Account on Autopilot"}
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {isAr ? "بدل ما تكتب كل يوم — خلّ الذكاء الاصطناعي ينشر عنك تلقائياً." : "Stop posting manually every day. Let AI publish for you automatically."}
              </p>
            </div>

            {/* Stats */}
            <div className="mx-6 mb-3 grid grid-cols-3 gap-2 rounded-xl p-3"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
              {[{ value: "24/7", label: "autopilot" }, { value: `${planConfig.autopilot?.tweetLimit ?? 1500}`, label: "tweets/mo" }, { value: "∞", label: "automations" }].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-base font-bold" style={{ color: "#fbbf24" }}>{s.value}</div>
                  <div className="text-xs text-zinc-600">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Features */}
            <div className="px-6 mb-4 space-y-1.5">
              <p className="text-xs font-semibold text-zinc-400 mb-2">{isAr ? "Autopilot يتيح لك:" : "Autopilot unlocks:"}</p>
              {[
                { icon: "⚡", en: `${planConfig.autopilot?.tweetLimit ?? 1500} tweets per month`, ar: `${planConfig.autopilot?.tweetLimit ?? 1500} تغريدة شهرياً` },
                { icon: "🤖", en: "Auto-generate & publish 24/7", ar: "توليد ونشر تلقائي على مدار الساعة" },
                { icon: "🎯", en: "AI picks best posting times", ar: "الذكاء الاصطناعي يختار أفضل وقت للنشر" },
                { icon: "📈", en: "Grow your account while you sleep", ar: "نمو حسابك وأنت نائم" },
              ].map((f) => (
                <div key={f.en} className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                  style={{ background: "rgba(251,191,36,0.05)" }}>
                  <span className="text-sm flex-shrink-0">{f.icon}</span>
                  <span className="text-sm text-zinc-300">{isAr ? f.ar : f.en}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="px-6 pb-6 space-y-2">
              <button
                className="w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95 text-black disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", boxShadow: "0 4px 20px rgba(251,191,36,0.35)" }}
                onClick={async () => {
                  setShowProModal(false);
                  try {
                    const res = await fetch("/api/subscription/checkout", {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ plan: "autopilot" }),
                    });
                    const data = await res.json();
                    if (data.url) window.location.href = data.url;
                  } catch { }
                }}
              >
                🚀 {isAr ? `ابدأ Autopilot — ${planConfig.autopilot?.sar ?? 259} ر.س/شهر` : `Start Autopilot — $${planConfig.autopilot?.usd ?? 69}/month`}
              </button>
              <button onClick={() => setShowProModal(false)} className="w-full text-xs text-zinc-600 hover:text-zinc-400 py-2 transition-colors">
                {isAr ? "ربما لاحقاً" : "Maybe Later"}
              </button>
            </div>

            <style>{`@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }`}</style>
          </div>
        </div>
      )}
      <TrialLimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        message={limitMessage?.en}
        messageAr={limitMessage?.ar}
      />
      <PromptTemplatesModal
        open={showCreateTemplatesModal}
        onClose={() => setShowCreateTemplatesModal(false)}
        onSelect={(text) => { setPrompt(text); setShowCreateTemplatesModal(false); }}
      />
    </>
  );
}