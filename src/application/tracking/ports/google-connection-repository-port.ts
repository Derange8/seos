import type { GoogleConnection } from "@/domain/tracking/entities/google-connection";

export interface GoogleConnectionRepositoryPort {
  save(connection: GoogleConnection): Promise<void>;
  findByProjectId(projectId: string): Promise<GoogleConnection | null>;
  deleteByProjectId(projectId: string): Promise<void>;
}
