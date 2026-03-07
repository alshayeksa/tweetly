import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, CheckCircle2, Send, Clock, XCircle, Activity, Bot } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TrialExpiredModal } from "@/components/TrialExpiredModal";

interface DashboardData {
  stats: {
    totalSuggestions: number;
    approvedCount: number;
    publishedCount: number;
    pendingCount: number;
    rejectedCount: number;
    totalAutomations: number;
    activeAutomations: number;
  };
  recentActivity: Array<{
    id: number;
    action: string;
    entityType: string;
    details: string | null;
    createdAt: string;
  }>;
}

function StatCard({ title, value, icon: Icon, testId }: { title: string; value: number; icon: any; testId: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={testId}>{value}</div>
      </CardContent>
    </Card>
  );
}

function formatTime(dateStr: string, lang: string) {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return lang === "ar" ? "الآن" : "Just now";
  if (mins < 60) return lang === "ar" ? `منذ ${mins} دقيقة` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return lang === "ar" ? `منذ ${hrs} ساعة` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return lang === "ar" ? `منذ ${days} يوم` : `${days}d ago`;
}

function actionIcon(action: string) {
  switch (action) {
    case "created": return <Bot className="w-4 h-4 text-chart-1" />;
    case "generated": return <FileText className="w-4 h-4 text-chart-2" />;
    case "approved": return <CheckCircle2 className="w-4 h-4 text-chart-3" />;
    case "published": return <Send className="w-4 h-4 text-chart-4" />;
    case "rejected": return <XCircle className="w-4 h-4 text-destructive" />;
    default: return <Activity className="w-4 h-4 text-muted-foreground" />;
  }
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({ queryKey: ["/api/dashboard"] });
  const { t, i18n } = useTranslation();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-16" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const activity = data?.recentActivity || [];

  return (
    <>
      <TrialExpiredModal />
      <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold" data-testid="text-dashboard-title">{t("dashboard.title")}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title={t("dashboard.totalTweets")} value={stats?.totalSuggestions || 0} icon={FileText} testId="stat-total-suggestions" />
        <StatCard title={t("dashboard.pending")} value={stats?.pendingCount || 0} icon={Clock} testId="stat-pending" />
        <StatCard title={t("tweetCard.status.approved")} value={stats?.approvedCount || 0} icon={CheckCircle2} testId="stat-approved" />
        <StatCard title={t("dashboard.published")} value={stats?.publishedCount || 0} icon={Send} testId="stat-published" />
        <StatCard title={t("dashboard.rejected")} value={stats?.rejectedCount || 0} icon={XCircle} testId="stat-rejected" />
        <StatCard title={t("dashboard.activeAutomations")} value={stats?.activeAutomations || 0} icon={Bot} testId="stat-active-automations" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("dashboard.recentActivity")}</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-muted-foreground text-sm" data-testid="text-no-activity">
              {t("dashboard.noActivity")}
            </p>
          ) : (
            <div className="space-y-3">
              {activity.map((item) => (
                <div key={item.id} className="flex items-start gap-3" data-testid={`activity-item-${item.id}`}>
                  <div className="mt-0.5">{actionIcon(item.action)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{item.details || `${item.action} ${item.entityType}`}</p>
                    <p className="text-xs text-muted-foreground">{formatTime(item.createdAt, i18n.language)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </>
  );
}
