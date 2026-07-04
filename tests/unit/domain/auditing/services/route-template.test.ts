import { describe, expect, it } from "vitest";
import { deriveRouteTemplates } from "@/domain/auditing/services/route-template";

describe("deriveRouteTemplates", () => {
  it("templates the segment that varies across same-shape URLs", () => {
    const urls = [
      "https://example.com/post/1",
      "https://example.com/post/2",
      "https://example.com/post/abc-slug",
    ];
    const templates = deriveRouteTemplates(urls);
    expect(templates.get("https://example.com/post/1")).toBe("/post/[id]");
    expect(templates.get("https://example.com/post/2")).toBe("/post/[id]");
    expect(templates.get("https://example.com/post/abc-slug")).toBe("/post/[id]");
  });

  it("keeps a literal segment that never varies within its bucket", () => {
    const urls = ["https://example.com/about", "https://example.com/contact"];
    const templates = deriveRouteTemplates(urls);
    expect(templates.get("https://example.com/about")).toBe("/about");
    expect(templates.get("https://example.com/contact")).toBe("/contact");
  });

  it("does not template a single-URL bucket (nothing to compare against)", () => {
    const templates = deriveRouteTemplates(["https://example.com/profile/42"]);
    expect(templates.get("https://example.com/profile/42")).toBe("/profile/42");
  });

  it("keeps different segment-length URLs in separate buckets rather than merging them", () => {
    const urls = ["https://example.com/post/1", "https://example.com/post/1/comments"];
    const templates = deriveRouteTemplates(urls);
    expect(templates.get("https://example.com/post/1")).toBe("/post/1");
    expect(templates.get("https://example.com/post/1/comments")).toBe("/post/1/comments");
  });

  it("templates the root path as itself", () => {
    const templates = deriveRouteTemplates(["https://example.com/"]);
    expect(templates.get("https://example.com/")).toBe("/");
  });

  it("templates multiple varying identifier-shaped positions independently", () => {
    const urls = [
      "https://example.com/user/1/post/10",
      "https://example.com/user/2/post/20",
    ];
    const templates = deriveRouteTemplates(urls);
    expect(templates.get("https://example.com/user/1/post/10")).toBe("/user/[id]/post/[id]");
    expect(templates.get("https://example.com/user/2/post/20")).toBe("/user/[id]/post/[id]");
  });

  it("does not template a varying but non-identifier-shaped segment (e.g. a locale prefix)", () => {
    const urls = ["https://example.com/en/post/1", "https://example.com/tr/post/2"];
    const templates = deriveRouteTemplates(urls);
    expect(templates.get("https://example.com/en/post/1")).toBe("/en/post/[id]");
    expect(templates.get("https://example.com/tr/post/2")).toBe("/tr/post/[id]");
  });

  it("templates opaque cuid-style IDs with no separators (e.g. Prisma's default primary keys)", () => {
    const urls = [
      "https://example.com/post/cmp5rjzww004uv06hpoc8x666",
      "https://example.com/post/cmp5rjzvr004cv06h366o6m5w",
    ];
    const templates = deriveRouteTemplates(urls);
    expect(templates.get("https://example.com/post/cmp5rjzww004uv06hpoc8x666")).toBe("/post/[id]");
    expect(templates.get("https://example.com/post/cmp5rjzvr004cv06h366o6m5w")).toBe("/post/[id]");
  });

  it("does not template a short all-alphabetic segment even without separators", () => {
    const urls = ["https://example.com/post/profile", "https://example.com/post/settings"];
    const templates = deriveRouteTemplates(urls);
    expect(templates.get("https://example.com/post/profile")).toBe("/post/profile");
    expect(templates.get("https://example.com/post/settings")).toBe("/post/settings");
  });

  it("ignores unparseable URLs without throwing", () => {
    const templates = deriveRouteTemplates(["not a url", "https://example.com/post/1"]);
    expect(templates.get("not a url")).toBeUndefined();
    expect(templates.get("https://example.com/post/1")).toBe("/post/1");
  });
});
