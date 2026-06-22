import { describe, expect, it } from "vitest";
import { ConnectWordPressUseCase } from "@/application/wordpress/use-cases/connect-wordpress-use-case";
import { WordPressUnauthorizedError } from "@/application/wordpress/ports/wordpress-client-port";
import { err } from "@/shared/result";
import { FakeWordPressClient, FakeWordPressConnectionRepository } from "./fakes";

describe("ConnectWordPressUseCase", () => {
  it("normalizes the site URL, tests the connection, and persists it", async () => {
    const wordPressClient = new FakeWordPressClient();
    const wordPressConnectionRepository = new FakeWordPressConnectionRepository();
    const useCase = new ConnectWordPressUseCase({ wordPressClient, wordPressConnectionRepository });

    const result = await useCase.execute("project-1", "https://example.com/blog/", " seos-bot ", " app-password ");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.siteUrl).toBe("https://example.com/blog");
      expect(result.value.username).toBe("seos-bot");
      expect(result.value.applicationPassword).toBe("app-password");
    }
    expect(await wordPressConnectionRepository.findByProjectId("project-1")).not.toBeNull();
  });

  it("rejects an invalid site URL and never tests/persists anything", async () => {
    const wordPressClient = new FakeWordPressClient();
    const wordPressConnectionRepository = new FakeWordPressConnectionRepository();
    const useCase = new ConnectWordPressUseCase({ wordPressClient, wordPressConnectionRepository });

    const result = await useCase.execute("project-1", "not a url", "seos-bot", "app-password");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_SITE_URL");
    expect(await wordPressConnectionRepository.findByProjectId("project-1")).toBeNull();
  });

  it("rejects a non-http(s) URL", async () => {
    const wordPressClient = new FakeWordPressClient();
    const wordPressConnectionRepository = new FakeWordPressConnectionRepository();
    const useCase = new ConnectWordPressUseCase({ wordPressClient, wordPressConnectionRepository });

    const result = await useCase.execute("project-1", "ftp://example.com", "seos-bot", "app-password");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_SITE_URL");
  });

  it("rejects an empty username or password", async () => {
    const wordPressClient = new FakeWordPressClient();
    const wordPressConnectionRepository = new FakeWordPressConnectionRepository();
    const useCase = new ConnectWordPressUseCase({ wordPressClient, wordPressConnectionRepository });

    const result = await useCase.execute("project-1", "https://example.com", "  ", "app-password");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_WORDPRESS_CREDENTIALS");
  });

  it("does not persist the connection when the connection test fails", async () => {
    const wordPressClient = new FakeWordPressClient();
    wordPressClient.testConnectionResult = err(new WordPressUnauthorizedError("bad credentials"));
    const wordPressConnectionRepository = new FakeWordPressConnectionRepository();
    const useCase = new ConnectWordPressUseCase({ wordPressClient, wordPressConnectionRepository });

    const result = await useCase.execute("project-1", "https://example.com", "seos-bot", "wrong-password");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("WORDPRESS_UNAUTHORIZED");
    expect(await wordPressConnectionRepository.findByProjectId("project-1")).toBeNull();
  });
});
