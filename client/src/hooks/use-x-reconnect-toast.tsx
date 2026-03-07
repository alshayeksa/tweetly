import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

/**
 * Returns a helper that shows a destructive toast with a "Go to Settings" action
 * whenever the server returns code: "X_RECONNECT_REQUIRED".
 *
 * Usage:
 *   const showXReconnectToast = useXReconnectToast();
 *   // in onError:
 *   if (showXReconnectToast(error)) return;
 */
export function useXReconnectToast() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  return function handleIfReconnectRequired(error: any): boolean {
    if (error?.code !== "X_RECONNECT_REQUIRED" && error?.status !== 401) return false;
    // Some errors carry code directly; others are just 401 with no code —
    // only show the reconnect toast when we have the explicit code or a 401.
    if (error?.code !== "X_RECONNECT_REQUIRED") return false;

    toast({
      variant: "destructive",
      title: isAr ? "انتهت صلاحية حساب X" : "X Account Disconnected",
      description: isAr
        ? "انتهت صلاحية ربط حساب X أو تم فصله. يرجى إعادة الربط من الإعدادات."
        : "Your X account connection expired or was revoked. Please reconnect in Settings.",
      action: (
        <ToastAction
          altText={isAr ? "الإعدادات" : "Settings"}
          onClick={() => navigate("/settings")}
          className="shrink-0"
        >
          {isAr ? "الإعدادات" : "Go to Settings"}
        </ToastAction>
      ),
    });
    return true;
  };
}
