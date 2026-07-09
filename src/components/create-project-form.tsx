"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/hooks/use-language";
import { TRANSLATIONS, type TranslationKey } from "@/components/project-dashboard/shared";

export function CreateProjectForm() {
  const router = useRouter();
  const [language] = useLanguage();
  const t = (key: TranslationKey) => TRANSLATIONS[key][language];
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const response = await fetch("/api/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, domain }),
    });
    const data = await response.json();

    setIsSubmitting(false);
    if (!response.ok) {
      setError(data.error ?? t("failedToCreateProject"));
      return;
    }

    setName("");
    setDomain("");
    router.push(`/projects/${data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("projectName")}</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("projectNamePlaceholder")}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="domain">{t("domain")}</Label>
        <Input
          id="domain"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com"
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? t("creating") : t("createProject")}
      </Button>
    </form>
  );
}
