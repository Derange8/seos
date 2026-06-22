import { describe, expect, it } from "vitest";
import { CreateProjectUseCase } from "@/application/projects/use-cases/create-project-use-case";
import { FakeProjectRepository } from "./fakes";

describe("CreateProjectUseCase", () => {
  it("creates an unverified project with a normalized domain", async () => {
    const projectRepository = new FakeProjectRepository();
    const useCase = new CreateProjectUseCase({ projectRepository });

    const result = await useCase.execute("My Site", "Example.COM");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("My Site");
    expect(result.value.domain.value).toBe("example.com");
    expect(result.value.isVerified).toBe(false);
    expect(projectRepository.saved).toHaveLength(1);
  });

  it("rejects an invalid domain and persists nothing", async () => {
    const projectRepository = new FakeProjectRepository();
    const useCase = new CreateProjectUseCase({ projectRepository });

    const result = await useCase.execute("My Site", "not a domain");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_DOMAIN_NAME");
    expect(projectRepository.saved).toHaveLength(0);
  });

  it("allows creating a second project with a different domain", async () => {
    const projectRepository = new FakeProjectRepository();
    const useCase = new CreateProjectUseCase({ projectRepository });
    await useCase.execute("First", "example.com");

    const result = await useCase.execute("Second", "other.com");

    expect(result.ok).toBe(true);
    expect(projectRepository.saved).toHaveLength(2);
  });

  it("rejects creating a second project with an already-used domain", async () => {
    const projectRepository = new FakeProjectRepository();
    const useCase = new CreateProjectUseCase({ projectRepository });
    await useCase.execute("First", "example.com");

    const result = await useCase.execute("Second", "example.com");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOMAIN_ALREADY_EXISTS");
    expect(projectRepository.saved).toHaveLength(1);
  });

  it("rejects an empty (or whitespace-only) name and persists nothing", async () => {
    const projectRepository = new FakeProjectRepository();
    const useCase = new CreateProjectUseCase({ projectRepository });

    const result = await useCase.execute("   ", "example.com");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_PROJECT_NAME");
    expect(projectRepository.saved).toHaveLength(0);
  });

  it("rejects a name over the maximum length and persists nothing", async () => {
    const projectRepository = new FakeProjectRepository();
    const useCase = new CreateProjectUseCase({ projectRepository });

    const result = await useCase.execute("x".repeat(201), "example.com");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_PROJECT_NAME");
    expect(projectRepository.saved).toHaveLength(0);
  });

  it("trims surrounding whitespace from a valid name", async () => {
    const projectRepository = new FakeProjectRepository();
    const useCase = new CreateProjectUseCase({ projectRepository });

    const result = await useCase.execute("  My Site  ", "example.com");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name).toBe("My Site");
  });
});
