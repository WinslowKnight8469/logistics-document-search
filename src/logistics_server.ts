import express, { type ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { InfraiEmbedder } from "./infrai_embeddings.js";
import { ingestBodySchema, searchBodySchema } from "./logistics_documents.js";
import { LogisticsSearch } from "./logistics_search.js";

const server = express();
const search = new LogisticsSearch(new InfraiEmbedder());
server.use(express.json({ limit: "256kb" }));

server.post("/documents", async (request, response) => {
  const body = ingestBodySchema.parse(request.body);
  const indexed = await search.ingest(body.documents);
  response.status(201).json({ indexed });
});

server.post("/search", async (request, response) => {
  const body = searchBodySchema.parse(request.body);
  response.json({ hits: await search.search(body.query, body.limit) });
});

const errors: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({ error: "invalid_request", issues: error.issues });
    return;
  }
  console.error(error);
  response.status(502).json({ error: "embedding_request_failed" });
};
server.use(errors);

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`logistics search listening on http://localhost:${port}`));
