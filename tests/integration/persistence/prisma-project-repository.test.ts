import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaProjectRepository } from "@/infrastructure/persistence/prisma/prisma-project-repository";
import { Project } from "@/domain/projects/entities/project";
import { DomainName } from "@/domain/projects/value-objects/domain-name";

function domain(input: string): DomainName {
  const result = DomainName.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("PrismaProjectRepository", () => {
  const repository = new PrismaProjectRepository(prisma);
  const createdIds: string[] = [];

  afterEach(async () => {
    await prisma.project.deleteMany({ where: { id: { in: createdIds } } });
    createdIds.length = 0;
  });

  it("round-trips an unverified project", async () => {
    const project = Project.create("My Site", domain(`itest-${crypto.randomUUID()}.example.com`));
    createdIds.push(project.id);

    await repository.save(project);
    const found = await repository.findById(project.id);

    expect(found?.id).toBe(project.id);
    expect(found?.name).toBe("My Site");
    expect(found?.domain.value).toBe(project.domain.value);
    expect(found?.verificationToken).toBe(project.verificationToken);
    expect(found?.isVerified).toBe(false);
  });

  it("persists verification state", async () => {
    const project = Project.create("My Site", domain(`itest-${crypto.randomUUID()}.example.com`));
    createdIds.push(project.id);
    await repository.save(project);

    project.markVerified();
    await repository.save(project);

    const found = await repository.findById(project.id);
    expect(found?.isVerified).toBe(true);
    expect(found?.domainVerifiedAt).toBeInstanceOf(Date);
  });

  it("returns null for an unknown id", async () => {
    const found = await repository.findById(crypto.randomUUID());
    expect(found).toBeNull();
  });

  it("findByDomain finds a project by its exact domain", async () => {
    const projectDomain = `itest-${crypto.randomUUID()}.example.com`;
    const project = Project.create("My Site", domain(projectDomain));
    createdIds.push(project.id);
    await repository.save(project);

    const found = await repository.findByDomain(projectDomain);
    expect(found?.id).toBe(project.id);
  });

  it("findByDomain returns null for a domain that isn't in use", async () => {
    const found = await repository.findByDomain(`itest-${crypto.randomUUID()}.example.com`);
    expect(found).toBeNull();
  });

  it("findAll returns every saved project", async () => {
    const first = Project.create("First", domain(`itest-${crypto.randomUUID()}.example.com`));
    const second = Project.create("Second", domain(`itest-${crypto.randomUUID()}.example.com`));
    createdIds.push(first.id, second.id);
    await repository.save(first);
    await repository.save(second);

    const all = await repository.findAll();
    const ids = all.map((project) => project.id);
    expect(ids).toContain(first.id);
    expect(ids).toContain(second.id);
  });

  it("delete removes the project", async () => {
    const project = Project.create("My Site", domain(`itest-${crypto.randomUUID()}.example.com`));
    await repository.save(project);

    await repository.delete(project.id);

    expect(await repository.findById(project.id)).toBeNull();
  });
});
