import type { ShipmentFormInput } from "@/lib/logistics/types";
import {
  hasText,
  validateShipmentOwnership,
  validateShipmentRouting,
  validateShipmentSchedule,
  validateShipmentSchedulePresence,
  validateShipmentStatusTransition,
} from "@/lib/logistics/validators";

export {
  canTransitionShipmentStatus,
  companiesMatch,
  duplicateBlError,
  duplicateContainerError,
  hasText,
  validateDateOrder,
  validateShipmentOwnership,
  validateShipmentRouting,
  validateShipmentSchedule,
  validateShipmentStatusTransition,
} from "@/lib/logistics/validators";

export function validateShipmentFormInput(
  input: ShipmentFormInput,
  options?: { previousStatus?: string | null }
): string | null {
  const ownershipError = validateShipmentOwnership(input);
  if (ownershipError) return ownershipError;

  const statusError = validateShipmentStatusTransition(
    options?.previousStatus,
    input.status
  );
  if (statusError) return statusError;

  const scheduleError = validateShipmentSchedule(input);
  if (scheduleError) return scheduleError;

  const routingError = validateShipmentRouting(input);
  if (routingError) return routingError;

  const schedulePresenceError = validateShipmentSchedulePresence(input);
  if (schedulePresenceError) return schedulePresenceError;

  const status = input.status.trim();
  const active = status !== "Planned";

  if (active) {
    if (!hasText(input.consignee)) {
      return "Consignee is required once a shipment leaves Planned.";
    }
    if (!hasText(input.notify_party)) {
      return "Notify party is required once a shipment leaves Planned.";
    }
  }

  if (status === "In Transit" || status === "Delivered") {
    if (!hasText(input.container) && !hasText(input.booking_number)) {
      return "Container number or booking number is required for In Transit / Delivered.";
    }
  }

  if (status === "Delivered") {
    if (!hasText(input.ata) && !hasText(input.eta_actual)) {
      return "Actual arrival (ATA) is required when status is Delivered.";
    }
  }

  if (hasText(input.bl_number) && input.bl_number!.trim().length < 3) {
    return "Bill of Lading number looks invalid.";
  }

  return null;
}
