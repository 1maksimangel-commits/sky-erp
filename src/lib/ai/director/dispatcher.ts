import type {
  Assignment,
  BacklogItem,
  SpecialistRole,
  SpecialistRoleId,
} from "./types";

function requireRole(
  roles: SpecialistRole[],
  id: SpecialistRoleId
): SpecialistRole {
  const found = roles.find((role) => role.id === id);
  if (!found) {
    throw new Error(`AI Director: missing specialist role ${id}`);
  }
  return found;
}

function consult(
  roles: SpecialistRole[],
  ids: SpecialistRoleId[]
): SpecialistRole[] {
  return ids.map((id) => requireRole(roles, id));
}

/**
 * Map a backlog item to primary + consult specialists (AI_DIRECTOR assignment rules).
 */
export function selectSpecialists(
  item: BacklogItem,
  roles: SpecialistRole[]
): Assignment {
  const blob = `${item.section} ${item.title} ${item.status}`.toLowerCase();

  if (
    /rls|auth|middleware|session|signed url|xss|anon|definer|secret|mime/.test(
      blob
    ) ||
    item.section === "Security" ||
    item.section === "Authentication"
  ) {
    return {
      primary: requireRole(roles, "06_SECURITY_ENGINEER"),
      consult: consult(roles, [
        "00_CHIEF_ARCHITECT",
        "02_SOLUTION_ARCHITECT",
        "03_BACKEND_ENGINEER",
      ]),
      rationale:
        "Security / authentication surface — Security Engineer leads; Architect + Backend consult.",
    };
  }

  if (
    item.section === "Database" ||
    /migration|schema|column|index|fk/.test(blob)
  ) {
    return {
      primary: requireRole(roles, "05_DATABASE_ENGINEER"),
      consult: consult(roles, ["06_SECURITY_ENGINEER", "02_SOLUTION_ARCHITECT"]),
      rationale:
        "Schema / migration work — Database Engineer leads; Security if RLS-related.",
    };
  }

  if (item.section === "DevOps" || /lockfile|ci|pnpm|lint/.test(blob)) {
    return {
      primary: requireRole(roles, "08_DEVOPS_ENGINEER"),
      consult: consult(roles, ["07_QA_ENGINEER"]),
      rationale: "Tooling / CI / lockfile — DevOps leads; QA for verification gates.",
    };
  }

  if (item.section === "Documentation" || /knowledge|docs|documentation/.test(blob)) {
    return {
      primary: requireRole(roles, "10_DOCUMENTATION_ENGINEER"),
      consult: consult(roles, ["00_CHIEF_ARCHITECT"]),
      rationale: "Documentation — Documentation Engineer leads.",
    };
  }

  if (item.section === "AI" || /openai|prompt|assistant|pdf import/.test(blob)) {
    return {
      primary: requireRole(roles, "09_AI_ENGINEER"),
      consult: consult(roles, [
        "06_SECURITY_ENGINEER",
        "03_BACKEND_ENGINEER",
        "07_QA_ENGINEER",
      ]),
      rationale: "AI / OpenAI import — AI Engineer leads; Security + Backend + QA consult.",
    };
  }

  if (item.section === "CRM" || /xss|attachment|ui|frontend/.test(blob)) {
    if (/xss|mime|upload/.test(blob)) {
      return {
        primary: requireRole(roles, "04_FRONTEND_ENGINEER"),
        consult: consult(roles, ["06_SECURITY_ENGINEER", "07_QA_ENGINEER"]),
        rationale: "CRM / UI security surface — Frontend + Security.",
      };
    }
  }

  if (
    ["Finance", "Logistics", "Warehouse", "Contracts", "Documents"].includes(
      item.section
    ) ||
    /server action|rpc|crud|stabiliz/.test(blob)
  ) {
    return {
      primary: requireRole(roles, "03_BACKEND_ENGINEER"),
      consult: consult(roles, [
        "02_SOLUTION_ARCHITECT",
        "04_FRONTEND_ENGINEER",
        "07_QA_ENGINEER",
        "06_SECURITY_ENGINEER",
      ]),
      rationale:
        "Domain module work — Backend leads; Architect, Frontend, QA, Security as needed.",
    };
  }

  if (item.section === "Reports") {
    return {
      primary: requireRole(roles, "04_FRONTEND_ENGINEER"),
      consult: consult(roles, ["03_BACKEND_ENGINEER", "02_SOLUTION_ARCHITECT"]),
      rationale: "Reporting UI — Frontend leads with Backend support.",
    };
  }

  return {
    primary: requireRole(roles, "02_SOLUTION_ARCHITECT"),
    consult: consult(roles, ["01_PRODUCT_OWNER", "00_CHIEF_ARCHITECT"]),
    rationale:
      "Unclassified item — Solution Architect plans; Product Owner clarifies scope.",
  };
}
