export type ShipmentFormInput = {
  contract_id: string;
  business_case_id: string | null;
  company_id: string | null;
  container: string | null;
  container_type: string | null;
  seal_number: string | null;
  bl_number: string | null;
  vessel: string | null;
  voyage: string | null;
  shipping_line: string | null;
  booking_number: string | null;
  tracking_number: string | null;
  freight_forwarder: string | null;
  port_of_loading: string | null;
  port_of_destination: string | null;
  consignee: string | null;
  notify_party: string | null;
  etd: string | null;
  eta: string | null;
  etd_actual: string | null;
  eta_actual: string | null;
  atd: string | null;
  ata: string | null;
  status: string;
  remarks: string | null;
};

export const SHIPMENT_STATUSES = [
  "Planned",
  "In Transit",
  "Delivered",
  "Delayed",
] as const;

export const emptyShipmentForm = (): ShipmentFormInput => ({
  contract_id: "",
  business_case_id: null,
  company_id: null,
  container: null,
  container_type: null,
  seal_number: null,
  bl_number: null,
  vessel: null,
  voyage: null,
  shipping_line: null,
  booking_number: null,
  tracking_number: null,
  freight_forwarder: null,
  port_of_loading: null,
  port_of_destination: null,
  consignee: null,
  notify_party: null,
  etd: null,
  eta: null,
  etd_actual: null,
  eta_actual: null,
  atd: null,
  ata: null,
  status: "Planned",
  remarks: null,
});

export function shipmentToFormInput(shipment: {
  contract_id: string;
  business_case_id: string | null;
  company_id?: string | null;
  container: string | null;
  container_type: string | null;
  seal_number: string | null;
  bl_number?: string | null;
  vessel: string | null;
  voyage: string | null;
  shipping_line: string | null;
  booking_number: string | null;
  tracking_number: string | null;
  freight_forwarder: string | null;
  port_of_loading: string | null;
  port_of_destination: string | null;
  consignee?: string | null;
  notify_party?: string | null;
  etd: string | null;
  eta: string | null;
  etd_actual: string | null;
  eta_actual: string | null;
  atd: string | null;
  ata: string | null;
  status: string | null;
  remarks: string | null;
}): ShipmentFormInput {
  return {
    contract_id: shipment.contract_id,
    business_case_id: shipment.business_case_id,
    company_id: shipment.company_id ?? null,
    container: shipment.container,
    container_type: shipment.container_type,
    seal_number: shipment.seal_number,
    bl_number: shipment.bl_number ?? null,
    vessel: shipment.vessel,
    voyage: shipment.voyage,
    shipping_line: shipment.shipping_line,
    booking_number: shipment.booking_number,
    tracking_number: shipment.tracking_number,
    freight_forwarder: shipment.freight_forwarder,
    port_of_loading: shipment.port_of_loading,
    port_of_destination: shipment.port_of_destination,
    consignee: shipment.consignee ?? null,
    notify_party: shipment.notify_party ?? null,
    etd: shipment.etd,
    eta: shipment.eta,
    etd_actual: shipment.etd_actual,
    eta_actual: shipment.eta_actual,
    atd: shipment.atd,
    ata: shipment.ata,
    status: shipment.status ?? "Planned",
    remarks: shipment.remarks,
  };
}

export type TimelineEventFormInput = {
  title: string;
  description: string | null;
  event_date: string | null;
};

/** Logistics document types expected on a shipment workspace. */
export const SHIPMENT_DOCUMENT_TYPES = [
  "packing_list",
  "commercial_invoice",
  "bill_of_lading",
  "certificate_of_origin",
  "veterinary_certificate",
] as const;
