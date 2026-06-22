import { describe, expect, it } from "vitest";
import { GenerateLlmsTxtUseCase } from "@/application/llms-txt/use-cases/generate-llms-txt-use-case";
import { Page } from "@/domain/crawling/entities/page";
import { Project } from "@/domain/projects/entities/project";
import { DomainName } from "@/domain/projects/value-objects/domain-name";
import { Url } from "@/domain/crawling/value-objects/url";
import { FakeLlmsTxtRepository } from "./fakes";
import { FakePageRepository } from "../crawling/fakes";
import { FakeProjectRepository } from "../projects/fakes";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

function domain(input: string): DomainName {
  const result = DomainName.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("GenerateLlmsTxtUseCase", () => {
  it("generates and persists llms.txt using the project's name", async () => {
    const projectRepository = new FakeProjectRepository();
    const project = Project.create("Acme Inc", domain("example.com"));
    projectRepository.seed(project);

    const pageRepository = new FakePageRepository();
    await pageRepository.save(project.id, Page.create("job-1", url("https://example.com/"), { statusCode: 200 }));
    await pageRepository.save(project.id, Page.create("job-1", url("https://example.com/broken"), { statusCode: 404 }));

    const llmsTxtRepository = new FakeLlmsTxtRepository();
    const useCase = new GenerateLlmsTxtUseCase({ pageRepository, projectRepository, llmsTxtRepository });

    const llmsTxtFile = await useCase.execute(project.id, "job-1");

    expect(llmsTxtFile.pageCount).toBe(1);
    expect(llmsTxtFile.content).toContain("# Acme Inc");
    expect(llmsTxtFile.content).not.toContain("/broken");
    expect(llmsTxtRepository.saved).toHaveLength(1);
  });

  it("throws when the project does not exist", async () => {
    const pageRepository = new FakePageRepository();
    const useCase = new GenerateLlmsTxtUseCase({
      pageRepository,
      projectRepository: new FakeProjectRepository(),
      llmsTxtRepository: new FakeLlmsTxtRepository(),
    });

    await expect(useCase.execute("missing-project", "job-1")).rejects.toThrow();
  });
});
