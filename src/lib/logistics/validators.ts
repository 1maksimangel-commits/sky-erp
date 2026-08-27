import { SHIPMENT_STATUSES } from "./types";

export type ShipmentOwnershipInput = {
  company_id: string | null | undefined;
  contract_id: string | null | undefined;
  business_case_id: string | null | undefined;
};

export type ShipmentScheduleInput = {
  etd?: string | null;
  eta?: string | null;
  atd?: string | null;
  ata?: string | null;
  etd_actual?: string | null;
  eta_actual?: string | null;
};

export type ShipmentRoutingInput = {
  status: string;
  vessel?: string | null;
  voyage?: string | null;
  port_of_loading?: string | null;
  port_of_destination?: string | null;
};

const STATUS_SET = new Set<string>(SHIPMENT_STATUSES);

/** Allowed transitions. Delivered is terminal. */
export const SHIPMENT_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  Planned: ["Planned", "In Transit", "Delayed"],
  "In Transit": ["In Transit", "Delivered", "Delayed"],
  Delayed: ["Delayed", "In Transit", "Delivered", "Planned"],
  Delivered: ["Delivered"],
};

export function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export function validateDateOrder(
  earlier: string | null | undefined,
  later: string | null | undefined,
  earlierLabel: string,
  laterLabel: string
): string | null {
  if (!earlier || !later) return null;
  if (earlier > later) {
    return `${earlierLabel} cannot be after ${laterLabel}.`;
  }
  return null;
}

export function validateShipmentOwnership(
  input: ShipmentOwnershipInput
): string | null {
  if (!input.contract_id?.trim()) {
    return "Contract is required.";
  }
  if (!input.business_case_id?.trim()) {
    return "Business case is required for every shipment.";
  }
  if (!input.company_id?.trim()) {
    return "Company is required. Set company on the linked contract.";
  }
  return null;
}

export function isKnownShipmentStatus(status: string): boolean {
  return STATUS_SET.has(status.trim());
}

export function canTransitionShipmentStatus(
  fromStatus: string | null | undefined,
  toStatus: string
): boolean {
  const from = (fromStatus ?? "Planned").trim();
  const to = toStatus.trim();
  if (!STATUS_SET.has(to)) return false;
  if (!STATUS_SET.has(from)) return true;
  const allowed = SHIPMENT_STATUS_TRANSITIONS[from] ?? SHIPMENT_STATUSES;
  return allowed.includes(to);
}

export function validateShipmentStatusTransition(
  fromStatus: string | null | undefined,
  toStatus: string
): string | null {
  const status = toStatus.trim();
  if (!status) return "Status is required.";
  if (!isKnownShipmentStatus(status)) {
    return "Invalid shipment status.";
  }
  if (
    fromStatus != null &&
    !canTransitionShipmentStatus(fromStatus, status)
  ) {
    return `Invalid status transition: ${fromStatus} → ${status}.`;
  }
  return null;
}

export function validateShipmentSchedule(
  input: ShipmentScheduleInput
): string | null {
  return (
    validateDateOrder(input.etd, input.eta, "ETD", "ETA") ||
    validateDateOrder(input.atd, input.ata, "ATD", "ATA") ||
    validateDateOrder(
      input.etd_actual ?? input.atd,
      input.eta_actual ?? input.ata,
      "Actual departure",
      "Actual arrival"
    )
  );
}

/** Vessel, voyage, and ports required once shipment leaves Planned. */
export function validateShipmentRouting(
  input: ShipmentRoutingInput
): string | null {
  const status = input.status.trim();
  if (status === "Planned") {
    return null;
  }

  if (!hasText(input.vessel)) {
    return "Vessel is required once a shipment leaves Planned.";
  }
  if (!hasText(input.voyage)) {
    return "Voyage is required once a shipment leaves Planned.";
  }
  if (!hasText(input.port_of_loading)) {
    return "Port of loading is required once a shipment leaves Planned.";
  }
  if (!hasText(input.port_of_destination)) {
    return "Port of destination is required once a shipment leaves Planned.";
  }
  return null;
}

export function validateShipmentSchedulePresence(
  input: ShipmentScheduleInput & { status: string }
): string | null {
  if (input.status.trim() === "Planned") {
    return null;
  }
  if (!hasText(input.etd)) {
    return "ETD is required once a shipment leaves Planned.";
  }
  if (!hasText(input.eta)) {
    return "ETA is required once a shipment leaves Planned.";
  }
  return null;
}

export function duplicateBlError(blNumber: string): string {
  return `Bill of Lading number ${blNumber} is already used.`;
}

export function duplicateContainerError(container: string): string {
  return `Container number ${container} is already used on an active shipment.`;
}

export function companiesMatch(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const a = left?.trim();
  const b = right?.trim();
  if (!a || !b) return true;
  return a === b;
}
