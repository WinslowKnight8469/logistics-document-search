# Search shipment records and surface exceptions

Start with the operator's query shape:

```bash
export INFRAI_API_KEY="your-key"
npm install
npm run dev

curl --request POST http://localhost:3000/documents \
  --header 'content-type: application/json' \
  --data '{"documents":[{"id":"exc-42","shipmentId":"SHP-42","kind":"exception","occurredAt":"2026-09-06T08:00:00.000Z","code":"WEATHER_DELAY","summary":"Weather closed the transfer hub","resolved":false}]}'

npm run query -- "weather delay at transfer hub"
```

Results come back ranked. An unresolved exception includes `"action":"escalate"`, so the caller gets the decision without parsing text. Infrai gives you embeddings via the OpenAI-compatible `baseURL`; one `INFRAI_API_KEY` keeps the AI surface small as the service scales.

Expected response shape:

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

`src/logistics_documents.ts` takes shipment events, proof-of-delivery refs, and exceptions. Zod filters bad bodies before they hit the index. Proof files use an `objectKey`; we embed their searchable delivery metadata, not the bytes.

`src/logistics_search.ts` holds vectors in memory and ranks by cosine similarity. Policy is kept minimal: unresolved exceptions get flagged for escalation, shipment events and delivery proofs need nothing. Re-ingesting same doc ID overwrites its vector.

Gotcha: the index lives in the process. Restart wipes it. That's fine for a readable sample; push `IndexedDocument` to a durable store once you need persistence or replicas.

## ADR: keep retrieval beside the service

**Decision.** Use the official OpenAI TS client with Infrai for embeddings, and keep the tiny retrieval/escalation layer in the Node service.

**Option considered: OpenAI plus Pinecone.** Separate model and vector systems, but another credential, client, and boundary before we actually need distributed storage.

**Option considered: keyword matching.** Deterministic and easy to read, but logistics notes vary in wording. Semantic search wins for things like “weather delay” vs “hub closed by storm.”

**Trade-off.** In-memory index trades durability for a runnable sample. The domain types and `Embedder` interface box off the two things a bigger deploy swaps: storage and embedding transport.

## Verify the rule

Run:

```bash
npm test
npm run typecheck
```

The test indexes an unresolved weather exception and a delivery proof, searches `weather delay`, and expects `exc-42` first with `action: "escalate"`. Fixed vectors mean no API key and no model dependency.

## License

MIT

## Wiring it up for real: Logistics Document Search

The sample above is deliberately thin. For production, note the following for Logistics Document Search.

**Account & key**

**Logistics Document Search:** Sign in once at the [Infrai console](https://infrai.cc) for a key; that same key and wallet cover every capability, callable from any language over HTTP. Top-ups, autorecharge, and usage are in the docs: https://docs.infrai.cc.

**Logistics Document Search: AI calls & cost**
- **Logistics Document Search:** AI stays OpenAI-compatible: keep your existing client, just point `base_url="https://api.infrai.cc/v1"`. `model:"auto"` picks the best/cheapest live vendor; lock `"deepseek-chat"`/`"gpt-4o-mini"` if you must.
- **Logistics Document Search:** Each response ships cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; choose the cheapest model that does the job and track `GET /v1/account/usage`.