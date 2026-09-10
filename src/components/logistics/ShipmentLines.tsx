"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveShipmentLines } from "@/lib/logistics/line-actions";
import type { ShipmentLineInput } from "@/lib/logistics/lines";

type ProductOption = { id: string; product_id: string | null; description: string; quantity: number; unit: string };
export function ShipmentLines({ shipmentId, initial, products, readOnly }: { shipmentId: string; initial: ShipmentLineInput[]; products: ProductOption[]; readOnly: boolean }) {
  const [lines, setLines] = useState(initial);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const update = (index: number, patch: Partial<ShipmentLineInput>) => setLines(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  return <section className="space-y-3 rounded-lg border border-border p-4">
    <h2 className="font-semibold">Shipment products</h2>
    <p className="text-sm text-muted-foreground">Actual quantities for this shipment. Contract quantities remain unchanged.</p>
    {lines.map((line, index) => <div key={index} className="grid gap-2 border-b border-border pb-3 sm:grid-cols-3">
      <label className="text-sm">Contract product<select disabled={readOnly} value={line.contract_product_id ?? ""} onChange={e => { const p = products.find(p => p.id === e.target.value); update(index, p ? { contract_product_id: p.id, product_id: p.product_id, description: p.description, unit: p.unit } : { contract_product_id: null, product_id: null }); }} className="w-full rounded border border-border bg-background p-2"><option value="">Independent description</option>{products.map(p => <option key={p.id} value={p.id}>{p.description}</option>)}</select></label>
      <label className="text-sm">Description<input disabled={readOnly} value={line.description} onChange={e => update(index, { description: e.target.value })} className="w-full rounded border border-border bg-background p-2" /></label>
      <label className="text-sm">Quantity<input disabled={readOnly} type="number" min="0.000001" step="any" value={line.quantity} onChange={e => update(index, { quantity: Number(e.target.value) })} className="w-full rounded border border-border bg-background p-2" /></label>
      <label className="text-sm">Unit<input disabled={readOnly} value={line.unit} onChange={e => update(index, { unit: e.target.value })} className="w-full rounded border border-border bg-background p-2" /></label>
      <label className="text-sm">Net weight<input disabled={readOnly} type="number" min="0" step="any" value={line.net_weight ?? ""} onChange={e => update(index, { net_weight: e.target.value === "" ? null : Number(e.target.value) })} className="w-full rounded border border-border bg-background p-2" /></label>
      <label className="text-sm">Gross weight<input disabled={readOnly} type="number" min="0" step="any" value={line.gross_weight ?? ""} onChange={e => update(index, { gross_weight: e.target.value === "" ? null : Number(e.target.value) })} className="w-full rounded border border-border bg-background p-2" /></label>
      {!readOnly && <button type="button" onClick={() => setLines(rows => rows.filter((_, i) => i !== index))} className="text-sm underline">Remove line</button>}
    </div>)}
    {!readOnly && <div className="flex gap-3"><button type="button" onClick={() => setLines(rows => [...rows, { description: "", quantity: 1, unit: "MT" }])} className="rounded border border-border px-3 py-2 text-sm">Add product</button><button disabled={saving} type="button" onClick={async () => { setSaving(true); const result = await saveShipmentLines(shipmentId, lines); setMessage(result.success ? "Shipment products saved." : result.error ?? "Unable to save."); setSaving(false); if (result.success) router.refresh(); }} className="rounded border border-border px-3 py-2 text-sm">{saving ? "Saving…" : "Save products"}</button></div>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
