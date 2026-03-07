import { useTranslation } from "react-i18next";
import { setLanguage } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === "ar";

  const toggle = () => {
    setLanguage(isArabic ? "en" : "ar");
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className="flex items-center gap-1.5 text-sm font-medium px-2"
      title={isArabic ? "Switch to English" : "التبديل للعربية"}
    >
      <Globe className="w-4 h-4" />
      {isArabic ? "EN" : "ع"}
    </Button>
  );
}
