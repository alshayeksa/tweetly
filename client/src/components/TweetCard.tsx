import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { XCircle, Send, Pencil, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Suggestion } from "@shared/schema";
import { useTranslation } from "react-i18next";

interface TweetCardProps {
  suggestion: Suggestion;
  editingId: number | null;
  editText: string;
  setEditingId: (id: number | null) => void;
  setEditText: (text: string) => void;
  saveEdit: (id: number) => void;
  startEdit: (suggestion: Suggestion) => void;
  updateMutation: any;
  publishMutation: any;
  isHistory?: boolean;
}

function isArabic(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

export function TweetCard({
  suggestion, editingId, editText, setEditingId, setEditText,
  saveEdit, startEdit, updateMutation, publishMutation, isHistory = false,
}: TweetCardProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();
  const content = suggestion.editedContent || suggestion.content;
  const isRtl = isArabic(content);
  const charCount = content.length;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast({ title: t("tweetCard.copied") });
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusChip = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      published: { label: t("tweetCard.status.published"), className: "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50" },
      approved:  { label: t("tweetCard.status.approved"),  className: "bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-50" },
      rejected:  { label: t("tweetCard.status.rejected"),  className: "bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-50" },
    };
    const s = statusMap[status];
    if (s) return <Badge className={`${s.className} pointer-events-none`}>{s.label}</Badge>;
    return <Badge variant="outline" className="text-slate-500 pointer-events-none">{t("tweetCard.status.pending")}</Badge>;
  };

  return (
    <Card
      className={`rounded-2xl border-slate-200 bg-white shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden ${isRtl ? "font-arabic" : ""}`}
      dir={isRtl ? "rtl" : "ltr"}
      data-testid={`card-suggestion-${suggestion.id}`}
    >
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 border-b border-slate-50 pb-3">
          <div className="flex items-center gap-3">
            {getStatusChip(suggestion.status)}
            <span className="text-slate-500 text-xs font-medium" data-testid="text-char-count">
              {charCount}/280
            </span>
          </div>
          <span className="text-slate-400 text-[10px] font-mono">ID: {suggestion.id}</span>
        </div>

        {editingId === suggestion.id ? (
          <div className="space-y-4">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className={`min-h-[140px] text-[15px] leading-7 bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-slate-400 ${isRtl ? "text-right" : "text-left"}`}
              dir={isRtl ? "rtl" : "ltr"}
              data-testid="textarea-edit-suggestion"
            />
            <div className={`flex items-center gap-2 ${isRtl ? "justify-start" : "justify-end"}`}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingId(null)}
                className="rounded-lg border-slate-200 text-slate-600 h-8"
              >
                {t("tweetCard.cancel")}
              </Button>
              <Button
                size="sm"
                onClick={() => saveEdit(suggestion.id)}
                disabled={updateMutation.isPending}
                className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white h-8"
              >
                {t("tweetCard.saveChanges")}
              </Button>
            </div>
          </div>
        ) : (
          <p
            className={`text-[15px] leading-7 whitespace-pre-wrap text-slate-800 font-normal ${isRtl ? "text-right" : "text-left"}`}
            data-testid={`text-suggestion-content-${suggestion.id}`}
          >
            {content}
          </p>
        )}

        <div className={`flex items-center gap-2 pt-2 flex-wrap ${isRtl ? "justify-start" : "justify-end"}`}>
          {!isHistory && (
            <>
              {(suggestion.status === "pending" || suggestion.status === "approved") && (
                <>
                  <Button
                    size="sm"
                    className="h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-white gap-1.5"
                    onClick={() => publishMutation.mutate(suggestion.id)}
                    disabled={publishMutation.isPending}
                    data-testid={`button-publish-${suggestion.id}`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    {publishMutation.isPending ? t("tweetCard.publishing") : t("tweetCard.publish")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-lg border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-600 gap-1.5"
                    onClick={() => updateMutation.mutate({ id: suggestion.id, status: "rejected" })}
                    disabled={updateMutation.isPending}
                    data-testid={`button-reject-${suggestion.id}`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    {t("tweetCard.reject")}
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-lg border-slate-200 hover:bg-slate-50 text-slate-600 gap-1.5"
                onClick={() => startEdit(suggestion)}
                data-testid={`button-edit-${suggestion.id}`}
              >
                <Pencil className="w-3.5 h-3.5" />
                {t("tweetCard.edit")}
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-lg border-slate-200 hover:bg-slate-50 text-slate-600 gap-1.5"
            onClick={handleCopy}
            data-testid={`button-copy-${suggestion.id}`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? t("tweetCard.copied") : t("tweetCard.copy")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
