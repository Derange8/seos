import { describe, expect, it } from "vitest";
import { renderRobotsTxt } from "@/domain/robots/services/robots-generator";
import { DomainName } from "@/domain/projects/value-objects/domain-name";

function domain(input: string): DomainName {
  const result = DomainName.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("renderRobotsTxt", () => {
  it("allows all crawling by default", () => {
    const content = renderRobotsTxt(domain("example.com"));
    expect(content).toContain("User-agent: *");
    expect(content).toContain("Allow: /");
  });

  it("points the Sitemap directive at the project's own domain", () => {
    const content = renderRobotsTxt(domain("example.com"));
    expect(content).toContain("Sitemap: https://example.com/sitemap.xml");
  });

  it("uses the right domain for a different project", () => {
    const content = renderRobotsTxt(domain("other-site.org"));
    expect(content).toContain("Sitemap: https://other-site.org/sitemap.xml");
  });
});
