import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

interface XStatus {
  connected: boolean;
  needsReconnect?: boolean;
  username: string | null;
}

interface XConnectionBannerProps {
  /** When true, shows messaging specific to automation being paused */
  autoPilot?: boolean;
}

export function XConnectionBanner({ autoPilot }: XConnectionBannerProps = {}) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const { data: xStatus, isLoading } = useQuery<XStatus>({
    queryKey: ["/api/x/status"],
    queryFn: async () => {
      const res = await fetch("/api/x/status", { credentials: "include" });
      if (!res.ok) return { connected: false, username: null };
      return res.json();
    },
    staleTime: 1000 * 60 * 2,
  });

  if (isLoading || xStatus?.connected) return null;

  const isReconnect = xStatus?.needsReconnect;

  const title = autoPilot
    ? (isAr ? "الأتمتة متوقفة — حساب X غير متصل" : "Automations Paused — X Account Disconnected")
    : isReconnect
      ? (isAr ? "يجب إعادة ربط حساب X" : "X Account Needs Reconnecting")
      : (isAr ? "قم بربط حساب X الخاص بك" : "Connect Your X Account");

  const description = autoPilot
    ? (isAr
        ? "توقفت جميع عمليات الأتمتة النشطة لأن حساب X الخاص بك انتهت صلاحيته أو تم فصله. أعد الربط من الإعدادات وستستأنف الأتمتة تلقائياً."
        : "All active automations have paused because your X account expired or was disconnected. Reconnect in Settings and they will resume automatically.")
    : isReconnect
      ? (isAr
          ? "رابط حساب X الخاص بك لا يملك صلاحية النشر. يرجى إعادة ربط حسابك من الإعدادات."
          : "Your X connection doesn't have posting permission. Please reconnect your account in Settings.")
      : (isAr
          ? "قم بربط حساب X الخاص بك لبدء النشر وتوليد المحتوى."
          : "Connect your X account to start publishing and generating content.");

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 mb-4">
      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800">{title}</p>
        <p className="text-sm text-amber-700 mt-0.5">{description}</p>
        <Link href="/settings">
          <Button size="sm" className="mt-2 bg-amber-600 hover:bg-amber-700 text-white">
            {isAr ? "الذهاب إلى الإعدادات" : "Go to Settings →"}
          </Button>
        </Link>
      </div>
    </div>
  );
}
