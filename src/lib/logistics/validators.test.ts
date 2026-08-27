/**
 * Type-checked companion assertions for logistics validators.
 * Runtime suite: `node --test src/lib/logistics/validators.test.mjs`
 *
 * This file is excluded from the Next/tsc project include via tsconfig exclude
 * when needed; keep imports extension-free for the workspace compiler.
 */
import {
  assertCompanyAccessWith,
  resolveWritableCompanyIdWith,
} from "../platform/company-scope";
import {
  canTransitionShipmentStatus,
  validateShipmentOwnership,
  validateShipmentRouting,
  validateShipmentSchedule,
  validateShipmentStatusTransition,
} from "./validators";

type Case = { name: string; pass: boolean };

function run(): Case[] {
  return [
    {
      name: "ownership requires company",
      pass:
        validateShipmentOwnership({
          company_id: null,
          contract_id: "c1",
          business_case_id: "b1",
        }) === "Company is required. Set company on the linked contract.",
    },
    {
      name: "etd/eta order",
      pass:
        validateShipmentSchedule({ etd: "2026-08-10", eta: "2026-08-01" }) ===
        "ETD cannot be after ETA.",
    },
    {
      name: "vessel required",
      pass: Boolean(
        validateShipmentRouting({
          status: "In Transit",
          vessel: null,
          voyage: "V1",
          port_of_loading: "SHA",
          port_of_destination: "RTM",
        })?.includes("Vessel")
      ),
    },
    {
      name: "delivered is terminal",
      pass: canTransitionShipmentStatus("Delivered", "In Transit") === false,
    },
    {
      name: "status transition message",
      pass: Boolean(
        validateShipmentStatusTransition(
          "Delivered",
          "In Transit"
        )?.includes("Invalid status transition")
      ),
    },
    {
      name: "company access deny",
      pass:
        assertCompanyAccessWith("company-a", "company-b") ===
        "Access denied for this company.",
    },
    {
      name: "writable company bind",
      pass:
        resolveWritableCompanyIdWith("company-a", "company-b").ok === false,
    },
  ];
}

export function logisticsValidatorSelfCheck(): { ok: boolean; failed: string[] } {
  const failed = run()
    .filter((item) => !item.pass)
    .map((item) => item.name);
  return { ok: failed.length === 0, failed };
}
