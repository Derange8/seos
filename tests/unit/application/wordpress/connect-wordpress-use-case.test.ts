import { describe, expect, it } from "vitest";
import { ConnectWordPressUseCase } from "@/application/wordpress/use-cases/connect-wordpress-use-case";
import { WordPressUnauthorizedError } from "@/application/wordpress/ports/wordpress-client-port";
import { Project } from "@/domain/projects/entities/project";
import { DomainName } from "@/domain/projects/value-objects/domain-name";
import { err } from "@/shared/result";
import { FakeWordPressClient, FakeWordPressConnectionRepository } from "./fakes";
import { FakeProjectRepository } from "../projects/fakes";

function domain(input: string): DomainName {
  const result = DomainName.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

function verifiedProject(): Project {
  const project = Project.create("Example", domain("example.com"));
  project.markVerified();
  return project;
}

describe("ConnectWordPressUseCase", () => {
  it("normalizes the site URL, tests the connection, and persists it", async () => {
    const wordPressClient = new FakeWordPressClient();
    const wordPressConnectionRepository = new FakeWordPressConnectionRepository();
    const projectRepository = new FakeProjectRepository();
    const project = verifiedProject();
    projectRepository.seed(project);
    const useCase = new ConnectWordPressUseCase({ projectRepository, wordPressClient, wordPressConnectionRepository });

    const result = await useCase.execute(project.id, "https://example.com/blog/", " seos-bot ", " app-password ");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.siteUrl).toBe("https://example.com/blog");
      expect(result.value.username).toBe("seos-bot");
      expect(result.value.applicationPassword).toBe("app-password");
    }
    expect(await wordPressConnectionRepository.findByProjectId(project.id)).not.toBeNull();
  });

  it("refuses to connect when the project's domain is not verified", async () => {
    const wordPressClient = new FakeWordPressClient();
    const wordPressConnectionRepository = new FakeWordPressConnectionRepository();
    const projectRepository = new FakeProjectRepository();
    const project = Project.create("Example", domain("example.com")); // not verified
    projectRepository.seed(project);
    const useCase = new ConnectWordPressUseCase({ projectRepository, wordPressClient, wordPressConnectionRepository });

    const result = await useCase.execute(project.id, "https://example.com", "seos-bot", "app-password");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOMAIN_NOT_VERIFIED");
    expect(await wordPressConnectionRepository.findByProjectId(project.id)).toBeNull();
  });

  it("returns an error when the project does not exist", async () => {
    const wordPressClient = new FakeWordPressClient();
    const wordPressConnectionRepository = new FakeWordPressConnectionRepository();
    const projectRepository = new FakeProjectRepository();
    const useCase = new ConnectWordPressUseCase({ projectRepository, wordPressClient, wordPressConnectionRepository });

    const result = await useCase.execute("missing-project", "https://example.com", "seos-bot", "app-password");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PROJECT_NOT_FOUND");
  });

  it("rejects an invalid site URL and never tests/persists anything", async () => {
    const wordPressClient = new FakeWordPressClient();
    const wordPressConnectionRepository = new FakeWordPressConnectionRepository();
    const projectRepository = new FakeProjectRepository();
    const project = verifiedProject();
    projectRepository.seed(project);
    const useCase = new ConnectWordPressUseCase({ projectRepository, wordPressClient, wordPressConnectionRepository });

    const result = await useCase.execute(project.id, "not a url", "seos-bot", "app-password");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_SITE_URL");
    expect(await wordPressConnectionRepository.findByProjectId(project.id)).toBeNull();
  });

  it("rejects a non-http(s) URL", async () => {
    const wordPressClient = new FakeWordPressClient();
    const wordPressConnectionRepository = new FakeWordPressConnectionRepository();
    const projectRepository = new FakeProjectRepository();
    const project = verifiedProject();
    projectRepository.seed(project);
    const useCase = new ConnectWordPressUseCase({ projectRepository, wordPressClient, wordPressConnectionRepository });

    const result = await useCase.execute(project.id, "ftp://example.com", "seos-bot", "app-password");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_SITE_URL");
  });

  it("rejects an empty username or password", async () => {
    const wordPressClient = new FakeWordPressClient();
    const wordPressConnectionRepository = new FakeWordPressConnectionRepository();
    const projectRepository = new FakeProjectRepository();
    const project = verifiedProject();
    projectRepository.seed(project);
    const useCase = new ConnectWordPressUseCase({ projectRepository, wordPressClient, wordPressConnectionRepository });

    const result = await useCase.execute(project.id, "https://example.com", "  ", "app-password");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_WORDPRESS_CREDENTIALS");
  });

  it("does not persist the connection when the connection test fails", async () => {
    const wordPressClient = new FakeWordPressClient();
    wordPressClient.testConnectionResult = err(new WordPressUnauthorizedError("bad credentials"));
    const wordPressConnectionRepository = new FakeWordPressConnectionRepository();
    const projectRepository = new FakeProjectRepository();
    const project = verifiedProject();
    projectRepository.seed(project);
    const useCase = new ConnectWordPressUseCase({ projectRepository, wordPressClient, wordPressConnectionRepository });

    const result = await useCase.execute(project.id, "https://example.com", "seos-bot", "wrong-password");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("WORDPRESS_UNAUTHORIZED");
    expect(await wordPressConnectionRepository.findByProjectId(project.id)).toBeNull();
  });
});
