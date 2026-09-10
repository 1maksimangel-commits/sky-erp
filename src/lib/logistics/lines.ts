import { z } from "zod";

export const shipmentLineSchema = z.object({
  contract_product_id: z.string().uuid().nullable().optional(),
  product_id: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1, "Product description is required."),
  quantity: z.number().finite().positive(),
  unit: z.string().trim().min(1),
  net_weight: z.number().finite().nonnegative().nullable().optional(),
  gross_weight: z.number().finite().nonnegative().nullable().optional(),
  origin: z.string().nullable().optional(),
  packing: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
}).refine(v => v.gross_weight == null || v.net_weight == null || v.gross_weight >= v.net_weight, "Gross weight must be at least net weight.");
export type ShipmentLineInput = z.infer<typeof shipmentLineSchema>;
export type ShipmentLine = ShipmentLineInput & { id: string; shipment_id: string; company_id: string };
