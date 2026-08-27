import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Mirror of pure helpers from validators.ts / company-scope.ts.
 * Kept as plain ESM so Node's built-in test runner works without a bundler
 * or dependency install. Keep in sync when changing production validators.
 */

const SHIPMENT_STATUSES = ["Planned", "In Transit", "Delivered", "Delayed"];
const STATUS_SET = new Set(SHIPMENT_STATUSES);
const SHIPMENT_STATUS_TRANSITIONS = {
  Planned: ["Planned", "In Transit", "Delayed"],
  "In Transit": ["In Transit", "Delivered", "Delayed"],
  Delayed: ["Delayed", "In Transit", "Delivered", "Planned"],
  Delivered: ["Delivered"],
};

function hasText(value) {
  return Boolean(value?.trim());
}

function validateDateOrder(earlier, later, earlierLabel, laterLabel) {
  if (!earlier || !later) return null;
  if (earlier > later) {
    return `${earlierLabel} cannot be after ${laterLabel}.`;
  }
  return null;
}

function validateShipmentOwnership(input) {
  if (!input.contract_id?.trim()) return "Contract is required.";
  if (!input.business_case_id?.trim()) {
    return "Business case is required for every shipment.";
  }
  if (!input.company_id?.trim()) {
    return "Company is required. Set company on the linked contract.";
  }
  return null;
}

function canTransitionShipmentStatus(fromStatus, toStatus) {
  const from = (fromStatus ?? "Planned").trim();
  const to = toStatus.trim();
  if (!STATUS_SET.has(to)) return false;
  if (!STATUS_SET.has(from)) return true;
  const allowed = SHIPMENT_STATUS_TRANSITIONS[from] ?? SHIPMENT_STATUSES;
  return allowed.includes(to);
}

function validateShipmentStatusTransition(fromStatus, toStatus) {
  const status = toStatus.trim();
  if (!status) return "Status is required.";
  if (!STATUS_SET.has(status)) return "Invalid shipment status.";
  if (fromStatus != null && !canTransitionShipmentStatus(fromStatus, status)) {
    return `Invalid status transition: ${fromStatus} → ${status}.`;
  }
  return null;
}

function validateShipmentSchedule(input) {
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

function validateShipmentRouting(input) {
  if (input.status.trim() === "Planned") return null;
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

function assertCompanyAccessWith(activeCompanyId, recordCompanyId) {
  const active = activeCompanyId?.trim() || null;
  if (!active) return null;
  if (!recordCompanyId?.trim()) return "Record has no company ownership.";
  if (recordCompanyId.trim() !== active) {
    return "Access denied for this company.";
  }
  return null;
}

function resolveWritableCompanyIdWith(activeCompanyId, requestedCompanyId) {
  const active = activeCompanyId?.trim() || null;
  const requested = requestedCompanyId?.trim() || null;
  if (active) {
    if (requested && requested !== active) {
      return { ok: false, error: "Cannot write data for another company." };
    }
    return { ok: true, companyId: active };
  }
  return { ok: true, companyId: requested };
}

describe("logistics validators", () => {
  it("requires company, contract, and business case", () => {
    assert.equal(
      validateShipmentOwnership({
        company_id: null,
        contract_id: "c1",
        business_case_id: "b1",
      }),
      "Company is required. Set company on the linked contract."
    );
    assert.equal(
      validateShipmentOwnership({
        company_id: "co1",
        contract_id: "c1",
        business_case_id: "b1",
      }),
      null
    );
  });

  it("rejects invalid ETD/ETA ordering", () => {
    assert.equal(
      validateShipmentSchedule({ etd: "2026-08-10", eta: "2026-08-01" }),
      "ETD cannot be after ETA."
    );
  });

  it("enforces vessel, voyage, and ports outside Planned", () => {
    assert.match(
      validateShipmentRouting({
        status: "In Transit",
        vessel: null,
        voyage: "V1",
        port_of_loading: "SHA",
        port_of_destination: "RTM",
      }),
      /Vessel/
    );
    assert.match(
      validateShipmentRouting({
        status: "In Transit",
        vessel: "MSC",
        voyage: null,
        port_of_loading: "SHA",
        port_of_destination: "RTM",
      }),
      /Voyage/
    );
    assert.match(
      validateShipmentRouting({
        status: "In Transit",
        vessel: "MSC",
        voyage: "V1",
        port_of_loading: null,
        port_of_destination: "RTM",
      }),
      /Port of loading/
    );
  });

  it("blocks invalid shipment status transitions", () => {
    assert.equal(canTransitionShipmentStatus("Delivered", "In Transit"), false);
    assert.match(
      validateShipmentStatusTransition("Delivered", "In Transit"),
      /Invalid status transition/
    );
    assert.equal(validateShipmentStatusTransition("Planned", "In Transit"), null);
  });
});

describe("company scope helpers", () => {
  it("denies cross-company access when active company is set", () => {
    assert.equal(assertCompanyAccessWith(null, "company-b"), null);
    assert.equal(assertCompanyAccessWith("company-a", "company-a"), null);
    assert.equal(
      assertCompanyAccessWith("company-a", "company-b"),
      "Access denied for this company."
    );
  });

  it("binds writes to the active company", () => {
    assert.deepEqual(resolveWritableCompanyIdWith("company-a", null), {
      ok: true,
      companyId: "company-a",
    });
    assert.deepEqual(resolveWritableCompanyIdWith("company-a", "company-b"), {
      ok: false,
      error: "Cannot write data for another company.",
    });
  });
});
