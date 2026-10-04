import type { Embedder } from "./infrai_embeddings.js";
import { needsEscalation, searchableText, type LogisticsDocument } from "./logistics_documents.js";

type IndexedDocument = { document: LogisticsDocument; embedding: number[] };
export type SearchHit = { document: LogisticsDocument; score: number; action: "escalate" | "none" };

function cosine(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0) throw new Error("Embedding dimensions must match");
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }
  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  return denominator === 0 ? 0 : dot / denominator;
}

export class LogisticsSearch {
  private readonly records = new Map<string, IndexedDocument>();
  private readonly embedder: Embedder;

  constructor(embedder: Embedder) {
    this.embedder = embedder;
  }

  async ingest(documents: LogisticsDocument[]): Promise<number> {
    const embeddings = await this.embedder.embed(documents.map(searchableText));
    if (embeddings.length !== documents.length) throw new Error("Embedding count does not match document count");
    documents.forEach((document, index) => {
      this.records.set(document.id, { document, embedding: embeddings[index] });
    });
    return documents.length;
  }

  async search(query: string, limit: number): Promise<SearchHit[]> {
    const queryEmbedding = (await this.embedder.embed([query]))[0];
    if (!queryEmbedding) throw new Error("Query embedding is missing");
    return Array.from(this.records.values())
      .map(({ document, embedding }) => ({
        document,
        score: cosine(queryEmbedding, embedding),
        action: needsEscalation(document) ? "escalate" as const : "none" as const
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }
}
