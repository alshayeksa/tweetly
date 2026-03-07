import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { AdminHeader } from "./_shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Twitter, CreditCard, UserCheck, BarChart2, Tag, LayoutTemplate, LogIn } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface Stats {
  totalUsers: number;
  totalTweets: number;
  planBreakdown: { plan: string; count: number }[];
  statusBreakdown: { status: string; count: number }[];
}

export default function AdminDashboard() {
  const { session, isLoading: authLoading } = useAdminAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!authLoading && (!session || !session.isAdmin)) {
      setLocation("/admin/login");
    }
  }, [authLoading, session]);

  useEffect(() => {
    if (!session?.isAdmin) return;
    fetch("/api/admin/stats", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => toast({ title: "Failed to load stats", variant: "destructive" }))
      .finally(() => setLoadingData(false));
  }, [session]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session?.isAdmin) return null;

  const freePlanCount = stats?.planBreakdown.find((p) => p.plan === "free")?.count ?? 0;
  const activeSubs = stats?.statusBreakdown.find((s) => s.status === "active")?.count ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title="Admin Dashboard" />

      <main className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {loadingData ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" /> Total Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{stats?.totalUsers ?? 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Twitter className="h-4 w-4" /> Total Tweets
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{stats?.totalTweets ?? 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <CreditCard className="h-4 w-4" /> Active Subs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{activeSubs}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <UserCheck className="h-4 w-4" /> Free Plan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{freePlanCount}</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Navigation cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card
            className="cursor-pointer hover:bg-muted/40 transition-colors"
            onClick={() => setLocation("/admin/users")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5" />
                Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View, search, edit and delete all users. Manage plans, limits and admin access.
              </p>
              <Button className="mt-4" size="sm" onClick={() => setLocation("/admin/users")}>
                Open Users →
              </Button>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:bg-muted/40 transition-colors"
            onClick={() => setLocation("/admin/visitors")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart2 className="h-5 w-5" />
                Visitor Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View website traffic stats: countries, cities, browsers, OS and ISPs.
              </p>
              <Button className="mt-4" size="sm" onClick={() => setLocation("/admin/visitors")}>
                Open Visitors →
              </Button>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:bg-muted/40 transition-colors"
            onClick={() => setLocation("/admin/vouchers")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Tag className="h-5 w-5" />
                Voucher Codes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Create and manage discount codes. Set percentage, expiry, usage limits and plan restrictions.
              </p>
              <Button className="mt-4" size="sm" onClick={() => setLocation("/admin/vouchers")}>
                Open Vouchers →
              </Button>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:bg-muted/40 transition-colors"
            onClick={() => setLocation("/admin/login-history")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <LogIn className="h-5 w-5" />
                Login History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View all login attempts (email, Google, X) with IP, location, and device details.
              </p>
              <Button className="mt-4" size="sm" onClick={() => setLocation("/admin/login-history")}>
                Open Login History →
              </Button>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:bg-muted/40 transition-colors"
            onClick={() => setLocation("/admin/prompt-templates")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <LayoutTemplate className="h-5 w-5" />
                Prompt Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Manage ready-made prompt templates shown to users in the generator. Add categories and templates.
              </p>
              <Button className="mt-4" size="sm" onClick={() => setLocation("/admin/prompt-templates")}>
                Open Templates →
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
