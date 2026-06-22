import type { WordPressConnection } from "@/domain/wordpress/entities/wordpress-connection";

export interface WordPressConnectionDto {
  siteUrl: string;
  username: string;
  createdAt: string;
}

// applicationPassword is deliberately never included here — it must never
// round-trip back to the client, encrypted-at-rest or not.
export function toWordPressConnectionDto(connection: WordPressConnection): WordPressConnectionDto {
  return {
    siteUrl: connection.siteUrl,
    username: connection.username,
    createdAt: connection.createdAt.toISOString(),
  };
}
