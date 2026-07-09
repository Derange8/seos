"use client";

import Link from "next/link";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/hooks/use-language";
import { TRANSLATIONS, type TranslationKey } from "@/components/project-dashboard/shared";

export function Sidebar({ active }: { active?: "sites" | "settings" | "guide" }) {
  const [language] = useLanguage();
  const t = (key: TranslationKey) => TRANSLATIONS[key][language];

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-r border-white/8 px-5 py-7 md:flex">
      <div className="flex flex-col gap-10">
        <Link href="/" className="flex items-center gap-3 px-1">
          <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-primary to-[oklch(0.7_0.16_240)] text-base font-bold text-primary-foreground shadow-[0_4px_16px_-4px_oklch(0.7_0.19_290_/_55%)]">
            S
          </span>
          <span className="text-lg font-semibold tracking-tight">Seos</span>
        </Link>

        <nav className="flex flex-col gap-1">
          <NavItem href="/" label={t("sitesNavLabel")} isActive={active === "sites"} icon={GridIcon} />
          <NavItem href="/settings" label={t("settingsNavLabel")} isActive={active === "settings"} icon={GearIcon} />
          <NavItem href="/guide" label={t("guideNavLabel")} isActive={active === "guide"} icon={BookIcon} />
        </nav>
      </div>

      <div className="flex flex-col gap-4">
        <LanguageToggle />
        <p className="px-1 text-xs leading-relaxed text-muted-foreground/60">{t("taglineLabel")}</p>
      </div>
    </aside>
  );
}

function NavItem({
  href,
  label,
  isActive,
  icon: Icon,
}: {
  href: string;
  label: string;
  isActive?: boolean;
  icon: (props: { className?: string }) => React.ReactElement;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.925rem] transition-colors ${
        isActive
          ? "bg-white/10 font-medium text-foreground"
          : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
      }`}
    >
      <Icon
        className={`size-[1.1rem] shrink-0 transition-colors ${
          isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground"
        }`}
      />
      {label}
    </Link>
  );
}

// One consistent icon family (1.5 stroke, currentColor) — no decorative icons.
function GridIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}
