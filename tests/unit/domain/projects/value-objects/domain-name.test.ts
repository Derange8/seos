import { describe, expect, it } from "vitest";
import { DomainName } from "@/domain/projects/value-objects/domain-name";

describe("DomainName", () => {
  it("accepts a normal domain and lowercases it", () => {
    const result = DomainName.create("Example.COM");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.value).toBe("example.com");
  });

  it("accepts subdomains", () => {
    const result = DomainName.create("blog.example.com");
    expect(result.ok).toBe(true);
  });

  it("rejects a bare TLD with no dot", () => {
    const result = DomainName.create("localhost");
    expect(result.ok).toBe(false);
  });

  it("rejects a full URL instead of a bare hostname", () => {
    const result = DomainName.create("https://example.com");
    expect(result.ok).toBe(false);
  });

  it("rejects a domain with a leading or trailing hyphen in a label", () => {
    expect(DomainName.create("-example.com").ok).toBe(false);
    expect(DomainName.create("example-.com").ok).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(DomainName.create("").ok).toBe(false);
  });

  it("equals() compares normalized hostnames", () => {
    const a = DomainName.create("Example.com");
    const b = DomainName.create("example.COM");
    if (a.ok && b.ok) {
      expect(a.value.equals(b.value)).toBe(true);
    } else {
      throw new Error("expected ok results");
    }
  });
});
