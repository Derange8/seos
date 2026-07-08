"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ProjectListItem {
  id: string;
  name: string;
  domain: string;
  isVerified: boolean;
}

export function ProjectList({ projects }: { projects: ProjectListItem[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDisconnect(project: ProjectListItem) {
    const confirmed = window.confirm(
      `Disconnect "${project.domain}"? This permanently deletes its crawl history, audit results, and any WordPress/Google connections. This can't be undone.`
    );
    if (!confirmed) return;

    setError(null);
    setPendingId(project.id);
    const response = await fetch(`/api/v1/projects/${project.id}`, { method: "DELETE" });
    setPendingId(null);

    if (!response.ok) {
      setError(`Failed to disconnect "${project.domain}"`);
      return;
    }
    router.refresh();
  }

  // Verified sites first — they carry real measurement history; unverified are
  // still in setup.
  const sorted = [...projects].sort((a, b) => Number(b.isVerified) - Number(a.isVerified));

  return (
    <div className="flex w-full flex-col gap-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((project) => (
          <Card
            key={project.id}
            className="group transition-all hover:-translate-y-0.5 hover:border-white/20"
          >
            <CardContent className="flex flex-col gap-3 py-4">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/projects/${project.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium">{project.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{project.domain}</p>
                </Link>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-medium ${
                    project.isVerified ? "bg-primary/15 text-primary" : "bg-white/8 text-muted-foreground"
                  }`}
                >
                  {project.isVerified ? "Verified" : "Setup"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/projects/${project.id}`}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Open dashboard →
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pendingId === project.id}
                  onClick={() => handleDisconnect(project)}
                >
                  {pendingId === project.id ? "Disconnecting…" : "Disconnect"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
