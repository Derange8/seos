import { DomainError } from "@/shared/domain-error";
import type { Result } from "@/shared/result";
import type { WordPressConnection } from "@/domain/wordpress/entities/wordpress-connection";

export class WordPressUnreachableError extends DomainError {
  readonly code = "WORDPRESS_UNREACHABLE";
}

export class WordPressUnauthorizedError extends DomainError {
  readonly code = "WORDPRESS_UNAUTHORIZED";
}

export class WordPressPostNotFoundError extends DomainError {
  readonly code = "WORDPRESS_POST_NOT_FOUND";
}

// Same SSRF surface the crawler has (see private-network-guard.ts) — a
// connection's siteUrl is just as capable of pointing at an internal
// address as a crawl target is, so this client guards against it too.
export class WordPressBlockedPrivateNetworkError extends DomainError {
  readonly code = "WORDPRESS_BLOCKED_PRIVATE_NETWORK";
}

export type WordPressClientError =
  | WordPressUnreachableError
  | WordPressUnauthorizedError
  | WordPressPostNotFoundError
  | WordPressBlockedPrivateNetworkError;

export interface WordPressPostRef {
  id: number;
  postType: "post" | "page";
  currentTitle: string;
  // WordPress core's "excerpt" field — the closest thing to a universal,
  // plugin-independent meta-description target (see updateExcerpt). Not
  // guaranteed to be what the live page's <meta name="description"> tag
  // actually renders — that depends on the site's theme/SEO plugin (Yoast,
  // RankMath, ...), each of which can override it with its own postmeta
  // field. Writing here is a genuine, real edit either way; whether it's
  // *the* edit that changes the rendered tag is theme/plugin-dependent.
  currentExcerpt: string;
}

export interface WordPressClientPort {
  testConnection(connection: WordPressConnection): Promise<Result<void, WordPressClientError>>;
  findPostByUrl(connection: WordPressConnection, url: string): Promise<Result<WordPressPostRef, WordPressClientError>>;
  updateTitle(
    connection: WordPressConnection,
    post: WordPressPostRef,
    title: string
  ): Promise<Result<void, WordPressClientError>>;
  updateExcerpt(
    connection: WordPressConnection,
    post: WordPressPostRef,
    excerpt: string
  ): Promise<Result<void, WordPressClientError>>;
}
