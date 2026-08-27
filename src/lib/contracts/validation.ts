import type { ContractFormInput } from "@/lib/contracts/form-types";

export function validateContractFormInput(
  input: ContractFormInput
): string | null {
  if (!input.contract_number.trim()) {
    return "Contract number is required.";
  }

  if (!input.company_id?.trim()) {
    return "Company is required.";
  }

  if (!input.buyer_id?.trim()) {
    return "Buyer is required.";
  }

  if (!input.supplier_id?.trim()) {
    return "Supplier is required.";
  }

  if (!input.status.trim()) {
    return "Status is required.";
  }

  if (input.amount != null && input.amount < 0) {
    return "Amount must be zero or greater.";
  }

  if (input.buyer_id.trim() === input.supplier_id.trim()) {
    return "Buyer and supplier cannot be the same counterparty.";
  }

  return null;
}
