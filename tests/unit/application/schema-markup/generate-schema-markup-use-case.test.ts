import { describe, expect, it } from "vitest";
import { GenerateSchemaMarkupUseCase } from "@/application/schema-markup/use-cases/generate-schema-markup-use-case";
import { Page } from "@/domain/crawling/entities/page";
import { Project } from "@/domain/projects/entities/project";
import { DomainName } from "@/domain/projects/value-objects/domain-name";
import { Url } from "@/domain/crawling/value-objects/url";
import { FakeSchemaMarkupRepository } from "./fakes";
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

describe("GenerateSchemaMarkupUseCase", () => {
  it("generates and persists schema markup using the project's name", async () => {
    const projectRepository = new FakeProjectRepository();
    const project = Project.create("Acme Inc", domain("example.com"));
    projectRepository.seed(project);

    const pageRepository = new FakePageRepository();
    await pageRepository.save(project.id, Page.create("job-1", url("https://example.com/"), { statusCode: 200 }));

    const schemaMarkupRepository = new FakeSchemaMarkupRepository();
    const useCase = new GenerateSchemaMarkupUseCase({ pageRepository, projectRepository, schemaMarkupRepository });

    const markup = await useCase.execute(project.id, "job-1");

    expect(markup).toHaveLength(1);
    expect(markup[0]?.jsonLd).toMatchObject({ name: "Acme Inc" });
    expect(schemaMarkupRepository.saved).toHaveLength(1);
  });

  it("throws when the project does not exist", async () => {
    const pageRepository = new FakePageRepository();
    const useCase = new GenerateSchemaMarkupUseCase({
      pageRepository,
      projectRepository: new FakeProjectRepository(),
      schemaMarkupRepository: new FakeSchemaMarkupRepository(),
    });

    await expect(useCase.execute("missing-project", "job-1")).rejects.toThrow();
  });
});
