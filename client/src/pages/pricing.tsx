import { useState } from "react";
import { Check, Zap, Sparkles, Tag, CheckCircle2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { useSubscription } from "@/hooks/use-subscription";
import { useAuth } from "@/hooks/use-auth";
import { usePlanPrices } from "@/hooks/use-plan-prices";
import { usePlanConfig } from "@/hooks/use-plan-config";
import { Link } from "wouter";

export default function PricingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isLoggedIn = !!user;
  const { subscription, subscribe, isSubscribing, openPortal, isOpeningPortal } = useSubscription();
  const { prices } = usePlanPrices();
  const { plans: planConfig } = usePlanConfig();
  const [sarVisible, setSarVisible] = useState<string | null>(null);

  const planRank: Record<string, number> = { free: 0, starter: 1, creator: 2, pro: 3 };
  const getPlanLabel = (key: string) => planConfig[key]?.label ?? key;
  const getPlanTweetLimit = (key: string) => planConfig[key]?.tweetLimit ?? 0;
  const userPlanRank = planRank[subscription?.plan ?? "free"] ?? 0;

  // ── Voucher state ───────────────────────────────────────
  const [voucherInput, setVoucherInput]   = useState("");
  const [voucherStatus, setVoucherStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [voucherError, setVoucherError]   = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<{
    code: string;
    discountPercent: number;
    voucherPlan: string | null;
  } | null>(null);

  async function applyVoucher() {
    const code = voucherInput.trim().toUpperCase();
    if (!code) return;
    setVoucherStatus("loading");
    try {
      const res  = await fetch("/api/voucher/validate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.valid) {
        setAppliedVoucher({ code, discountPercent: data.discountPercent, voucherPlan: data.voucherPlan });
        setVoucherStatus("success");
        setVoucherError("");
      } else {
        setAppliedVoucher(null);
        setVoucherStatus("error");
        setVoucherError(data.message || "Invalid voucher code");
      }
    } catch {
      setVoucherStatus("error");
      setVoucherError("Failed to validate voucher");
    }
  }

  function removeVoucher() {
    setAppliedVoucher(null);
    setVoucherStatus("idle");
    setVoucherInput("");
    setVoucherError("");
  }

  /** Wrapper that passes the active voucher code to checkout */
  function handleSubscribe(planKey: string) {
    subscribe({ plan: planKey, voucherCode: appliedVoucher?.code });
  }

  /** Is the applied voucher valid for this plan? */
  function voucherAppliesToPlan(_planKey: string) {
    return !!appliedVoucher;
  }

  // Build features list from i18n keys dynamically
  function getPlanFeatures(key: string): string[] {
    const keys = ["f1","f2","f3","f4","f5","f6","f7"];
    const result: string[] = [];
    for (const k of keys) {
      const val = t(`pricing.plans.${key}.${k}` as any, { defaultValue: "" });
      if (val) result.push(val);
    }
    return result;
  }

  const plans = [
    {
      key: "free",
      label: t("pricing.freePlan"),
      price: "$0",
      numericPrice: 0,
      per: t("pricing.perMonth"),
      color: "text-slate-700",
      borderClass: "border-slate-200",
      badgeClass: "bg-slate-50 text-slate-600 border-slate-200",
      description: t("pricing.plans.free.description"),
      tagline: t("pricing.plans.free.tagline"),
      popular: false,
      isFree: true,
      features: getPlanFeatures("free"),
      ctaGuest: t("pricing.plans.free.ctaGuest"),
      ctaFree: t("pricing.currentPlanBtn"),
      ctaUpgrade: t("pricing.plans.free.ctaUpgrade"),
    },
    {
      key: "starter",
      label: getPlanLabel("starter"),
      price: `$${prices.starter?.usd ?? planConfig.starter?.usd ?? 15}`,
      numericPrice: prices.starter?.usd ?? planConfig.starter?.usd ?? 15,
      per: t("pricing.perMonth"),
      color: "text-emerald-600",
      borderClass: "border-slate-200",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      description: t("pricing.plans.starter.description"),
      tagline: t("pricing.plans.starter.tagline"),
      popular: false,
      isFree: false,
      features: getPlanFeatures("starter"),
      ctaGuest: t("pricing.plans.starter.ctaGuest"),
      ctaUpgrade: t("pricing.plans.starter.ctaUpgrade"),
      ctaSwitch: "⬇️ Switch to Starter",
    },
    {
      key: "creator",
      label: getPlanLabel("creator"),
      price: `$${prices.creator?.usd ?? planConfig.creator?.usd ?? 29}`,
      numericPrice: prices.creator?.usd ?? planConfig.creator?.usd ?? 29,
      per: t("pricing.perMonth"),
      color: "text-blue-600",
      borderClass: "border-2 border-primary shadow-lg",
      badgeClass: "bg-primary/10 text-primary border-0",
      description: t("pricing.plans.creator.description"),
      tagline: t("pricing.plans.creator.tagline"),
      popular: true,
      isFree: false,
      features: getPlanFeatures("creator"),
      ctaGuest: t("pricing.plans.creator.ctaGuest"),
      ctaUpgrade: t("pricing.plans.creator.ctaUpgrade"),
      ctaSwitch: "⬇️ Switch to Creator",
    },
    {
      key: "pro",
      label: getPlanLabel("pro"),
      price: `$${prices.pro?.usd ?? planConfig.pro?.usd ?? 69}`,
      numericPrice: prices.pro?.usd ?? planConfig.pro?.usd ?? 69,
      per: t("pricing.perMonth"),
      color: "text-violet-600",
      borderClass: "border-violet-200",
      badgeClass: "bg-violet-50 text-violet-700 border-violet-200",
      description: t("pricing.plans.pro.description"),
      tagline: t("pricing.plans.pro.tagline"),
      popular: false,
      isFree: false,
      features: getPlanFeatures("pro"),
      ctaGuest: t("pricing.plans.pro.ctaGuest"),
      ctaUpgrade: t("pricing.plans.pro.ctaUpgrade"),
      ctaSwitch: "⬇️ Switch to Autopilot",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-5xl w-full space-y-8">

        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold text-slate-900">{t("pricing.header")}</h1>
          <p className="text-slate-500 text-lg">{t("pricing.subheader")}</p>
        </div>

        {/* Voucher code input — only shown when logged in */}
        {isLoggedIn && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 text-slate-600 shrink-0">
                <Tag className="w-4 h-4" />
                <span className="text-sm font-medium">Discount code</span>
              </div>
              {voucherStatus !== "success" ? (
                <div className="flex gap-2 flex-1">
                  <Input
                    placeholder="e.g. TWEETLY50"
                    value={voucherInput}
                    onChange={(e) => {
                      setVoucherInput(e.target.value.toUpperCase());
                      if (voucherStatus === "error") setVoucherStatus("idle");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && applyVoucher()}
                    className="max-w-[200px] uppercase tracking-widest"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={applyVoucher}
                    disabled={voucherStatus === "loading" || !voucherInput.trim()}
                  >
                    {voucherStatus === "loading" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : "Apply"}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-mono">{appliedVoucher?.code}</span>
                  &mdash; {appliedVoucher?.discountPercent}% off
                  <button
                    onClick={removeVoucher}
                    className="ml-2 text-muted-foreground hover:text-destructive"
                    title="Remove voucher"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {voucherStatus === "error" && (
                <p className="text-destructive text-xs">{voucherError}</p>
              )}
            </div>
          </div>
        )}

        {/* Expired banner */}
        {subscription && !subscription.isActive && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3">
            <Zap className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <p className="text-rose-800 text-sm">
              {t("pricing.expiredBannerFull")}
            </p>
          </div>
        )}

        {/* Plans */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {plans.map((plan) => (
            <Card key={plan.key} className={`rounded-2xl relative flex flex-col ${plan.borderClass}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-4 py-1 whitespace-nowrap">
                    <Sparkles className="w-3 h-3 mr-1" />
                    {t("pricing.mostPopular")}
                  </Badge>
                </div>
              )}
              {/* Voucher discount badge */}
              {!plan.isFree && voucherAppliesToPlan(plan.key) && appliedVoucher && (
                <div className="absolute -top-3 right-3">
                  <Badge className="bg-emerald-500 text-white px-2 py-0.5 text-xs">
                    -{appliedVoucher.discountPercent}%
                  </Badge>
                </div>
              )}
              <CardHeader className="p-6 pb-4">
                <div className="space-y-2">
                  <Badge variant="outline" className={`w-fit ${plan.badgeClass}`}>
                    {plan.label}
                  </Badge>
                  <div className="flex items-baseline gap-1 flex-wrap">
                    {!plan.isFree && voucherAppliesToPlan(plan.key) && appliedVoucher && plan.numericPrice ? (
                      <>
                        <span className={`text-2xl font-bold line-through text-slate-400`}>{plan.price}</span>
                        <h2 className={`text-4xl font-bold ${plan.color}`}>
                          ${Math.round(plan.numericPrice * (1 - appliedVoucher.discountPercent / 100))}
                        </h2>
                      </>
                    ) : (
                      <h2 className={`text-4xl font-bold ${plan.color}`}>{plan.price}</h2>
                    )}
                    <span className="text-slate-500 text-sm">{plan.per}</span>
                    {!plan.isFree && (
                      <button
                        onClick={() => setSarVisible(sarVisible === plan.key ? null : plan.key)}
                        className="text-[10px] text-slate-400 border border-slate-300 dark:border-slate-700 rounded px-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors leading-5"
                        title="عرض السعر بالريال"
                      >
                        ﷼
                      </button>
                    )}
                  </div>
                  {sarVisible === plan.key && !plan.isFree && (() => {
                    const sarBase = prices[plan.key]?.sar ?? 0;
                    const sarFinal = appliedVoucher && voucherAppliesToPlan(plan.key)
                      ? Math.round(sarBase * (1 - appliedVoucher.discountPercent / 100))
                      : sarBase;
                    return (
                      <p className="text-xs text-emerald-600 font-medium -mt-1">
                        = {sarFinal} ر.س / شهر
                      </p>
                    );
                  })()}
                  <p className="text-slate-500 text-sm">{plan.description}</p>
                </div>
              </CardHeader>

              {/* Features grow to fill space so all CTAs sit at the same height */}
              <CardContent className="p-6 pt-0 flex flex-col flex-1 gap-4">
                <ul className="space-y-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <p className="text-xs text-slate-400 border-t pt-3">{plan.tagline}</p>

                {/* CTA — unauthenticated */}
                {!isLoggedIn ? (
                  <Link href="/login">
                    <Button
                      className="w-full"
                      variant={plan.popular ? "default" : "outline"}
                    >
                      {plan.isFree ? plan.ctaGuest : plan.ctaGuest}
                    </Button>
                  </Link>

                /* CTA — free plan card, logged in */
                ) : plan.isFree ? (
                  subscription?.isPaid ? null : (
                    <Button className="w-full" variant="outline" disabled>
                      {t("pricing.currentPlanBtn")}
                    </Button>
                  )

                /* CTA — paid plan card, this is the user's current plan → allow renew */
                ) : subscription?.isPaid && subscription?.plan === plan.key ? (
                  <div className="space-y-2">
                    <Button className="w-full" variant="outline" disabled>
                      {t("pricing.currentPlanBtn")}
                    </Button>
                    <Button
                      className="w-full"
                      variant="default"
                      onClick={() => handleSubscribe(plan.key)}
                      disabled={isSubscribing}
                    >
                      {isSubscribing ? t("pricing.upgrading") : t("pricing.renewBtn")}
                    </Button>
                  </div>

                /* CTA — paid plan card, different plan → upgrade or switch/downgrade */
                ) : subscription?.isPaid ? (
                  planRank[plan.key] < userPlanRank ? (
                    /* downgrade */
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => handleSubscribe(plan.key)}
                      disabled={isSubscribing}
                    >
                      {isSubscribing ? t("pricing.upgrading") : (plan as any).ctaSwitch}
                    </Button>
                  ) : (
                    /* upgrade */
                    <Button
                      className="w-full"
                      variant={plan.popular ? "default" : "outline"}
                      onClick={() => handleSubscribe(plan.key)}
                      disabled={isSubscribing}
                    >
                      {isSubscribing ? t("pricing.upgrading") : plan.ctaUpgrade}
                    </Button>
                  )

                /* CTA — paid plan card, user on free plan → upgrade */
                ) : (
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => handleSubscribe(plan.key)}
                    disabled={isSubscribing}
                  >
                    {isSubscribing ? t("pricing.upgrading") : plan.ctaUpgrade}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-xs text-slate-400 text-center">🔒 Secure payment via Paylink</p>

        {/* Back link */}
        <div className="text-center">
          <a href="/" className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2">
            ← Back to app
          </a>
        </div>
      </div>
    </div>
  );
}
