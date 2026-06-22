import type { WordPressConnection } from "@/domain/wordpress/entities/wordpress-connection";

export interface WordPressConnectionRepositoryPort {
  save(connection: WordPressConnection): Promise<void>;
  findByProjectId(projectId: string): Promise<WordPressConnection | null>;
  deleteByProjectId(projectId: string): Promise<void>;
}
