import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { AdminHeader } from "./_shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, ChevronLeft, ChevronRight, LogIn } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface LoginHistoryRow {
  id: number;
  userId: string | null;
  email: string | null;
  method: string;
  status: string;
  ip: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  region: string | null;
  isp: string | null;
  createdAt: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface ApiResponse {
  rows: LoginHistoryRow[];
  total: number;
  limit: number;
  offset: number;
}

const PAGE_SIZE = 50;

function methodBadge(method: string) {
  if (method === "google")
    return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-0 text-xs">Google</Badge>;
  if (method === "x")
    return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-0 text-xs">X</Badge>;
  return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-0 text-xs">Email</Badge>;
}

function statusBadge(status: string) {
  if (status === "success")
    return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-0 text-xs">✓ نجح</Badge>;
  return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-0 text-xs">✗ فشل</Badge>;
}

function fmt(date: string) {
  return new Date(date).toLocaleString("ar-SA", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminLoginHistoryPage() {
  const { session, isLoading: authLoading } = useAdminAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const fetchData = useCallback(
    async (pageIndex: number) => {
      setLoading(true);
      try {
        const offset = pageIndex * PAGE_SIZE;
        const r = await fetch(
          `/api/admin/login-history?limit=${PAGE_SIZE}&offset=${offset}`,
          { credentials: "include" }
        );
        if (!r.ok) throw new Error("HTTP " + r.status);
        const json: ApiResponse = await r.json();
        setData(json);
        setPage(pageIndex);
      } catch {
        toast({ title: "فشل تحميل سجل الدخول", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    if (!authLoading && !session?.isAdmin) {
      setLocation("/admin/login");
      return;
    }
    if (!authLoading && session?.isAdmin) {
      fetchData(0);
    }
  }, [authLoading, session, fetchData, setLocation]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <AdminHeader title="سجل تسجيل الدخول" />

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Summary bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LogIn className="h-4 w-4" />
            <span>إجمالي المحاولات: <strong className="text-foreground">{data?.total?.toLocaleString() ?? "—"}</strong></span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(page)}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="mr-1">تحديث</span>
          </Button>
        </div>

        {/* Table card */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 pt-4 px-5 border-b">
            <CardTitle className="text-sm font-semibold">محاولات تسجيل الدخول</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">المستخدم</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">الطريقة</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">الحالة</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">الجهاز</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">الموقع</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">IP</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 10 }).map((_, i) => (
                        <tr key={i} className="border-b">
                          {Array.from({ length: 7 }).map((__, j) => (
                            <td key={j} className="py-3 px-4">
                              <Skeleton className="h-4 w-full" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : data?.rows.map((row) => (
                        <tr key={row.id} className="border-b hover:bg-muted/20 transition-colors">
                          {/* User */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2 flex-row-reverse">
                              {row.profileImageUrl ? (
                                <img
                                  src={row.profileImageUrl}
                                  alt=""
                                  className="h-7 w-7 rounded-full object-cover shrink-0"
                                />
                              ) : (
                                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                                  {(row.firstName?.[0] ?? row.email?.[0] ?? "?").toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                {(row.firstName || row.lastName) && (
                                  <div className="font-medium truncate max-w-[140px]">
                                    {[row.firstName, row.lastName].filter(Boolean).join(" ")}
                                  </div>
                                )}
                                <div className="text-xs text-muted-foreground truncate max-w-[140px]">
                                  {row.email ?? "—"}
                                </div>
                              </div>
                            </div>
                          </td>
                          {/* Method */}
                          <td className="py-3 px-4">{methodBadge(row.method)}</td>
                          {/* Status */}
                          <td className="py-3 px-4">{statusBadge(row.status)}</td>
                          {/* Device */}
                          <td className="py-3 px-4">
                            <div className="text-xs space-y-0.5">
                              <div>{row.browser ?? "—"}</div>
                              <div className="text-muted-foreground">{row.os ?? ""} {row.device ? `· ${row.device}` : ""}</div>
                            </div>
                          </td>
                          {/* Location */}
                          <td className="py-3 px-4">
                            <div className="text-xs space-y-0.5">
                              <div>{row.city && row.country ? `${row.city}، ${row.country}` : (row.country ?? "—")}</div>
                              {row.isp && <div className="text-muted-foreground truncate max-w-[120px]">{row.isp}</div>}
                            </div>
                          </td>
                          {/* IP */}
                          <td className="py-3 px-4">
                            <span className="font-mono text-xs">{row.ip ?? "—"}</span>
                          </td>
                          {/* Date */}
                          <td className="py-3 px-4">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{fmt(row.createdAt)}</span>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(page - 1)}
              disabled={page === 0 || loading}
            >
              <ChevronRight className="h-4 w-4" />
              السابق
            </Button>
            <span className="text-sm text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(page + 1)}
              disabled={page >= totalPages - 1 || loading}
            >
              التالي
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
