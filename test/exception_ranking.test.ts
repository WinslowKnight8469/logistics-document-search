import assert from "node:assert/strict";
import test from "node:test";
import type { Embedder } from "../src/infrai_embeddings.js";
import type { LogisticsDocument } from "../src/logistics_documents.js";
import { LogisticsSearch } from "../src/logistics_search.js";

class FixedEmbedder implements Embedder {
  async embed(input: string[]): Promise<number[][]> {
    return input.map((text) => text.includes("weather") || text === "weather delay" ? [1, 0] : [0, 1]);
  }
}

test("a matching unresolved exception is returned with an escalation action", async () => {
  const records: LogisticsDocument[] = [
    {
      id: "exc-42", shipmentId: "SHP-42", kind: "exception", occurredAt: "2026-09-06T08:00:00.000Z",
      code: "WEATHER_DELAY", summary: "weather closed the transfer hub", resolved: false
    },
    {
      id: "pod-42", shipmentId: "SHP-42", kind: "proof_of_delivery", occurredAt: "2026-09-05T08:00:00.000Z",
      objectKey: "pod/SHP-42.pdf", recipient: "Lee", notes: "signed at dock"
    }
  ];
  const index = new LogisticsSearch(new FixedEmbedder());
  await index.ingest(records);

  const hits = await index.search("weather delay", 1);

  assert.equal(hits[0].document.id, "exc-42");
  assert.equal(hits[0].action, "escalate");
});
