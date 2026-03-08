import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format, isPast, isFuture } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CalendarIcon, Clock, Trash2, Pencil, CheckCircle2, XCircle, Loader2, Send, CalendarDays, Sparkles, Wand2, PenLine, X, LayoutTemplate } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/use-subscription";
import { usePlanConfig } from "@/hooks/use-plan-config";
import { TrialLimitModal } from "@/components/TrialLimitModal";
import { DailyLimitModal } from "@/components/DailyLimitModal";
import type { ScheduledTweet } from "@shared/schema";
import { cn } from "@/lib/utils";
import { XConnectionBanner } from "@/components/XConnectionBanner";
import { PromptTemplatesModal } from "@/components/PromptTemplatesModal";

const MAX_CHARS = 280;

function statusBadge(status: string, isAr: boolean) {
  switch (status) {
    case "published": return <Badge className="bg-green-500 hover:bg-green-600 text-white"><CheckCircle2 className="w-3 h-3 mr-1" />{isAr ? "منشور" : "Published"}</Badge>;
    case "failed": return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />{isAr ? "فشل" : "Failed"}</Badge>;
    case "cancelled": return <Badge variant="secondary">{isAr ? "ملغى" : "Cancelled"}</Badge>;
    default: return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />{isAr ? "مجدول" : "Scheduled"}</Badge>;
  }
}

function TweetScheduleCard({ tweet, onDelete, isDeleting }: { tweet: ScheduledTweet; onDelete: (id: number) => void; isDeleting: boolean }) {
  const { i18n } = useTranslation();
  const isArCard = i18n.language === "ar";
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(tweet.content);
  const [editDate, setEditDate] = useState<Date | undefined>(new Date(tweet.scheduledAt));
  const [editTime, setEditTime] = useState(format(new Date(tweet.scheduledAt), "HH:mm"));
  const [calOpen, setCalOpen] = useState(false);
  const { toast } = useToast();

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editDate) throw new Error("Select a date");
      const [h, m] = editTime.split(":").map(Number);
      const dt = new Date(editDate); dt.setHours(h, m, 0, 0);
      if (!isFuture(dt)) throw new Error("Scheduled time must be in the future");
      const res = await apiRequest("PATCH", `/api/scheduled-tweets/${tweet.id}`, { content: editContent, scheduledAt: dt.toISOString() });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/scheduled-tweets"] }); setEditing(false); toast({ title: "Tweet updated" }); },
    onError: (err: any) => { toast({ title: err.message || "Failed to update", variant: "destructive" }); },
  });

  const isPending = tweet.status === "pending";
  return (
    <Card className={cn("transition-all", tweet.status === "published" && "opacity-70")}>
      <CardContent className="p-4 space-y-3">
        {editing ? (
          <>
            <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="min-h-[100px] resize-none" maxLength={MAX_CHARS} />
            <p className={cn("text-xs text-right", editContent.length > MAX_CHARS - 20 ? "text-destructive" : "text-muted-foreground")}>{editContent.length}/{MAX_CHARS}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild><Button variant="outline" size="sm"><CalendarIcon className="w-4 h-4 mr-2" />{editDate ? format(editDate, "dd MMM yyyy") : "Pick date"}</Button></PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={editDate} onSelect={(d) => { setEditDate(d); setCalOpen(false); }} disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))} initialFocus /></PopoverContent>
              </Popover>
              <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="w-[120px]" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => editMutation.mutate()} disabled={editMutation.isPending || !editContent.trim()}>{editMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm whitespace-pre-wrap flex-1">{tweet.content}</p>
              <div className="flex gap-1 shrink-0">
                {isPending && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}><Pencil className="w-3.5 h-3.5" /></Button>}
                {(isPending || tweet.status === "failed") && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" disabled={isDeleting}><Trash2 className="w-3.5 h-3.5" /></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Delete scheduled tweet?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(tweet.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{format(new Date(tweet.scheduledAt), "dd MMM yyyy 'at' HH:mm")}{isPending && isPast(new Date(tweet.scheduledAt)) && <span className="text-amber-500 ml-1">(processing...)</span>}</span>
              {statusBadge(tweet.status, isArCard)}
            </div>
            {tweet.error && <p className="text-xs text-destructive bg-destructive/10 rounded p-2">{tweet.error}</p>}
            {tweet.xPostId && <a href={`https://x.com/i/web/status/${tweet.xPostId}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">View on X &rarr;</a>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface GeneratedItem { localId: string; content: string; date: Date | undefined; time: string; scheduled: boolean; scheduling: boolean; scheduledDbId?: number; }

function GeneratedTweetCard({ item, onChange, onSchedule, onRemove, isAr }: { item: GeneratedItem; onChange: (p: Partial<GeneratedItem>) => void; onSchedule: () => void; onRemove: () => void; isAr: boolean }) {
  const [calOpen, setCalOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(item.content);
  const charsLeft = MAX_CHARS - (editing ? editContent : item.content).length;

  // Scheduled state
  if (item.scheduled) return (
    <Card className="border-green-200 bg-green-50/50">
      <CardContent className="p-4 flex items-center gap-3 text-sm text-green-700">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <p className="flex-1 line-clamp-2 text-muted-foreground">{item.content}</p>
        <Badge className="bg-green-500 text-white shrink-0">{isAr ? "تمت الجدولة" : "Scheduled"}</Badge>
      </CardContent>
    </Card>
  );

  // Edit mode
  if (editing) return (
    <Card className="border-blue-200">
      <CardContent className="p-4 space-y-3">
        <div className="relative">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-[100px] resize-none"
            maxLength={MAX_CHARS}
            autoFocus
          />
          <span className={cn("absolute bottom-2 right-2 text-xs tabular-nums", charsLeft < 20 ? "text-destructive font-medium" : "text-muted-foreground")}>{charsLeft}</span>
        </div>
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="outline" onClick={() => { setEditContent(item.content); setEditing(false); }}>
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
          <Button size="sm" onClick={() => { onChange({ content: editContent }); setEditing(false); }}>
            {isAr ? "حفظ" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Normal view mode
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Tweet content */}
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.content}</p>

        {/* Date/Time row */}
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">{isAr ? "تاريخ النشر" : "Publish date"}</Label>
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-[150px] justify-start", !item.date && "text-muted-foreground")}>
                  <CalendarIcon className="w-4 h-4 mr-2 shrink-0" />{item.date ? format(item.date, "dd MMM yyyy") : (isAr ? "اختر تاريخ" : "Pick date")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={item.date} onSelect={(d) => { onChange({ date: d }); setCalOpen(false); }} disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">{isAr ? "الوقت" : "Time"}</Label>
            <Input type="time" value={item.time} onChange={(e) => onChange({ time: e.target.value })} className="w-[120px]" />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1 border-t">
          <Button size="sm" variant="outline" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={onRemove}>
            <XCircle className="w-4 h-4 mr-1" />
            {isAr ? "رفض" : "Reject"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setEditContent(item.content); setEditing(true); }}>
            <Pencil className="w-4 h-4 mr-1" />
            {isAr ? "تعديل" : "Edit"}
          </Button>
          <Button size="sm" className="ml-auto" onClick={onSchedule} disabled={item.scheduling || !item.content.trim() || !item.date}>
            {item.scheduling ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
            {isAr ? "جدولة" : "Schedule"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SchedulePage() {
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitMessage, setLimitMessage] = useState<{en:string;ar:string} | undefined>();
  const [showDailyLimitModal, setShowDailyLimitModal] = useState(false);
  const [dailyLimitRetryAfterMs, setDailyLimitRetryAfterMs] = useState<number | undefined>();
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [content, setContent] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("09:00");
  const [calOpen, setCalOpen] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [tweetCount, setTweetCount] = useState("3");
  const [language, setLanguage] = useState("English");
  const [aiTone, setAiTone] = useState("professional");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");
  const [generatedItems, setGeneratedItems] = useState<GeneratedItem[]>([]);
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const { subscription } = useSubscription();
  const { plans: planConfig } = usePlanConfig();
  const isAr = i18n.language === "ar";

  const { data: tweets, isLoading } = useQuery<ScheduledTweet[]>({ queryKey: ["/api/scheduled-tweets"] });

  const { data: xStatus } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/x/status"],
    staleTime: 1000 * 60 * 2,
  });
  const xNotConnected = !xStatus?.connected;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!content.trim()) throw new Error(isAr ? "اكتب التغريدة أولا" : "Write your tweet first");
      if (!date) throw new Error(isAr ? "اختر تاريخ النشر" : "Pick a publish date");
      const [h, m] = time.split(":").map(Number);
      const dt = new Date(date); dt.setHours(h, m, 0, 0);
      if (!isFuture(dt)) throw new Error(isAr ? "الوقت يجب أن يكون في المستقبل" : "Scheduled time must be in the future");
      const res = await apiRequest("POST", "/api/scheduled-tweets", { content: content.trim(), scheduledAt: dt.toISOString() });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/scheduled-tweets"] }); setContent(""); setDate(undefined); setTime("09:00"); toast({ title: isAr ? "تمت جدولة التغريدة" : "Tweet scheduled" }); },
    onError: (err: any) => { if (err.code === "TWEET_LIMIT_REACHED" || err.code === "TRIAL_TWEET_LIMIT_EXCEEDED" || err.code === "PLAN_UPGRADE_REQUIRED" || err.status === 402 || err.status === 403) { setLimitMessage({ en: err.messageEn || err.message, ar: err.messageAr || err.message }); setShowLimitModal(true); } else { toast({ title: err.message || "Failed to schedule", variant: "destructive" }); } },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/scheduled-tweets/${id}`); return id; },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-tweets"] });
      // Reset the scheduled badge on the generated item if it matches
      setGeneratedItems((prev) => prev.map((i) => i.scheduledDbId === deletedId ? { ...i, scheduled: false, scheduledDbId: undefined } : i));
      toast({ title: isAr ? "تم الحذف" : "Deleted" });
    },
    onError: () => { toast({ title: isAr ? "فشل الحذف" : "Failed to delete", variant: "destructive" }); },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!promptText.trim()) throw new Error(isAr ? "أدخل موضوعا أولا" : "Enter a topic first");
      const res = await apiRequest("POST", "/api/ai/generate-for-schedule", { prompt: promptText.trim(), count: Number(tweetCount), language: language !== "any" ? language : undefined, tone: aiTone !== "any" ? aiTone : undefined, hashtags: hashtags.length > 0 ? hashtags : undefined });
      return res.json() as Promise<{ tweets: string[] }>;
    },
    onSuccess: (data) => {
      const base = new Date(); base.setDate(base.getDate() + 1); base.setHours(9, 0, 0, 0);
      const items: GeneratedItem[] = data.tweets.map((tweet, i) => {
        const d = new Date(base); d.setMinutes(d.getMinutes() + i * 10);
        return { localId: `${Date.now()}-${i}`, content: tweet, date: d, time: format(d, "HH:mm"), scheduled: false, scheduling: false };
      });
      setGeneratedItems(items);
      toast({ title: isAr ? `تم توليد ${items.length} تغريدات` : `Generated ${items.length} tweets` });
    },
    onError: (err: any) => { if (err.code === "TWEET_LIMIT_REACHED" || err.code === "TRIAL_TWEET_LIMIT_EXCEEDED" || err.code === "PLAN_UPGRADE_REQUIRED" || err.status === 402 || err.status === 403) { setLimitMessage({ en: err.messageEn || err.message, ar: err.messageAr || err.message }); setShowLimitModal(true); } else if (err.code === "GENERATION_RATE_LIMIT" || err.status === 429) { setDailyLimitRetryAfterMs(err.retryAfterMs); setShowDailyLimitModal(true); } else { toast({ title: err.message || "Generation failed", variant: "destructive" }); } },
  });

  const improveMutation = useMutation({
    mutationFn: async () => { const res = await apiRequest("POST", "/api/prompt/improve", { prompt: promptText }); return res.json() as Promise<{ improvedPrompt: string }>; },
    onSuccess: (data) => { setPromptText(data.improvedPrompt); toast({ title: isAr ? "تم تحسين الطلب" : "Prompt improved" }); },
    onError: (err: any) => { if (err.code === "GENERATION_RATE_LIMIT" || err.status === 429) { setDailyLimitRetryAfterMs(err.retryAfterMs); setShowDailyLimitModal(true); } else { toast({ title: "Improve failed", variant: "destructive" }); } },
  });

  async function scheduleGeneratedItem(localId: string) {
    const item = generatedItems.find((i) => i.localId === localId);
    if (!item || !item.date) return;
    const [h, m] = item.time.split(":").map(Number);
    const dt = new Date(item.date); dt.setHours(h, m, 0, 0);
    if (!isFuture(dt)) { toast({ title: isAr ? "الوقت يجب أن يكون في المستقبل" : "Time must be in the future", variant: "destructive" }); return; }
    setGeneratedItems((prev) => prev.map((i) => i.localId === localId ? { ...i, scheduling: true } : i));
    try {
      const res = await apiRequest("POST", "/api/scheduled-tweets", { content: item.content.trim(), scheduledAt: dt.toISOString() });
      const savedTweet = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-tweets"] });
      setGeneratedItems((prev) => prev.map((i) => i.localId === localId ? { ...i, scheduled: true, scheduling: false, scheduledDbId: savedTweet?.id } : i));
      toast({ title: isAr ? "تمت الجدولة" : "Scheduled" });
    } catch (err: any) {
      setGeneratedItems((prev) => prev.map((i) => i.localId === localId ? { ...i, scheduling: false } : i));
      if (err.code === "TWEET_LIMIT_REACHED" || err.code === "TRIAL_TWEET_LIMIT_EXCEEDED" || err.code === "PLAN_UPGRADE_REQUIRED" || err.status === 402 || err.status === 403) {
        setLimitMessage({ en: err.messageEn || err.message, ar: err.messageAr || err.message });
        setShowLimitModal(true);
      } else {
        toast({ title: err.message || "Failed", variant: "destructive" });
      }
    }
  }

  function addHashtag() { const tag = hashtagInput.trim().replace(/^#/, ""); if (tag && !hashtags.includes(tag)) setHashtags([...hashtags, tag]); setHashtagInput(""); }

  const pending = tweets?.filter((t) => t.status === "pending") ?? [];
  const done = tweets?.filter((t) => t.status !== "pending") ?? [];
  const charsLeft = MAX_CHARS - content.length;

  return (
    <>
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      <XConnectionBanner />
      <div>
        <h1 className="text-2xl font-bold">{isAr ? "جدولة التغريدات" : "Schedule Tweets"}</h1>
        <p className="text-sm text-muted-foreground mt-1">{isAr ? "اكتب أو ولد تغريدات واختر وقت نشرها" : "Write or generate tweets and choose when to publish them"}</p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <Button variant={mode === "manual" ? "default" : "outline"} size="sm" onClick={() => setMode("manual")} disabled={xNotConnected} className="flex items-center gap-2"><PenLine className="w-4 h-4" />{isAr ? "كتابة يدوية" : "Write manually"}</Button>
        <Button variant={mode === "ai" ? "default" : "outline"} size="sm" onClick={() => setMode("ai")} disabled={xNotConnected} className="flex items-center gap-2"><Sparkles className="w-4 h-4" />{isAr ? "توليد بالذكاء الاصطناعي" : "Generate with AI"}</Button>
      </div>

      {/* Manual mode */}
      {mode === "manual" && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{isAr ? "تغريدة جديدة" : "New Scheduled Tweet"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Textarea placeholder={isAr ? "اكتب تغريدتك هنا..." : "Write your tweet here..."} value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[110px] resize-none pr-12" maxLength={MAX_CHARS} />
              <span className={cn("absolute bottom-2 right-2 text-xs tabular-nums", charsLeft < 20 ? "text-destructive font-medium" : "text-muted-foreground")}>{charsLeft}</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">{isAr ? "تاريخ النشر" : "Publish date"}</Label>
                <Popover open={calOpen} onOpenChange={setCalOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("w-[160px] justify-start", !date && "text-muted-foreground")}><CalendarIcon className="w-4 h-4 mr-2 shrink-0" />{date ? format(date, "dd MMM yyyy") : (isAr ? "اختر تاريخ" : "Pick a date")}</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={date} onSelect={(d) => { setDate(d); setCalOpen(false); }} disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))} initialFocus /></PopoverContent>
                </Popover>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">{isAr ? "الوقت" : "Time"}</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-[120px]" />
              </div>
            </div>
            <Button
              onClick={() => {
                if (subscription && subscription.monthlyLimit !== null && subscription.tweetsRemaining === 0) {
                  setLimitMessage({
                    en: "You've reached your plan's monthly tweet limit. Upgrade to schedule more tweets.",
                    ar: "لقد وصلت إلى الحد الشهري لتغريداتك في خطتك الحالية. قم بالترقية لجدولة المزيد.",
                  });
                  setShowLimitModal(true);
                  return;
                }
                createMutation.mutate();
              }}
              disabled={createMutation.isPending || !content.trim() || !date}
              className="w-full"
            >
              {createMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{isAr ? "جاري الجدولة..." : "Scheduling..."}</> : <><Send className="w-4 h-4 mr-2" />{isAr ? "جدولة التغريدة" : "Schedule Tweet"}</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* AI mode - compose form */}
      {mode === "ai" && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />{isAr ? "توليد تغريدات بالذكاء الاصطناعي" : "AI Tweet Generator"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Textarea placeholder={isAr ? "اكتب موضوع التغريدات هنا..." : "Describe what to tweet about..."} value={promptText} onChange={(e) => setPromptText(e.target.value)} className="min-h-[90px] pr-36" />
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
            <p className="text-xs text-muted-foreground">{isAr ? "أو اختر من القوالب الجاهزة بالضغط على زر قوالب" : "Or choose from ready-made templates by clicking the Templates button"}</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">{isAr ? "العدد:" : "Count:"}</Label>
                <Select value={tweetCount} onValueChange={setTweetCount}><SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger><SelectContent>{[1,3,5,10].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">{isAr ? "اللغة:" : "Language:"}</Label>
                <Select value={language} onValueChange={setLanguage}><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="any">{t("suggestions.languages.any")}</SelectItem><SelectItem value="Arabic">{t("suggestions.languages.Arabic")}</SelectItem><SelectItem value="English">{t("suggestions.languages.English")}</SelectItem><SelectItem value="French">{t("suggestions.languages.French")}</SelectItem><SelectItem value="Spanish">{t("suggestions.languages.Spanish")}</SelectItem><SelectItem value="German">{t("suggestions.languages.German")}</SelectItem><SelectItem value="Japanese">{t("suggestions.languages.Japanese")}</SelectItem><SelectItem value="Chinese">{t("suggestions.languages.Chinese")}</SelectItem></SelectContent></Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">{isAr ? "الأسلوب:" : "Tone:"}</Label>
                <Select value={aiTone} onValueChange={setAiTone}><SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="any">{t("suggestions.tones.any")}</SelectItem><SelectItem value="professional">{t("suggestions.tones.professional")}</SelectItem><SelectItem value="casual">{t("suggestions.tones.casual")}</SelectItem><SelectItem value="humorous">{t("suggestions.tones.humorous")}</SelectItem><SelectItem value="inspirational">{t("suggestions.tones.inspirational")}</SelectItem><SelectItem value="educational">{t("suggestions.tones.educational")}</SelectItem><SelectItem value="informative">{t("suggestions.tones.informative")}</SelectItem></SelectContent></Select>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-sm whitespace-nowrap">{isAr ? "الهاشتاقات:" : "Hashtags:"}</Label>
              <Input placeholder="#topic" value={hashtagInput} onChange={(e) => setHashtagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addHashtag(); } }} className="w-[140px]" />
              <Button size="sm" variant="outline" onClick={addHashtag} disabled={!hashtagInput.trim()}>+</Button>
              {hashtags.map((tag) => <Badge key={tag} variant="secondary" className="gap-1">#{tag}<button onClick={() => setHashtags(hashtags.filter((h) => h !== tag))}><X className="w-3 h-3" /></button></Badge>)}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                onClick={() => {
                  const plan = subscription?.plan ?? "free";
                  if (!["creator","autopilot"].includes(plan)) {
                    setLimitMessage({
                      en: `AI schedule generation requires the Creator plan or above. You're on ${plan === "free" ? "Free" : "Starter"}.`,
                      ar: `توليد الجدولة بالذكاء الاصطناعي يتطلب خطة Creator أو أعلى. أنت على خطة ${plan === "free" ? "Free" : "Starter"}.`,
                    });
                    setShowLimitModal(true);
                    return;
                  }
                  generateMutation.mutate();
                }}
                disabled={!promptText.trim() || generateMutation.isPending}
              >
                {generateMutation.isPending ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />{isAr ? "جاري التوليد..." : "Generating..."}</> : <><Sparkles className="w-4 h-4 mr-1" />{isAr ? "توليد" : "Generate"}</>}
              </Button>
              <Button variant="outline" onClick={() => improveMutation.mutate()} disabled={!promptText.trim() || improveMutation.isPending}>
                {improveMutation.isPending ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />{isAr ? "جاري التحسين..." : "Improving..."}</> : <><Wand2 className="w-4 h-4 mr-1" />{isAr ? "تحسين الطلب" : "Improve prompt"}</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated tweets  pick date/time per tweet */}
      {mode === "ai" && generatedItems.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            {isAr ? "اختر وقت نشر كل تغريدة" : "Pick a publish time for each tweet"}
            <Badge variant="secondary" className="text-xs">{generatedItems.filter((i) => !i.scheduled).length} {isAr ? "متبقية" : "remaining"}</Badge>
          </h2>
          <div className="space-y-3">
            {generatedItems.map((item) => (
              <GeneratedTweetCard key={item.localId} item={item} onChange={(p) => setGeneratedItems((prev) => prev.map((i) => i.localId === item.localId ? { ...i, ...p } : i))} onSchedule={() => scheduleGeneratedItem(item.localId)} onRemove={() => setGeneratedItems((prev) => prev.filter((i) => i.localId !== item.localId))} isAr={isAr} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      <div className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          {isAr ? "التغريدات المجدولة" : "Upcoming"}
          {pending.length > 0 && <Badge variant="secondary" className="text-xs">{pending.length}</Badge>}
        </h2>
        {isLoading ? (
          <div className="space-y-3">{[1,2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
        ) : pending.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground"><CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="text-sm">{isAr ? "لا توجد تغريدات مجدولة بعد" : "No scheduled tweets yet"}</p></CardContent></Card>
        ) : (
          <div className="space-y-3">{pending.map((t) => <TweetScheduleCard key={t.id} tweet={t} onDelete={(id) => deleteMutation.mutate(id)} isDeleting={deleteMutation.isPending} />)}</div>
        )}
      </div>

      {/* History */}
      {done.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="w-4 h-4" />{isAr ? "السجل" : "History"}</h2>
          <div className="space-y-3">{done.map((t) => <TweetScheduleCard key={t.id} tweet={t} onDelete={(id) => deleteMutation.mutate(id)} isDeleting={deleteMutation.isPending} />)}</div>
        </div>
      )}
    </div>
      <TrialLimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        message={limitMessage?.en}
        messageAr={limitMessage?.ar}
      />
      <DailyLimitModal
        isOpen={showDailyLimitModal}
        onClose={() => setShowDailyLimitModal(false)}
        retryAfterMs={dailyLimitRetryAfterMs}
      />
      <PromptTemplatesModal
        open={showTemplatesModal}
        onClose={() => setShowTemplatesModal(false)}
        onSelect={(text) => { setPromptText(text); setShowTemplatesModal(false); }}
      />
    </>
  );
}