import type {
  AdjustInventoryInput,
  IssueInventoryInput,
  ReceiveInventoryInput,
  TransferInventoryInput,
} from "@/lib/warehouse/types";

function requireId(value: string | null | undefined, label: string): string | null {
  if (!value?.trim()) {
    return `${label} is required.`;
  }
  return null;
}

function requirePositiveQuantity(quantity: number): string | null {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return "Quantity must be greater than zero.";
  }
  return null;
}

function requireNonZeroQuantity(quantity: number): string | null {
  if (!Number.isFinite(quantity) || quantity === 0) {
    return "Adjustment quantity cannot be zero.";
  }
  return null;
}

function requireLot(lotNumber: string): string | null {
  if (!lotNumber.trim()) {
    return "Lot number is required.";
  }
  return null;
}

export function validateReceiveInventoryInput(
  input: ReceiveInventoryInput
): string | null {
  return (
    requireId(input.warehouse_id, "Warehouse") ||
    requireId(input.product_id, "Product") ||
    requireLot(input.lot_number) ||
    requirePositiveQuantity(input.quantity)
  );
}

export function validateIssueInventoryInput(
  input: IssueInventoryInput
): string | null {
  return (
    requireId(input.warehouse_id, "Warehouse") ||
    requireId(input.product_id, "Product") ||
    requireLot(input.lot_number) ||
    requirePositiveQuantity(input.quantity)
  );
}

export function validateTransferInventoryInput(
  input: TransferInventoryInput
): string | null {
  if (input.from_location && input.to_location && input.from_location === input.to_location) {
    return "Source and destination warehouses must be different.";
  }

  return (
    requireId(input.from_location, "Source warehouse") ||
    requireId(input.to_location, "Destination warehouse") ||
    requireId(input.product_id, "Product") ||
    requireLot(input.lot_number) ||
    requirePositiveQuantity(input.quantity)
  );
}

export function validateAdjustInventoryInput(
  input: AdjustInventoryInput
): string | null {
  return (
    requireId(input.warehouse_id, "Warehouse") ||
    requireId(input.product_id, "Product") ||
    requireLot(input.lot_number) ||
    requireNonZeroQuantity(input.quantity)
  );
}
