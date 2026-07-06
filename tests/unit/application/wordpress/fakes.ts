import type { WordPressConnectionRepositoryPort } from "@/application/wordpress/ports/wordpress-connection-repository-port";
import type {
  NewWordPressPost,
  WordPressClientError,
  WordPressClientPort,
  WordPressPostRef,
} from "@/application/wordpress/ports/wordpress-client-port";
import { WordPressUnreachableError } from "@/application/wordpress/ports/wordpress-client-port";
import type { WordPressConnection } from "@/domain/wordpress/entities/wordpress-connection";
import { ok, err, type Result } from "@/shared/result";

export class FakeWordPressConnectionRepository implements WordPressConnectionRepositoryPort {
  private readonly byProjectId = new Map<string, WordPressConnection>();

  async save(connection: WordPressConnection): Promise<void> {
    this.byProjectId.set(connection.projectId, connection);
  }

  async findByProjectId(projectId: string): Promise<WordPressConnection | null> {
    return this.byProjectId.get(projectId) ?? null;
  }

  async deleteByProjectId(projectId: string): Promise<void> {
    this.byProjectId.delete(projectId);
  }

  seed(connection: WordPressConnection): void {
    this.byProjectId.set(connection.projectId, connection);
  }
}

export class FakeWordPressClient implements WordPressClientPort {
  testConnectionResult: Result<void, WordPressClientError> = ok(undefined);
  findPostByUrlResult: Result<WordPressPostRef, WordPressClientError> = err(new WordPressUnreachableError("not configured"));
  updateTitleResult: Result<void, WordPressClientError> = ok(undefined);
  updateExcerptResult: Result<void, WordPressClientError> = ok(undefined);
  updateContentResult: Result<void, WordPressClientError> = ok(undefined);
  createPostResult: Result<WordPressPostRef, WordPressClientError> = err(new WordPressUnreachableError("not configured"));

  readonly updateTitleCalls: Array<{ post: WordPressPostRef; title: string }> = [];
  readonly updateExcerptCalls: Array<{ post: WordPressPostRef; excerpt: string }> = [];
  readonly updateContentCalls: Array<{ post: WordPressPostRef; content: string }> = [];
  readonly createPostCalls: NewWordPressPost[] = [];

  async testConnection(): Promise<Result<void, WordPressClientError>> {
    return this.testConnectionResult;
  }

  async findPostByUrl(): Promise<Result<WordPressPostRef, WordPressClientError>> {
    return this.findPostByUrlResult;
  }

  async updateTitle(_connection: WordPressConnection, post: WordPressPostRef, title: string): Promise<Result<void, WordPressClientError>> {
    this.updateTitleCalls.push({ post, title });
    return this.updateTitleResult;
  }

  async updateExcerpt(_connection: WordPressConnection, post: WordPressPostRef, excerpt: string): Promise<Result<void, WordPressClientError>> {
    this.updateExcerptCalls.push({ post, excerpt });
    return this.updateExcerptResult;
  }

  async updateContent(_connection: WordPressConnection, post: WordPressPostRef, content: string): Promise<Result<void, WordPressClientError>> {
    this.updateContentCalls.push({ post, content });
    return this.updateContentResult;
  }

  async createPost(_connection: WordPressConnection, post: NewWordPressPost): Promise<Result<WordPressPostRef, WordPressClientError>> {
    this.createPostCalls.push(post);
    return this.createPostResult;
  }
}
