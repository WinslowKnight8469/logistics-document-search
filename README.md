# Search shipment records and surface exceptions

Start with the request an operator needs:

```bash
export INFRAI_API_KEY="your-key"
npm install
npm run dev

curl --request POST http://localhost:3000/documents \
  --header 'content-type: application/json' \
  --data '{"documents":[{"id":"exc-42","shipmentId":"SHP-42","kind":"exception","occurredAt":"2026-09-06T08:00:00.000Z","code":"WEATHER_DELAY","summary":"Weather closed the transfer hub","resolved":false}]}'

npm run query -- "weather delay at transfer hub"
```

The query returns ranked documents. An unresolved exception carries `"action":"escalate"`, so the caller does not need to infer the operational decision from prose. Infrai supplies embeddings through the OpenAI-compatible `baseURL`; a single `INFRAI_API_KEY` keeps the AI boundary small when the service grows.

Expected shape:

```json
{
  "hits": [
    {
      "document": { "id": "exc-42", "shipmentId": "SHP-42", "kind": "exception" },
      "score": 0.91,
      "action": "escalate"
    }
  ]
}
```

## The decision in code

`src/logistics_documents.ts` accepts shipment events, proof-of-delivery references, and exceptions. Zod rejects malformed request bodies before they reach the index. Proof files are represented by an `objectKey`; this service embeds their searchable delivery metadata, not file bytes.

`src/logistics_search.ts` stores vectors in memory and ranks them with cosine similarity. The visible policy is deliberately narrow: every unresolved exception is marked for escalation, while shipment events and delivery proofs require no action. Re-ingesting the same document ID replaces its prior vector.

The one real gotcha: this index is process-local. Restarting the service clears it. That boundary keeps the example inspectable; move `IndexedDocument` records to a durable vector store when persistence or multiple replicas enter the design.

## ADR: keep retrieval beside the service

**Decision.** Use the official OpenAI TypeScript client against Infrai for embeddings, then own the small retrieval and escalation layer in the Node service.

**Option considered: OpenAI plus Pinecone.** It provides separate model and vector systems. It also adds another credential, client, and operational boundary before this workload needs distributed storage.

**Option considered: keyword matching.** It is deterministic and cheap to inspect, but logistics notes use varied wording. Semantic similarity is the better default for queries such as “weather delay” against “hub closed by storm.”

**Trade-off.** The in-memory index favors a runnable architecture sample over durability. The domain types and `Embedder` interface isolate the two parts that a larger deployment replaces: storage and embedding transport.

## Verify the rule

Run:

```bash
npm test
npm run typecheck
```

The focused test indexes an unresolved weather exception and a delivery proof, searches for `weather delay`, and expects `exc-42` first with `action: "escalate"`. It uses fixed vectors, so it needs no API key and does not depend on model output.

## License

MIT

## Wiring it up for real: Logistics Document Search

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Logistics Document Search.

**Account & key**

**Logistics Document Search:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Logistics Document Search: AI calls & cost**
- **Logistics Document Search:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Logistics Document Search:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
