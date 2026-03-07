import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquarePlus,
  FileText,
  CheckCircle2,
  Send,
  XCircle,
  Activity,
  Trash2,
  Link2,
  Unlink,
} from "lucide-react";
import type { ActivityLog } from "@shared/schema";

function actionIcon(action: string) {
  switch (action) {
    case "created": return <MessageSquarePlus className="w-4 h-4 text-chart-1" />;
    case "generated": return <FileText className="w-4 h-4 text-chart-2" />;
    case "approved": return <CheckCircle2 className="w-4 h-4 text-chart-3" />;
    case "published": return <Send className="w-4 h-4 text-chart-4" />;
    case "rejected": return <XCircle className="w-4 h-4 text-destructive" />;
    case "deleted": return <Trash2 className="w-4 h-4 text-muted-foreground" />;
    case "connected": return <Link2 className="w-4 h-4 text-chart-3" />;
    case "disconnected": return <Unlink className="w-4 h-4 text-muted-foreground" />;
    default: return <Activity className="w-4 h-4 text-muted-foreground" />;
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function HistoryPage() {
  const { data: logs, isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity"],
  });
  const { t } = useTranslation();

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold" data-testid="text-history-title">{t("history.title")}</h1>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : logs?.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2" data-testid="text-no-history">{t("history.noHistory")}</h3>
            <p className="text-muted-foreground">{t("history.noHistoryDesc")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("history.allActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {logs?.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0"
                  data-testid={`activity-log-${log.id}`}
                >
                  <div className="mt-0.5">{actionIcon(log.action)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{log.details || `${log.action} ${log.entityType}`}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">{formatDate(log.createdAt as any)}</span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {log.entityType}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
