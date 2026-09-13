export type RetrievalRelevance =
  | "high"
  | "medium"
  | "low";

export interface RetrievalEvaluation {
  score: number;
  relevance: RetrievalRelevance;
}

export function evaluateRetrieval(
  similarity: number,
): RetrievalEvaluation {
  if (similarity >= 0.7) {
    return {
      score: similarity,
      relevance: "high",
    };
  }

  if (similarity >= 0.5) {
    return {
      score: similarity,
      relevance: "medium",
    };
  }

  return {
    score: similarity,
    relevance: "low",
  };
}