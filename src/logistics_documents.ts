import { z } from "zod";

export const logisticsDocumentSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string().min(1),
    shipmentId: z.string().min(1),
    kind: z.literal("shipment_event"),
    occurredAt: z.string().datetime(),
    status: z.string().min(1),
    location: z.string().min(1),
    notes: z.string().default("")
  }),
  z.object({
    id: z.string().min(1),
    shipmentId: z.string().min(1),
    kind: z.literal("proof_of_delivery"),
    occurredAt: z.string().datetime(),
    objectKey: z.string().min(1),
    recipient: z.string().min(1),
    notes: z.string().default("")
  }),
  z.object({
    id: z.string().min(1),
    shipmentId: z.string().min(1),
    kind: z.literal("exception"),
    occurredAt: z.string().datetime(),
    code: z.string().min(1),
    summary: z.string().min(1),
    resolved: z.boolean()
  })
]);

export const ingestBodySchema = z.object({ documents: z.array(logisticsDocumentSchema).min(1).max(100) });
export const searchBodySchema = z.object({ query: z.string().min(2), limit: z.number().int().min(1).max(20).default(5) });

export type LogisticsDocument = z.infer<typeof logisticsDocumentSchema>;
export type SearchBody = z.infer<typeof searchBodySchema>;

export function searchableText(document: LogisticsDocument): string {
  if (document.kind === "shipment_event") {
    return `${document.shipmentId} shipment event ${document.status} ${document.location} ${document.notes}`;
  }
  if (document.kind === "proof_of_delivery") {
    return `${document.shipmentId} proof of delivery recipient ${document.recipient} ${document.notes}`;
  }
  return `${document.shipmentId} exception ${document.code} ${document.summary} ${document.resolved ? "resolved" : "unresolved"}`;
}

export function needsEscalation(document: LogisticsDocument): boolean {
  return document.kind === "exception" && !document.resolved;
}
