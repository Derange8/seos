import Link from "next/link";

// The product-wide frame: a fixed left rail (brand + primary navigation) and a
// wide content area. Replaces the old centered max-w-xl column that made every
// screen read like a form rather than a control surface. Design tokens
// unchanged — this is layout + hierarchy only.
export function AppShell({
  children,
  active,
}: {
  children: React.ReactNode;
  // Which primary nav item is current, for the active highlight.
  active?: "sites" | "settings" | "guide";
}) {
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar active={active} />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto w-full max-w-6xl px-8 py-10">{children}</div>
      </main>
    </div>
  );
}

function Sidebar({ active }: { active?: "sites" | "settings" | "guide" }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between border-r border-white/8 px-4 py-6 md:flex">
      <div className="flex flex-col gap-8">
        <Link href="/" className="flex items-center gap-2.5 px-2">
          <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.7_0.16_240)] text-sm font-bold text-primary-foreground">
            S
          </span>
          <span className="text-base font-semibold tracking-tight">Seos</span>
        </Link>

        <nav className="flex flex-col gap-0.5">
          <NavItem href="/" label="Sites" isActive={active === "sites"} icon={GridIcon} />
          <NavItem href="/settings" label="Settings" isActive={active === "settings"} icon={GearIcon} />
          <NavItem href="/guide" label="Guide" isActive={active === "guide"} icon={BookIcon} />
        </nav>
      </div>

      <p className="px-2 text-xs leading-relaxed text-muted-foreground/70">
        AI Growth Engineer — the answer AI assistants recommend.
      </p>
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
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
        isActive ? "bg-white/8 font-medium text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
      }`}
    >
      <Icon className="size-4 shrink-0" />
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
