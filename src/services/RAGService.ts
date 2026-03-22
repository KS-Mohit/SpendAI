import guidanceData from '../data/finance_guidance.json';

interface GuidanceChunk {
  id: string;
  keywords: string[];
  content: string;
}

const chunks: GuidanceChunk[] = guidanceData as GuidanceChunk[];

/**
 * Simple BM25-like keyword search over finance guidance chunks.
 * Returns top N most relevant chunks for a given query.
 */
export function searchGuidance(query: string, topN: number = 2): string[] {
  const queryTerms = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (queryTerms.length === 0) return [];

  const scored = chunks.map((chunk) => {
    let score = 0;
    for (const term of queryTerms) {
      for (const kw of chunk.keywords) {
        if (kw === term) {
          score += 3; // exact match
        } else if (kw.includes(term) || term.includes(kw)) {
          score += 1; // partial match
        }
      }
    }
    return { chunk, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((s) => s.chunk.content);
}
