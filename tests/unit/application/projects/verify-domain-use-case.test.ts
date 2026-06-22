import { describe, expect, it } from "vitest";
import { VerifyDomainUseCase } from "@/application/projects/use-cases/verify-domain-use-case";
import { Project } from "@/domain/projects/entities/project";
import { DomainName } from "@/domain/projects/value-objects/domain-name";
import { FakeDomainOwnershipPort, FakeProjectRepository } from "./fakes";

function domain(input: string): DomainName {
  const result = DomainName.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("VerifyDomainUseCase", () => {
  it("returns an error when the project does not exist", async () => {
    const projectRepository = new FakeProjectRepository();
    const domainOwnership = new FakeDomainOwnershipPort();
    const useCase = new VerifyDomainUseCase({ projectRepository, domainOwnership });

    const result = await useCase.execute("missing");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PROJECT_NOT_FOUND");
  });

  it("is a no-op when the project is already verified", async () => {
    const projectRepository = new FakeProjectRepository();
    const project = Project.create("Site", domain("example.com"));
    project.markVerified();
    projectRepository.seed(project);
    const domainOwnership = new FakeDomainOwnershipPort();
    const useCase = new VerifyDomainUseCase({ projectRepository, domainOwnership });

    await useCase.execute(project.id);

    expect(domainOwnership.dnsChecks).toHaveLength(0);
    expect(domainOwnership.fileChecks).toHaveLength(0);
    expect(projectRepository.saved).toHaveLength(0);
  });

  it("verifies via DNS and skips the file check when DNS already passed", async () => {
    const projectRepository = new FakeProjectRepository();
    const project = Project.create("Site", domain("example.com"));
    projectRepository.seed(project);
    const domainOwnership = new FakeDomainOwnershipPort();
    domainOwnership.dnsResult = true;
    const useCase = new VerifyDomainUseCase({ projectRepository, domainOwnership });

    const result = await useCase.execute(project.id);

    expect(result.ok && result.value.isVerified).toBe(true);
    expect(domainOwnership.dnsChecks).toEqual([
      { recordName: project.dnsTxtRecordName, expectedValue: project.verificationToken },
    ]);
    expect(domainOwnership.fileChecks).toHaveLength(0);
    expect(projectRepository.saved).toHaveLength(1);
  });

  it("falls back to the well-known file check when DNS fails", async () => {
    const projectRepository = new FakeProjectRepository();
    const project = Project.create("Site", domain("example.com"));
    projectRepository.seed(project);
    const domainOwnership = new FakeDomainOwnershipPort();
    domainOwnership.dnsResult = false;
    domainOwnership.fileResult = true;
    const useCase = new VerifyDomainUseCase({ projectRepository, domainOwnership });

    const result = await useCase.execute(project.id);

    expect(result.ok && result.value.isVerified).toBe(true);
    expect(domainOwnership.fileChecks).toHaveLength(1);
  });

  it("leaves the project unverified when neither check passes", async () => {
    const projectRepository = new FakeProjectRepository();
    const project = Project.create("Site", domain("example.com"));
    projectRepository.seed(project);
    const domainOwnership = new FakeDomainOwnershipPort();
    const useCase = new VerifyDomainUseCase({ projectRepository, domainOwnership });

    const result = await useCase.execute(project.id);

    expect(result.ok && result.value.isVerified).toBe(false);
    expect(projectRepository.saved).toHaveLength(0);
  });
});
