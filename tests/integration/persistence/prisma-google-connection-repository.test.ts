import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaGoogleConnectionRepository } from "@/infrastructure/persistence/prisma/prisma-google-connection-repository";
import { GoogleConnection } from "@/domain/tracking/entities/google-connection";

describe("PrismaGoogleConnectionRepository", () => {
  const repository = new PrismaGoogleConnectionRepository(prisma);
  let projectId: string;

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: { name: "Google Connection Test Project", domain: `itest-${crypto.randomUUID()}.example.com` },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("round-trips a connection, decrypting the refresh token back to plaintext", async () => {
    const connection = GoogleConnection.create(projectId, "super-secret-refresh-token", "sc-domain:example.com");
    await repository.save(connection);

    const found = await repository.findByProjectId(projectId);
    expect(found?.refreshToken).toBe("super-secret-refresh-token");
    expect(found?.gscSiteUrl).toBe("sc-domain:example.com");
    expect(found?.autoRefreshEnabled).toBe(true);
  });

  it("stores the refresh token encrypted, not in plaintext, in the raw row", async () => {
    const connection = GoogleConnection.create(projectId, "super-secret-refresh-token", null);
    await repository.save(connection);

    const row = await prisma.googleConnection.findUnique({ where: { projectId } });
    expect(row?.encryptedRefreshToken).not.toContain("super-secret-refresh-token");
  });

  it("upserts on a second save for the same project rather than creating a duplicate", async () => {
    await repository.save(GoogleConnection.create(projectId, "first-token", null));
    const updated = GoogleConnection.create(projectId, "second-token", "sc-domain:example.com").withGa4PropertyId("501234567");
    await repository.save(updated);

    const found = await repository.findByProjectId(projectId);
    expect(found?.refreshToken).toBe("second-token");
    expect(found?.ga4PropertyId).toBe("501234567");

    const count = await prisma.googleConnection.count({ where: { projectId } });
    expect(count).toBe(1);
  });

  it("returns null for a project with no connection", async () => {
    const found = await repository.findByProjectId(crypto.randomUUID());
    expect(found).toBeNull();
  });

  it("deleteByProjectId removes the connection", async () => {
    await repository.save(GoogleConnection.create(projectId, "token", null));
    await repository.deleteByProjectId(projectId);

    const found = await repository.findByProjectId(projectId);
    expect(found).toBeNull();
  });
});
