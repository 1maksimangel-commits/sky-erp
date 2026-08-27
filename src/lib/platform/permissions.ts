import type { RoleCode } from "@/lib/platform/types";

export type Permission =
  | "*"
  | `${string}.*`
  | `${string}.read`
  | `${string}.write`
  | string;

const ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  admin: ["*"],
  finance: [
    "finance.*",
    "documents.read",
    "documents.write",
    "contracts.read",
    "business_cases.read",
  ],
  sales: [
    "business_cases.*",
    "contracts.*",
    "counterparties.*",
    "products.read",
    "documents.*",
  ],
  logistics: ["logistics.*", "contracts.read", "warehouse.read", "documents.*"],
  warehouse: [
    "warehouse.*",
    "products.read",
    "logistics.read",
    "documents.read",
    "documents.write",
  ],
  management: ["*.read", "dashboard.*", "reports.*", "documents.read"],
  readonly: ["*.read"],
};

/** Current session role — defaults to admin until auth is wired. */
export function getCurrentRole(): RoleCode {
  return "admin";
}

export function getRolePermissions(role: RoleCode = getCurrentRole()): Permission[] {
  return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.readonly;
}

export function can(
  permission: string,
  role: RoleCode = getCurrentRole()
): boolean {
  const grants = getRolePermissions(role);
  if (grants.includes("*")) {
    return true;
  }

  if (grants.includes(permission)) {
    return true;
  }

  const [domain, action = "read"] = permission.split(".");
  if (grants.includes(`${domain}.*`)) {
    return true;
  }

  if (action === "read" && grants.includes("*.read")) {
    return true;
  }

  return false;
}

export function assertCan(permission: string): string | null {
  if (!can(permission)) {
    return `Permission denied for ${permission}.`;
  }
  return null;
}
