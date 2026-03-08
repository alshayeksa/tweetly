import { LayoutDashboard, PenLine, Rocket, ListTree, Activity, Settings, Sparkles, CalendarClock, Zap, AlertCircle } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { PaywallBanner } from "@/components/PaywallBanner";
import { TweetLimitBanner } from "@/components/TweetLimitBanner";
import { TrialLimitModal } from "@/components/TrialLimitModal";
import { useSubscription } from "@/hooks/use-subscription";
import { Badge } from "@/components/ui/badge";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useTranslation } from "react-i18next";

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { setOpenMobile, isMobile } = useSidebar();
  const { subscription } = useSubscription();
  const { t, i18n } = useTranslation();
  const [showLimitModal, setShowLimitModal] = useState(false);

  const navItems = [
    { title: t("nav.dashboard"), url: "/", icon: LayoutDashboard },
    { title: t("nav.manualTweets"), url: "/suggestions", icon: PenLine },
    { title: t("nav.scheduleTweets"), url: "/schedule", icon: CalendarClock },
    { title: t("nav.autoTweets"), url: "/auto-tweets", icon: Rocket },
    { title: t("nav.threads"), url: "/threads", icon: ListTree },
    { title: t("nav.history"), url: "/history", icon: Activity },
    { title: t("nav.settings"), url: "/settings", icon: Settings },
  ];

  const handleLinkClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">X</span>
            </div>
            <div>
              <h2 className="font-semibold text-sm" data-testid="text-app-title">Tweetly</h2>
              <p className="text-xs text-muted-foreground">AI Content Studio</p>
            </div>
          </div>
          <LanguageToggle />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{i18n.language === "ar" ? "القوائم" : "Navigation"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link
                        href={item.url}
                        onClick={handleLinkClick}
                        data-testid={`link-nav-${item.url.replace("/", "") || "dashboard"}`}
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/pricing"}>
                  <Link href="/pricing" onClick={handleLinkClick}>
                    <Sparkles className="w-4 h-4" />
                    <span>{t("nav.upgradePro")}</span>
                    {subscription?.isTrial && (
                      <Badge variant="outline" className="ml-auto text-[10px] py-0 h-4">
                        {t("nav.daysLeft", { days: subscription.daysLeft })}
                      </Badge>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <PaywallBanner />
      <TweetLimitBanner />

      {/* ── Compact plan card ── */}
      {subscription && (() => {
        const isAr = i18n.language === "ar";
        const planLabel: Record<string, string> = {
          free: isAr ? "مجاني" : "Free",
          starter: "Starter",
          creator: "Creator",
          autopilot: "Autopilot",
        };
        const label = planLabel[subscription.plan] ?? subscription.plan;
        const showUsage = subscription.monthlyLimit !== null;
        const pct = showUsage
          ? Math.min(100, Math.round((subscription.tweetsUsed / (subscription.monthlyLimit ?? 1)) * 100))
          : 100;
        const barColor = !showUsage ? "bg-emerald-500" : pct >= 100 ? "bg-rose-500" : "bg-emerald-500";
        return (
          <div className="mx-2 mb-2 rounded-xl border bg-muted/40 p-3 space-y-2" dir={isAr ? "rtl" : "ltr"}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold">{isAr ? "خطتك" : "Your Plan"}</span>
              </div>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 capitalize">{label}</Badge>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{isAr ? "التغريدات المتبقية" : "Tweets remaining"}</span>
                <span className={showUsage && pct >= 100 ? "text-rose-500 font-semibold" : ""}>
                  {showUsage
                    ? `${Math.max(0, (subscription.monthlyLimit ?? 0) - subscription.tweetsUsed)} / ${subscription.monthlyLimit}`
                    : (isAr ? "غير محدود" : "Unlimited")}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted-foreground/25 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
              {/* Limit reached — renew/upgrade button */}
              {showUsage && pct >= 100 && (
                <button
                  onClick={() => setShowLimitModal(true)}
                  className="mt-1 w-full flex items-center justify-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 transition-colors py-1 text-[11px] font-semibold text-rose-400"
                >
                  <AlertCircle className="w-3 h-3" />
                  {subscription.isPaid
                    ? (isAr ? "تجديد / ترقية" : "Renew / Upgrade")
                    : (isAr ? "ترقية الآن" : "Upgrade Now")}
                </button>
              )}
            </div>
            {subscription.daysLeft !== null && subscription.daysLeft <= 3 && (
              <p className="text-[10px] text-amber-600 font-medium">
                {isAr
                  ? subscription.daysLeft === 1
                    ? "باقي على إنتهاء الباقة يوم"
                    : subscription.daysLeft === 2
                    ? "باقي على إنتهاء الباقة يومين"
                    : `باقي على إنتهاء الباقة ${subscription.daysLeft} أيام`
                  : subscription.daysLeft === 1
                  ? "1 day until your plan expires"
                  : `${subscription.daysLeft} days until your plan expires`}
              </p>
            )}
            {subscription.isTrial && subscription.daysLeft !== null && subscription.daysLeft > 3 && (
              <p className="text-[10px] text-amber-600">
                {isAr ? `${subscription.daysLeft} يوم متبقي في الفترة التجريبية` : `${subscription.daysLeft} days left in trial`}
              </p>
            )}
            {!subscription.isPaid && (
              <Link href="/pricing">
                <Button size="sm" className="w-full h-6 text-[11px] mt-1">
                  {isAr ? "الترقية إلى Pro ✦" : "Upgrade to Pro ✦"}
                </Button>
              </Link>
            )}
          </div>
        );
      })()}

      <SidebarFooter className="p-3">
        {user && (
          <div className="flex items-center gap-2">
            <Avatar className="w-8 h-8">
              <AvatarImage src={user.profileImageUrl || undefined} />
              <AvatarFallback>
                {(user.firstName?.[0] || user.email?.[0] || "U").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" data-testid="text-user-name">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => logout()} data-testid="button-logout">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </SidebarFooter>

      <TrialLimitModal isOpen={showLimitModal} onClose={() => setShowLimitModal(false)} />
    </Sidebar>
  );
}
