import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaSitemapRepository } from "@/infrastructure/persistence/prisma/prisma-sitemap-repository";
import { toSitemapFileDto } from "@/application/sitemap/dto";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireProjectAccess(id);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const sitemapFile = await new PrismaSitemapRepository(prisma).findLatestByProjectId(id);
  if (!sitemapFile) {
    return NextResponse.json({ error: "No sitemap generated for this project yet" }, { status: 404 });
  }

  return NextResponse.json(toSitemapFileDto(sitemapFile));
}
