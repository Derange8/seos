import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { WordPressRestApiClient } from "@/infrastructure/wordpress/wordpress-rest-api-client";
import { WordPressConnection } from "@/domain/wordpress/entities/wordpress-connection";

const EXPECTED_USERNAME = "seos-bot";
const EXPECTED_PASSWORD = "correct application password";

interface MockPost {
  id: number;
  type: "page" | "post";
  slug: string;
  title: string;
  excerpt?: string;
}

function basicAuthHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

async function startMockWordPress(posts: MockPost[]): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    const authHeader = req.headers.authorization ?? "";
    const expected = basicAuthHeader(EXPECTED_USERNAME, EXPECTED_PASSWORD);
    if (authHeader !== expected) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "Unauthorized" }));
      return;
    }

    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname === "/wp-json/wp/v2/users/me") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: 1, name: EXPECTED_USERNAME }));
      return;
    }

    const collectionMatch = url.pathname.match(/^\/wp-json\/wp\/v2\/(pages|posts)$/);
    if (collectionMatch && req.method === "GET") {
      const postType = collectionMatch[1] === "pages" ? "page" : "post";
      const slug = url.searchParams.get("slug");
      const matches = posts
        .filter((post) => post.type === postType && post.slug === slug)
        .map((post) => ({
          id: post.id,
          title: { raw: post.title, rendered: post.title },
          excerpt: { raw: post.excerpt ?? "", rendered: post.excerpt ?? "" },
        }));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(matches));
      return;
    }

    const itemMatch = url.pathname.match(/^\/wp-json\/wp\/v2\/(pages|posts)\/(\d+)$/);
    if (itemMatch && req.method === "POST") {
      const postType = itemMatch[1] === "pages" ? "page" : "post";
      const id = Number(itemMatch[2]);
      const post = posts.find((p) => p.id === id && p.type === postType);
      if (!post) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ message: "Not found" }));
        return;
      }
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const parsed = JSON.parse(body || "{}");
        if (typeof parsed.title === "string") post.title = parsed.title;
        if (typeof parsed.excerpt === "string") post.excerpt = parsed.excerpt;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            id: post.id,
            title: { raw: post.title, rendered: post.title },
            excerpt: { raw: post.excerpt ?? "", rendered: post.excerpt ?? "" },
          })
        );
      });
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "Not found" }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

function connection(siteUrl: string, password = EXPECTED_PASSWORD): WordPressConnection {
  return WordPressConnection.create("project-1", siteUrl, EXPECTED_USERNAME, password);
}

describe("WordPressRestApiClient", () => {
  let cleanup: (() => Promise<void>) | null = null;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = null;
    }
  });

  it("testConnection succeeds with correct credentials", async () => {
    const server = await startMockWordPress([]);
    cleanup = server.close;
    const client = new WordPressRestApiClient({ allowPrivateNetworks: true });

    const result = await client.testConnection(connection(server.origin));

    expect(result.ok).toBe(true);
  });

  it("testConnection fails with WORDPRESS_UNAUTHORIZED for wrong credentials", async () => {
    const server = await startMockWordPress([]);
    cleanup = server.close;
    const client = new WordPressRestApiClient({ allowPrivateNetworks: true });

    const result = await client.testConnection(connection(server.origin, "wrong password"));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("WORDPRESS_UNAUTHORIZED");
  });

  it("testConnection fails with WORDPRESS_UNREACHABLE for a site that doesn't respond", async () => {
    const client = new WordPressRestApiClient({ allowPrivateNetworks: true });

    const result = await client.testConnection(connection("http://127.0.0.1:1"));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("WORDPRESS_UNREACHABLE");
  });

  it("blocks a siteUrl that resolves to a private address by default", async () => {
    const server = await startMockWordPress([]);
    cleanup = server.close;
    const client = new WordPressRestApiClient();

    const result = await client.testConnection(connection(server.origin));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("WORDPRESS_BLOCKED_PRIVATE_NETWORK");
  });

  it("findPostByUrl finds a matching page by slug", async () => {
    const server = await startMockWordPress([{ id: 42, type: "page", slug: "about", title: "About Us", excerpt: "Our story" }]);
    cleanup = server.close;
    const client = new WordPressRestApiClient({ allowPrivateNetworks: true });

    const result = await client.findPostByUrl(connection(server.origin), `${server.origin}/about`);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ id: 42, postType: "page", currentTitle: "About Us", currentExcerpt: "Our story" });
    }
  });

  it("findPostByUrl falls back to posts when no page matches the slug", async () => {
    const server = await startMockWordPress([{ id: 7, type: "post", slug: "hello-world", title: "Hello World" }]);
    cleanup = server.close;
    const client = new WordPressRestApiClient({ allowPrivateNetworks: true });

    const result = await client.findPostByUrl(connection(server.origin), `${server.origin}/hello-world`);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ id: 7, postType: "post", currentTitle: "Hello World", currentExcerpt: "" });
    }
  });

  it("findPostByUrl returns WORDPRESS_POST_NOT_FOUND when nothing matches", async () => {
    const server = await startMockWordPress([]);
    cleanup = server.close;
    const client = new WordPressRestApiClient({ allowPrivateNetworks: true });

    const result = await client.findPostByUrl(connection(server.origin), `${server.origin}/does-not-exist`);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("WORDPRESS_POST_NOT_FOUND");
  });

  it("updateTitle updates the page's title on the mock server", async () => {
    const server = await startMockWordPress([{ id: 42, type: "page", slug: "about", title: "About Us" }]);
    cleanup = server.close;
    const client = new WordPressRestApiClient({ allowPrivateNetworks: true });

    const result = await client.updateTitle(
      connection(server.origin),
      { id: 42, postType: "page", currentTitle: "About Us", currentExcerpt: "" },
      "About Our Company"
    );
    expect(result.ok).toBe(true);

    const lookup = await client.findPostByUrl(connection(server.origin), `${server.origin}/about`);
    expect(lookup.ok).toBe(true);
    if (lookup.ok) expect(lookup.value.currentTitle).toBe("About Our Company");
  });

  it("updateTitle returns WORDPRESS_POST_NOT_FOUND for a post id that no longer exists", async () => {
    const server = await startMockWordPress([]);
    cleanup = server.close;
    const client = new WordPressRestApiClient({ allowPrivateNetworks: true });

    const result = await client.updateTitle(
      connection(server.origin),
      { id: 999, postType: "page", currentTitle: "Old", currentExcerpt: "" },
      "New"
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("WORDPRESS_POST_NOT_FOUND");
  });

  it("updateExcerpt updates the page's excerpt on the mock server", async () => {
    const server = await startMockWordPress([{ id: 42, type: "page", slug: "about", title: "About Us", excerpt: "Old excerpt" }]);
    cleanup = server.close;
    const client = new WordPressRestApiClient({ allowPrivateNetworks: true });

    const result = await client.updateExcerpt(
      connection(server.origin),
      { id: 42, postType: "page", currentTitle: "About Us", currentExcerpt: "Old excerpt" },
      "New excerpt"
    );
    expect(result.ok).toBe(true);

    const lookup = await client.findPostByUrl(connection(server.origin), `${server.origin}/about`);
    expect(lookup.ok).toBe(true);
    if (lookup.ok) expect(lookup.value.currentExcerpt).toBe("New excerpt");
  });

  it("updateExcerpt returns WORDPRESS_POST_NOT_FOUND for a post id that no longer exists", async () => {
    const server = await startMockWordPress([]);
    cleanup = server.close;
    const client = new WordPressRestApiClient({ allowPrivateNetworks: true });

    const result = await client.updateExcerpt(
      connection(server.origin),
      { id: 999, postType: "page", currentTitle: "Old", currentExcerpt: "Old" },
      "New"
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("WORDPRESS_POST_NOT_FOUND");
  });
});
