import { Sidebar } from "@/components/sidebar";

// The product-wide frame: a fixed left rail (brand + primary navigation) and a
// wide content area. Wider rail, larger nav targets, and a wider content max
// width than the original pass — this is the control surface for a desktop
// app, not a marketing page, so it earns the extra horizontal room.
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
        <div className="mx-auto w-full max-w-7xl px-10 py-12">{children}</div>
      </main>
    </div>
  );
}
