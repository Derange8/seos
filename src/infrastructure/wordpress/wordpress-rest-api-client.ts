import { findPrivateNetworkAddress } from "@/infrastructure/crawler/http/private-network-guard";
import {
  WordPressBlockedPrivateNetworkError,
  WordPressPostNotFoundError,
  WordPressUnauthorizedError,
  WordPressUnreachableError,
  type WordPressClientError,
  type WordPressClientPort,
  type WordPressPostRef,
} from "@/application/wordpress/ports/wordpress-client-port";
import type { WordPressConnection } from "@/domain/wordpress/entities/wordpress-connection";
import { err, ok, type Result } from "@/shared/result";

interface WordPressRestApiClientOptions {
  // Same opt-out as HttpPageFetcher/PlaywrightPageRenderer, same reason —
  // tests need to talk to a local test server. Defaults to false (guarded)
  // in production.
  allowPrivateNetworks?: boolean;
}

interface WordPressPostListItem {
  id: number;
  title: { raw?: string; rendered: string };
  excerpt: { raw?: string; rendered: string };
}

interface RawResponse {
  status: number;
  data: unknown;
}

const POST_TYPES = ["pages", "posts"] as const;

export class WordPressRestApiClient implements WordPressClientPort {
  private readonly allowPrivateNetworks: boolean;

  constructor(options: WordPressRestApiClientOptions = {}) {
    this.allowPrivateNetworks = options.allowPrivateNetworks ?? false;
  }

  async testConnection(connection: WordPressConnection): Promise<Result<void, WordPressClientError>> {
    const guardResult = await this.guardAgainstPrivateNetwork(connection.siteUrl);
    if (!guardResult.ok) return guardResult;

    const response = await this.request(connection, "GET", "/wp/v2/users/me");
    if (!response.ok) return response;

    const error = this.toClientError(response.value.status, ` from "${connection.siteUrl}"`);
    return error ? err(error) : ok(undefined);
  }

  async findPostByUrl(
    connection: WordPressConnection,
    url: string
  ): Promise<Result<WordPressPostRef, WordPressClientError>> {
    const guardResult = await this.guardAgainstPrivateNetwork(connection.siteUrl);
    if (!guardResult.ok) return guardResult;

    const slug = this.extractSlug(url);

    for (const postType of POST_TYPES) {
      const response = await this.request(
        connection,
        "GET",
        `/wp/v2/${postType}?slug=${encodeURIComponent(slug)}&context=edit`
      );
      if (!response.ok) return response;

      const error = this.toClientError(response.value.status, ` while searching ${postType} for "${url}"`);
      if (error) {
        // An auth/network problem applies regardless of post type — no
        // point retrying with the other collection.
        if (error.code === "WORDPRESS_UNAUTHORIZED" || error.code === "WORDPRESS_UNREACHABLE") return err(error);
        continue;
      }

      const items = response.value.data;
      if (Array.isArray(items) && items.length > 0) {
        const item = items[0] as WordPressPostListItem;
        return ok({
          id: item.id,
          postType: postType === "pages" ? "page" : "post",
          currentTitle: item.title.raw ?? item.title.rendered,
          currentExcerpt: item.excerpt.raw ?? item.excerpt.rendered,
        });
      }
    }

    return err(new WordPressPostNotFoundError(`No WordPress page or post found matching "${url}"`));
  }

  async updateTitle(
    connection: WordPressConnection,
    post: WordPressPostRef,
    title: string
  ): Promise<Result<void, WordPressClientError>> {
    const guardResult = await this.guardAgainstPrivateNetwork(connection.siteUrl);
    if (!guardResult.ok) return guardResult;

    const collection = post.postType === "page" ? "pages" : "posts";
    const response = await this.request(connection, "POST", `/wp/v2/${collection}/${post.id}`, { title });
    if (!response.ok) return response;

    const error = this.toClientError(response.value.status, ` while updating ${post.postType} ${post.id}`);
    return error ? err(error) : ok(undefined);
  }

  async updateExcerpt(
    connection: WordPressConnection,
    post: WordPressPostRef,
    excerpt: string
  ): Promise<Result<void, WordPressClientError>> {
    const guardResult = await this.guardAgainstPrivateNetwork(connection.siteUrl);
    if (!guardResult.ok) return guardResult;

    const collection = post.postType === "page" ? "pages" : "posts";
    const response = await this.request(connection, "POST", `/wp/v2/${collection}/${post.id}`, { excerpt });
    if (!response.ok) return response;

    const error = this.toClientError(response.value.status, ` while updating ${post.postType} ${post.id}`);
    return error ? err(error) : ok(undefined);
  }

  private extractSlug(url: string): string {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? "";
  }

  private toClientError(status: number, context: string): WordPressClientError | null {
    if (status === 401 || status === 403) {
      return new WordPressUnauthorizedError(`WordPress rejected the provided credentials${context}`);
    }
    if (status === 404) {
      return new WordPressPostNotFoundError(`WordPress returned 404${context}`);
    }
    if (status < 200 || status >= 300) {
      return new WordPressUnreachableError(`WordPress returned an unexpected status (${status})${context}`);
    }
    return null;
  }

  private async guardAgainstPrivateNetwork(
    siteUrl: string
  ): Promise<Result<void, WordPressBlockedPrivateNetworkError>> {
    if (this.allowPrivateNetworks) return ok(undefined);

    const hostname = new URL(siteUrl).hostname;
    const blockedAddress = await findPrivateNetworkAddress(hostname);
    if (blockedAddress) {
      return err(
        new WordPressBlockedPrivateNetworkError(
          `Refusing to contact "${siteUrl}" — resolves to a private/reserved address (${blockedAddress})`
        )
      );
    }
    return ok(undefined);
  }

  private async request(
    connection: WordPressConnection,
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>
  ): Promise<Result<RawResponse, WordPressUnreachableError>> {
    const credentials = Buffer.from(`${connection.username}:${connection.applicationPassword}`).toString("base64");

    let response: Response;
    try {
      response = await fetch(`${connection.siteUrl}/wp-json${path}`, {
        method,
        headers: {
          authorization: `Basic ${credentials}`,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      return err(
        new WordPressUnreachableError(
          `Failed to reach "${connection.siteUrl}": ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }

    const data = await response.json().catch(() => null);
    return ok({ status: response.status, data });
  }
}
