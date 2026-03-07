import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/lib/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import LandingPage from "@/pages/landing";
import DashboardPage from "@/pages/dashboard";
import SuggestionsPage from "@/pages/suggestions";
import AutoTweetsPage from "@/pages/auto-tweets";
import HistoryPage from "@/pages/history";
import SettingsPage from "@/pages/settings";
import ThreadsPage from "@/pages/threads";
import SchedulePage from "@/pages/schedule";
import PricingPage from "@/pages/pricing";
import TermsPage from "@/pages/terms";
import PrivacyPage from "@/pages/privacy";
import RefundPolicyPage from "@/pages/refund-policy";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import AboutPage from "@/pages/about";
import AdminLoginPage from "@/pages/admin/login";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsersPage from "@/pages/admin/users";
import AdminVisitorsPage from "@/pages/admin/visitors";
import AdminVouchersPage from "@/pages/admin/vouchers";
import AdminPromptTemplatesPage from "@/pages/admin/prompt-templates";
import AdminLoginHistoryPage from "@/pages/admin/login-history";

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/suggestions" component={SuggestionsPage} />
      <Route path="/threads" component={ThreadsPage} />
      <Route path="/schedule" component={SchedulePage} />
      <Route path="/auto-tweets" component={AutoTweetsPage} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedLayout() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-2 p-2 border-b sticky top-0 z-50 bg-background md:hidden">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <header className="hidden md:flex items-center justify-between gap-2 p-2 border-b sticky top-0 z-50 bg-background">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  // Admin routes — completely independent of user auth
  if (location === "/admin/login") return <AdminLoginPage />;
  if (location === "/admin/users") return <AdminUsersPage />;
  if (location === "/admin/visitors") return <AdminVisitorsPage />;
  if (location === "/admin/vouchers") return <AdminVouchersPage />;
  if (location === "/admin/prompt-templates") return <AdminPromptTemplatesPage />;
  if (location === "/admin/login-history") return <AdminLoginHistoryPage />;
  if (location.startsWith("/admin")) return <AdminDashboard />;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  // Public routes (no auth needed)
  if (location === "/forgot-password") return <ForgotPasswordPage />;
  if (location === "/reset-password") return <ResetPasswordPage />;
  if (location === "/login") return <LoginPage />;
  if (location === "/pricing") return <PricingPage />;
  if (location === "/terms") return <TermsPage />;
  if (location === "/privacy") return <PrivacyPage />;
  if (location === "/refund-policy") return <RefundPolicyPage />;
  if (location === "/about") return <AboutPage />;

  if (!user) {
    return <LandingPage />;
  }

  // X connection gate removed — pages render normally with inline banner

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
