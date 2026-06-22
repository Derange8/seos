import { describe, expect, it } from "vitest";
import { GetOrGenerateRobotsFileUseCase } from "@/application/robots/use-cases/get-or-generate-robots-file-use-case";
import { DomainName } from "@/domain/projects/value-objects/domain-name";
import { FakeRobotsRepository } from "./fakes";

function domain(input: string): DomainName {
  const result = DomainName.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("GetOrGenerateRobotsFileUseCase", () => {
  it("generates and persists a robots file when none exists yet", async () => {
    const robotsRepository = new FakeRobotsRepository();
    const useCase = new GetOrGenerateRobotsFileUseCase({ robotsRepository });

    const robotsFile = await useCase.execute("project-1", domain("example.com"));

    expect(robotsFile.content).toContain("Sitemap: https://example.com/sitemap.xml");
    expect(robotsRepository.saved).toHaveLength(1);
  });

  it("returns the existing robots file instead of generating a new one", async () => {
    const robotsRepository = new FakeRobotsRepository();
    const useCase = new GetOrGenerateRobotsFileUseCase({ robotsRepository });
    const first = await useCase.execute("project-1", domain("example.com"));

    const second = await useCase.execute("project-1", domain("example.com"));

    expect(second.id).toBe(first.id);
    expect(robotsRepository.saved).toHaveLength(1);
  });

  it("generates separate robots files for different projects", async () => {
    const robotsRepository = new FakeRobotsRepository();
    const useCase = new GetOrGenerateRobotsFileUseCase({ robotsRepository });

    await useCase.execute("project-1", domain("example.com"));
    await useCase.execute("project-2", domain("other-site.org"));

    expect(robotsRepository.saved).toHaveLength(2);
  });
});
