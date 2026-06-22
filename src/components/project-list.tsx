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

  return (
    <div className="flex w-full flex-col gap-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {projects.map((project) => (
        <Card key={project.id}>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <Link href={`/projects/${project.id}`} className="flex-1 hover:opacity-80">
              <p className="font-medium">{project.name}</p>
              <p className="text-sm text-muted-foreground">
                {project.domain} · {project.isVerified ? "verified" : "not verified"}
              </p>
            </Link>
            <Button
              variant="outline"
              size="sm"
              disabled={pendingId === project.id}
              onClick={() => handleDisconnect(project)}
            >
              {pendingId === project.id ? "Disconnecting…" : "Disconnect"}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
