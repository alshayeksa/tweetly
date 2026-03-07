import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { AdminHeader } from "./_shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Globe, MapPin, Map, Monitor, Wifi, Chrome, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface StatRow {
  name: string;
  count: number;
}

interface VisitorStats {
  total: number;
  countries: StatRow[];
  cities: StatRow[];
  regions: StatRow[];
  browsers: StatRow[];
  os: StatRow[];
  isps: StatRow[];
}

const badgeColors = [
  "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
];

function StatCard({
  title,
  icon,
  rows,
  badgeClass,
  loading,
}: {
  title: string;
  icon: React.ReactNode;
  rows: StatRow[];
  badgeClass: string;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-5">
        <CardTitle className="text-sm font-semibold flex items-center justify-end gap-2">
          {title}
          <span className="text-muted-foreground">{icon}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4 space-y-2">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            ))
          : rows.map((row, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground truncate text-right flex-1">{row.name || "Unknown"}</span>
                <span
                  className={`shrink-0 min-w-[44px] text-center text-xs font-semibold px-2 py-0.5 rounded-full ${badgeClass}`}
                >
                  {row.count.toLocaleString()}
                </span>
              </div>
            ))}
      </CardContent>
    </Card>
  );
}

export default function AdminVisitorsPage() {
  const { session, isLoading: authLoading } = useAdminAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [stats, setStats] = useState<VisitorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/visitors/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setStats(data);
    } catch {
      toast({ title: "Failed to load visitor stats", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading && (!session || !session.isAdmin)) {
      setLocation("/admin/login");
    }
  }, [authLoading, session]);

  useEffect(() => {
    if (!session?.isAdmin) return;
    loadStats();
  }, [session]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session?.isAdmin) return null;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AdminHeader title="Visitor Stats" />

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Page title + total + refresh */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadStats(true)}
              disabled={refreshing}
              className="gap-2"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              تحديث البيانات
            </Button>
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
              <span className="text-xs text-muted-foreground">إجمالي الزيارات</span>
              {loading ? (
                <Skeleton className="h-5 w-16" />
              ) : (
                <span className="text-base font-bold tabular-nums">
                  {stats?.total.toLocaleString() ?? 0}
                </span>
              )}
            </div>
          </div>
          <h1 className="text-xl font-bold">إحصائيات زيارات الموقع</h1>
        </div>

        {/* Row 1: Countries / Cities / Regions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="الدول"
            icon={<Globe className="h-4 w-4" />}
            rows={stats?.countries ?? []}
            badgeClass={badgeColors[1]}
            loading={loading}
          />
          <StatCard
            title="المدن"
            icon={<MapPin className="h-4 w-4" />}
            rows={stats?.cities ?? []}
            badgeClass={badgeColors[2]}
            loading={loading}
          />
          <StatCard
            title="المناطق"
            icon={<Map className="h-4 w-4" />}
            rows={stats?.regions ?? []}
            badgeClass={badgeColors[0]}
            loading={loading}
          />
        </div>

        {/* Row 2: Browsers / OS / ISPs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="مزودو الخدمة"
            icon={<Wifi className="h-4 w-4" />}
            rows={stats?.isps ?? []}
            badgeClass={badgeColors[4]}
            loading={loading}
          />
          <StatCard
            title="أنظمة التشغيل"
            icon={<Monitor className="h-4 w-4" />}
            rows={stats?.os ?? []}
            badgeClass={badgeColors[5]}
            loading={loading}
          />
          <StatCard
            title="المتصفحات"
            icon={<Chrome className="h-4 w-4" />}
            rows={stats?.browsers ?? []}
            badgeClass={badgeColors[3]}
            loading={loading}
          />
        </div>
      </main>
    </div>
  );
}
