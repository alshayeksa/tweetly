import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Link2, Unlink, AlertCircle, CheckCircle2, Trash2, Zap, TrendingUp, Bot, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import { useSearch, useLocation, Link } from "wouter";
import { useSubscription } from "@/hooks/use-subscription";
import { TrialLimitModal } from "@/components/TrialLimitModal";

interface XStatus {
  connected: boolean;
  needsReconnect?: boolean;
  username: string | null;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteNameInput, setDeleteNameInput] = useState("");
  const [showLimitModal, setShowLimitModal] = useState(false);
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const successMsg = params.get("success");
  const planParam = params.get("plan");
  const errorMsg = params.get("error");
  const { subscription, openPortal, isOpeningPortal } = useSubscription();

  // After payment redirect: verify directly with Paylink then poll until plan updates
  useEffect(() => {
    if (successMsg !== "subscribed") return;

    const orderParam = params.get("order");

    let attempts = 0;
    const maxAttempts = 20; // poll up to 40 seconds

    const poll = async () => {
      attempts++;

      // First attempt: try direct verification via Paylink if we have orderNumber
      if (attempts === 1 && orderParam) {
        try {
          const res = await fetch(`/api/subscription/verify?order=${encodeURIComponent(orderParam)}`, {
            credentials: "include",
          });
          const data = await res.json();
          if (data.verified) {
            // Payment confirmed — refresh subscription and stop
            await queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
            return;
          }
        } catch { /* fall through to polling */ }
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      const data = queryClient.getQueryData<{ isPaid?: boolean; plan?: string }>(["/api/subscription"]);

      if ((data?.isPaid || (planParam && data?.plan === planParam)) || attempts >= maxAttempts) return;

      setTimeout(poll, 2000);
    };

    poll();
  }, [successMsg, planParam]);

  const { data: xStatus, isLoading: xLoading } = useQuery<XStatus>({
    queryKey: ["/api/x/status"],
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/x/auth-url");
      const { url } = await res.json();
      window.location.href = url;
    },
    onError: (error: any) => {
      toast({ title: error.message || error.message || t("common.error"), variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/x/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/x/status"] });
      toast({ title: t("settings.disconnectSuccess") });
    },
  });

  const { data: aiProviderData } = useQuery<{ provider: string }>({
    queryKey: ["/api/settings/ai-provider"],
  });

  const aiProviderMutation = useMutation({
    mutationFn: async (provider: string) => {
      const res = await apiRequest("PATCH", "/api/settings/ai-provider", { provider });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/settings/ai-provider"], data);
      toast({ title: t("settings.aiProviderSaved") });
    },
    onError: () => toast({ title: t("common.error"), variant: "destructive" }),
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold" data-testid="text-settings-title">{t("settings.title")}</h1>

      {/* ── Plan & Usage ─────────────────────────────────────────── */}
      {subscription && (() => {
        const planLabel: Record<string, string> = {
          free: "Free",
          starter: "Starter",
          creator: "Creator",
          pro: "Autopilot",
        };
        const label = planLabel[subscription.plan] ?? subscription.plan;
        const showUsage = subscription.monthlyLimit !== null;
        const pct = showUsage
          ? Math.min(100, Math.round((subscription.tweetsUsed / (subscription.monthlyLimit ?? 1)) * 100))
          : 100;
        const barColor = !showUsage ? "bg-emerald-500" : pct >= 100 ? "bg-rose-500" : "bg-emerald-500";
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                {t("settings.planUsage")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Plan row */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t("settings.currentPlan")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {subscription.isActive
                      ? t("settings.activeStatus")
                      : t("settings.inactiveStatus")}
                  </p>
                </div>
                <Badge
                  variant={subscription.isPaid ? "default" : "secondary"}
                  className="capitalize text-sm px-3 py-1"
                >
                  <Zap className="w-3 h-3 mr-1" />
                  {label}
                </Badge>
              </div>

              {/* Tweet usage */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{t("settings.tweetsRemaining")}</span>
                  <span className={showUsage && pct >= 100 ? "text-rose-600 font-semibold" : "text-muted-foreground"}>
                    {showUsage
                      ? `${Math.max(0, (subscription.monthlyLimit ?? 0) - subscription.tweetsUsed)} / ${subscription.monthlyLimit}`
                      : t("settings.unlimited")}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted-foreground/20 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {!showUsage
                    ? t("settings.noTweetLimit")
                    : subscription.tweetsUsed < (subscription.monthlyLimit ?? 0)
                    ? t("settings.usedThisMonth", { used: subscription.tweetsUsed, limit: subscription.monthlyLimit })
                    : t("settings.limitReached")}
                </p>

                {/* Limit reached banner */}
                {showUsage && pct >= 100 && (
                  <div className="flex items-center justify-between gap-3 mt-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <p className="text-sm font-medium text-rose-300">
                        {t("settings.limitBannerMsg")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setShowLimitModal(true)}
                      className="shrink-0 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold"
                    >
                      <Zap className="w-3.5 h-3.5 mr-1.5" />
                      {subscription.isPaid ? t("settings.limitBannerRenew") : t("settings.limitBannerUpgrade")}
                    </Button>
                  </div>
                )}

                {/* Expiry countdown warning */}
                {subscription.daysLeft !== null && subscription.daysLeft <= 3 && (
                  <div className="flex items-center gap-2 mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <p className="text-sm font-medium text-amber-300">
                      {i18n.language === "ar"
                        ? subscription.daysLeft === 1
                          ? "باقي على إنتهاء الباقة يوم"
                          : subscription.daysLeft === 2
                          ? "باقي على إنتهاء الباقة يومين"
                          : `باقي على إنتهاء الباقة ${subscription.daysLeft} أيام`
                        : subscription.daysLeft === 1
                        ? "1 day until your plan expires"
                        : `${subscription.daysLeft} days until your plan expires`}
                    </p>
                  </div>
                )}
              </div>

              {/* Expiry */}
              {subscription.subscriptionEndsAt && (
                <div className="text-sm text-muted-foreground">
                  {`${t("settings.expiredOn")} ${new Date(subscription.subscriptionEndsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
                </div>
              )}

              {/* CTA */}
              <div className="flex flex-wrap gap-3 pt-1">
                {!subscription.isPaid ? (
                  <Link href="/pricing">
                    <Button className="gap-2">
                      <Zap className="w-4 h-4" />
                      {t("settings.upgradeToPro")}
                    </Button>
                  </Link>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CheckCircle2 className="w-4 h-4 text-chart-3 shrink-0" />
                      <span>{label} {t("settings.activeStatus")}</span>
                    </div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1">
                      {({
                        free: [
                          t("pricing.plans.free.f1"),
                          t("pricing.plans.free.f2"),
                          t("pricing.plans.free.f3"),
                          t("pricing.plans.free.f4"),
                          t("pricing.plans.free.f5"),
                        ],
                        starter: [
                          t("pricing.plans.starter.f1"),
                          t("pricing.plans.starter.f2"),
                          t("pricing.plans.starter.f3"),
                          t("pricing.plans.starter.f4"),
                          t("pricing.plans.starter.f5"),
                        ],
                        creator: [
                          t("pricing.plans.creator.f1"),
                          t("pricing.plans.creator.f2"),
                          t("pricing.plans.creator.f3"),
                          t("pricing.plans.creator.f4"),
                          t("pricing.plans.creator.f5"),
                        ],
                        pro: [
                          t("pricing.plans.pro.f1"),
                          t("pricing.plans.pro.f2"),
                          t("pricing.plans.pro.f3"),
                          t("pricing.plans.pro.f4"),
                          t("pricing.plans.pro.f5"),
                          t("pricing.plans.pro.f6"),
                        ],
                      } as Record<string, string[]>)[subscription.plan]?.map((feature, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle2 className="w-3 h-3 text-chart-3 shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 gap-2"
                      onClick={() => setShowLimitModal(true)}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {i18n.language === "ar" ? "إدارة الباقة" : "Manage Plan"}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {successMsg === "subscribed" && !subscription?.isPaid && (
        <Card className="border-blue-300/30 bg-blue-50/10">
          <CardContent className="p-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-400 shrink-0 animate-spin" />
            <p className="text-sm text-blue-300">Confirming your payment... this may take a few seconds.</p>
          </CardContent>
        </Card>
      )}

      {successMsg === "connected" && (
        <Card className="border-chart-3/30 bg-chart-3/5">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-chart-3 shrink-0" />
            <p className="text-sm">{t("settings.connectedSuccess")}</p>
          </CardContent>
        </Card>
      )}

      {errorMsg && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
            <p className="text-sm">
              {errorMsg === "x_already_connected"
                ? t("settings.xAlreadyConnected")
                : t("settings.failedConnect")}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("settings.xAccountSection")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("settings.connectDesc")}
          </p>

          {xLoading ? (
            <div className="h-10 w-48 animate-pulse bg-muted rounded-md" />
          ) : xStatus?.connected ? (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" data-testid="badge-x-connected">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {t("settings.connectedBadge")}
                </Badge>
                {xStatus.username && (
                  <span className="text-sm font-medium" data-testid="text-x-username">@{xStatus.username}</span>
                )}
              </div>
              <Button
                variant="outline"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                data-testid="button-disconnect-x"
              >
                <Unlink className="w-4 h-4 mr-2" />
                {t("settings.disconnect")}
              </Button>
            </div>
          ) : xStatus?.needsReconnect ? (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Badge variant="destructive" data-testid="badge-x-needs-reconnect">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {t("settings.needsReconnect")}
                </Badge>
                {xStatus.username && (
                  <span className="text-sm font-medium" data-testid="text-x-username">@{xStatus.username}</span>
                )}
              </div>
              <p className="text-sm text-destructive w-full">
                {t("settings.noPostPermission")}
              </p>
              <Button
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
                data-testid="button-reconnect-x"
              >
                <Link2 className="w-4 h-4 mr-2" />
                {connectMutation.isPending ? t("settings.connecting") : t("settings.reconnect")}
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              data-testid="button-connect-x"
            >
              <Link2 className="w-4 h-4 mr-2" />
              {connectMutation.isPending ? t("settings.connecting") : t("settings.connect")}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ── AI Provider ──────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="w-5 h-5" />
            {t("settings.aiProviderTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("settings.aiProviderDesc")}</p>
          <div className="flex items-center gap-3">
            <Select
              value={aiProviderData?.provider || "gemini"}
              onValueChange={(v) => aiProviderMutation.mutate(v)}
              disabled={aiProviderMutation.isPending}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">🌰 {t("settings.aiProviderGemini")}</SelectItem>
                <SelectItem value="deepseek">🐳 {t("settings.aiProviderDeepSeek")}</SelectItem>
              </SelectContent>
            </Select>
            {aiProviderMutation.isPending && (
              <span className="text-xs text-muted-foreground">{t("common.loading")}</span>
            )}
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            <p><strong>Gemini:</strong> {t("settings.aiProviderGeminiNote")}</p>
            <p><strong>DeepSeek:</strong> {t("settings.aiProviderDeepSeekNote")}</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Account ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("settings.accountSection")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {user && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-20">{t("settings.nameLabel")}:</span>
                <span className="text-sm" data-testid="text-account-name">{user.firstName} {user.lastName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-20">{t("settings.emailLabel")}:</span>
                <span className="text-sm" data-testid="text-account-email">{user.email}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Delete Account ────────────────────────────────────────── */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-lg text-red-600 flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            {t("settings.deleteAccount")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("settings.dangerDesc")}
          </p>

          {!showDeleteConfirm ? (
            <Button
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => { setShowDeleteConfirm(true); setDeleteNameInput(""); }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t("settings.deleteAccount")}
            </Button>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-red-700">
                {t("settings.deleteConfirm")}
              </p>
              <div className="space-y-2">
                <p className="text-xs text-red-600">
                  {i18n.language === "ar"
                    ? `اكتب اسمك "${user?.firstName ?? ""} ${user?.lastName ?? ""}" للتأكيد`
                    : `Type your name "${user?.firstName ?? ""} ${user?.lastName ?? ""}" to confirm`}
                </p>
                <Input
                  value={deleteNameInput}
                  onChange={(e) => setDeleteNameInput(e.target.value)}
                  placeholder={`${user?.firstName ?? ""} ${user?.lastName ?? ""}`}
                  className="border-red-300 bg-white text-sm"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteNameInput.trim() !== `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()}
                  onClick={async () => {
                    try {
                      await apiRequest("DELETE", "/api/user");
                      queryClient.clear();
                      navigate("/login");
                    } catch {
                      toast({
                        title: t("common.error"),
                        description: t("settings.deleteError"),
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  {t("settings.yesDelete")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowDeleteConfirm(false); setDeleteNameInput(""); }}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <TrialLimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
      />
    </div>
  );
}
