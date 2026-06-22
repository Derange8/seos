import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaWordPressConnectionRepository } from "@/infrastructure/persistence/prisma/prisma-wordpress-connection-repository";
import { WordPressConnection } from "@/domain/wordpress/entities/wordpress-connection";

describe("PrismaWordPressConnectionRepository", () => {
  const repository = new PrismaWordPressConnectionRepository(prisma);
  let projectId: string;

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: { name: "WordPress Test Project", domain: `itest-${crypto.randomUUID()}.example.com` },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("round-trips a connection, decrypting the application password back to plaintext", async () => {
    const connection = WordPressConnection.create(projectId, "https://example.com", "seos-bot", "super secret app password");

    await repository.save(connection);
    const found = await repository.findByProjectId(projectId);

    expect(found?.siteUrl).toBe("https://example.com");
    expect(found?.username).toBe("seos-bot");
    expect(found?.applicationPassword).toBe("super secret app password");
  });

  it("stores the password encrypted, not in plaintext, in the raw row", async () => {
    const connection = WordPressConnection.create(projectId, "https://example.com", "seos-bot", "super secret app password");
    await repository.save(connection);

    const row = await prisma.wordPressConnection.findUnique({ where: { projectId } });

    expect(row?.encryptedPassword).not.toContain("super secret app password");
  });

  it("upserts on a second save for the same project rather than creating a duplicate", async () => {
    const first = WordPressConnection.create(projectId, "https://example.com", "seos-bot", "first password");
    await repository.save(first);
    const second = WordPressConnection.create(projectId, "https://example.org", "seos-bot-2", "second password");
    await repository.save(second);

    const found = await repository.findByProjectId(projectId);
    expect(found?.siteUrl).toBe("https://example.org");
    expect(found?.applicationPassword).toBe("second password");

    const count = await prisma.wordPressConnection.count({ where: { projectId } });
    expect(count).toBe(1);
  });

  it("returns null for a project with no connection", async () => {
    const found = await repository.findByProjectId(crypto.randomUUID());
    expect(found).toBeNull();
  });

  it("deleteByProjectId removes the connection", async () => {
    const connection = WordPressConnection.create(projectId, "https://example.com", "seos-bot", "password");
    await repository.save(connection);

    await repository.deleteByProjectId(projectId);

    const found = await repository.findByProjectId(projectId);
    expect(found).toBeNull();
  });
});
