import type { SeoScore } from "@/domain/scoring/entities/seo-score";

export interface SeoScoreDto {
  category: string;
  score: number;
}

export function toSeoScoreDto(seoScore: SeoScore): SeoScoreDto {
  return {
    category: seoScore.category,
    score: seoScore.score,
  };
}
