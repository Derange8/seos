import { describe, expect, it } from "vitest";
import { Project } from "@/domain/projects/entities/project";
import { DomainName } from "@/domain/projects/value-objects/domain-name";

function domain(input: string): DomainName {
  const result = DomainName.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("Project", () => {
  it("starts unverified with a generated verification token", () => {
    const project = Project.create("My Site", domain("example.com"));
    expect(project.isVerified).toBe(false);
    expect(project.domainVerifiedAt).toBeNull();
    expect(project.verificationToken).toBeTruthy();
  });

  it("derives the DNS TXT record name and well-known file URL from the domain", () => {
    const project = Project.create("My Site", domain("example.com"));
    expect(project.dnsTxtRecordName).toBe("_seos-challenge.example.com");
    expect(project.wellKnownFileUrl).toBe("https://example.com/.well-known/seos-verify.txt");
  });

  it("markVerified() sets domainVerifiedAt once", () => {
    const project = Project.create("My Site", domain("example.com"));
    project.markVerified();
    expect(project.isVerified).toBe(true);
    expect(project.domainVerifiedAt).toBeInstanceOf(Date);
  });

  it("markVerified() is idempotent and does not bump the timestamp again", () => {
    const project = Project.create("My Site", domain("example.com"));
    project.markVerified();
    const firstVerifiedAt = project.domainVerifiedAt;
    project.markVerified();
    expect(project.domainVerifiedAt).toBe(firstVerifiedAt);
  });

  it("reconstitute() rehydrates a project from persisted state", () => {
    const verifiedAt = new Date("2026-01-01T00:00:00Z");
    const project = Project.reconstitute({
      id: "project-1",
      name: "My Site",
      domain: domain("example.com"),
      verificationToken: "token-123",
      domainVerifiedAt: verifiedAt,
    });
    expect(project.isVerified).toBe(true);
    expect(project.domainVerifiedAt).toBe(verifiedAt);
  });
});
