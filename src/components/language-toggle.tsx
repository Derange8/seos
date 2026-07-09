"use client";

import { useLanguage } from "@/hooks/use-language";
import { cn } from "@/lib/utils";

// One global language switch, shown once in the sidebar rather than
// repeated per-page (Guide and the project dashboard each used to render
// their own copy of this). useLanguage is already a shared, localStorage-
// backed store, so every page re-renders in sync the moment this changes.
export function LanguageToggle() {
  const [language, setLanguage] = useLanguage();

  return (
    <div className="inset-panel flex gap-1 rounded-full p-1">
      <button
        onClick={() => setLanguage("en")}
        className={cn(
          "flex-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
          language === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        EN
      </button>
      <button
        onClick={() => setLanguage("tr")}
        className={cn(
          "flex-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
          language === "tr" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        TR
      </button>
    </div>
  );
}
