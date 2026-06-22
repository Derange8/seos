import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DomainOwnershipChecker } from "@/infrastructure/verification/domain-ownership-checker";

vi.mock("node:dns/promises", () => ({
  resolveTxt: vi.fn(),
}));

async function startServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

describe("DomainOwnershipChecker", () => {
  const checker = new DomainOwnershipChecker();
  let cleanup: (() => Promise<void>) | null = null;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = null;
    }
  });

  describe("checkWellKnownFile", () => {
    it("returns true when the file content matches the expected token exactly", async () => {
      const server = await startServer((_req, res) => {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("the-token\n");
      });
      cleanup = server.close;

      const result = await checker.checkWellKnownFile(`${server.origin}/.well-known/seos-verify.txt`, "the-token");
      expect(result).toBe(true);
    });

    it("returns false when the file content does not match", async () => {
      const server = await startServer((_req, res) => {
        res.writeHead(200);
        res.end("some-other-value");
      });
      cleanup = server.close;

      const result = await checker.checkWellKnownFile(`${server.origin}/.well-known/seos-verify.txt`, "the-token");
      expect(result).toBe(false);
    });

    it("returns false on a 404", async () => {
      const server = await startServer((_req, res) => {
        res.writeHead(404);
        res.end();
      });
      cleanup = server.close;

      const result = await checker.checkWellKnownFile(`${server.origin}/.well-known/seos-verify.txt`, "the-token");
      expect(result).toBe(false);
    });

    it("returns false when nothing is listening", async () => {
      const server = await startServer((_req, res) => res.end());
      const origin = server.origin;
      await server.close();

      const result = await checker.checkWellKnownFile(`${origin}/.well-known/seos-verify.txt`, "the-token");
      expect(result).toBe(false);
    });
  });

  describe("checkDnsTxtRecord", () => {
    it("returns true when a TXT record matches the expected value", async () => {
      const { resolveTxt } = await import("node:dns/promises");
      vi.mocked(resolveTxt).mockResolvedValueOnce([["the-token"]]);

      const result = await checker.checkDnsTxtRecord("_seos-challenge.example.com", "the-token");
      expect(result).toBe(true);
    });

    it("joins multi-chunk TXT records before comparing", async () => {
      const { resolveTxt } = await import("node:dns/promises");
      vi.mocked(resolveTxt).mockResolvedValueOnce([["the-", "token"]]);

      const result = await checker.checkDnsTxtRecord("_seos-challenge.example.com", "the-token");
      expect(result).toBe(true);
    });

    it("returns false when no TXT record matches", async () => {
      const { resolveTxt } = await import("node:dns/promises");
      vi.mocked(resolveTxt).mockResolvedValueOnce([["unrelated-value"]]);

      const result = await checker.checkDnsTxtRecord("_seos-challenge.example.com", "the-token");
      expect(result).toBe(false);
    });

    it("returns false (not an error) when DNS resolution fails", async () => {
      const { resolveTxt } = await import("node:dns/promises");
      vi.mocked(resolveTxt).mockRejectedValueOnce(new Error("ENOTFOUND"));

      const result = await checker.checkDnsTxtRecord("_seos-challenge.example.com", "the-token");
      expect(result).toBe(false);
    });
  });
});
