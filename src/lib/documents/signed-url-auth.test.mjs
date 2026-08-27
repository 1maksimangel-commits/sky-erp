import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Mirror of pure helpers from signed-url-auth.ts / company-scope.ts.
 * Plain ESM for Node's built-in test runner (no bundler).
 */

function assertCompanyAccessWith(activeCompanyId, recordCompanyId) {
  const active = activeCompanyId?.trim() || null;
  if (!active) {
    return null;
  }
  if (!recordCompanyId?.trim()) {
    return "Record has no company ownership.";
  }
  if (recordCompanyId.trim() !== active) {
    return "Access denied for this company.";
  }
  return null;
}

function isValidStorageObjectPath(filePath) {
  const path = filePath?.trim() ?? "";
  if (!path) return false;
  if (path.includes("..")) return false;
  if (path.startsWith("/") || path.startsWith("\\")) return false;
  if (path.includes("\0")) return false;
  return true;
}

function authorizeStoragePathOwnership(activeCompanyId, recordCompanyId) {
  return assertCompanyAccessWith(activeCompanyId, recordCompanyId);
}

function filterOwnedDocumentsForSigning(documents, activeCompanyId) {
  return documents.filter(
    (doc) =>
      authorizeStoragePathOwnership(activeCompanyId, doc.company_id) === null
  );
}

describe("isValidStorageObjectPath", () => {
  it("accepts relative object keys", () => {
    assert.equal(isValidStorageObjectPath("crm/abc/file.pdf"), true);
    assert.equal(isValidStorageObjectPath("contracts/x/y.docx"), true);
  });

  it("rejects traversal and absolute paths", () => {
    assert.equal(isValidStorageObjectPath("../secret"), false);
    assert.equal(isValidStorageObjectPath("/etc/passwd"), false);
    assert.equal(isValidStorageObjectPath("\\windows\\path"), false);
    assert.equal(isValidStorageObjectPath("a/../b"), false);
    assert.equal(isValidStorageObjectPath(""), false);
    assert.equal(isValidStorageObjectPath("has\0null"), false);
  });
});

describe("authorizeStoragePathOwnership", () => {
  it("allows when no active company (pre-auth unrestricted)", () => {
    assert.equal(authorizeStoragePathOwnership(null, null), null);
    assert.equal(authorizeStoragePathOwnership(null, "co-1"), null);
    assert.equal(authorizeStoragePathOwnership("", "co-1"), null);
  });

  it("denies missing ownership when company scoped", () => {
    assert.equal(
      authorizeStoragePathOwnership("co-1", null),
      "Record has no company ownership."
    );
    assert.equal(
      authorizeStoragePathOwnership("co-1", "  "),
      "Record has no company ownership."
    );
  });

  it("denies cross-company access", () => {
    assert.equal(
      authorizeStoragePathOwnership("co-1", "co-2"),
      "Access denied for this company."
    );
  });

  it("allows matching company", () => {
    assert.equal(authorizeStoragePathOwnership("co-1", "co-1"), null);
  });
});

describe("filterOwnedDocumentsForSigning", () => {
  const docs = [
    { id: "a", company_id: "co-1" },
    { id: "b", company_id: "co-2" },
    { id: "c", company_id: null },
  ];

  it("passes all when unrestricted", () => {
    assert.deepEqual(
      filterOwnedDocumentsForSigning(docs, null).map((d) => d.id),
      ["a", "b", "c"]
    );
  });

  it("keeps only matching company when scoped", () => {
    assert.deepEqual(
      filterOwnedDocumentsForSigning(docs, "co-1").map((d) => d.id),
      ["a"]
    );
  });
});
