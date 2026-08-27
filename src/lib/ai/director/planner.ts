import { selectSpecialists } from "./dispatcher";
import type {
  ExecutionPlan,
  PlanStep,
  RankedTask,
  SpecialistRole,
} from "./types";

const FORBIDDEN = [
  "commit",
  "push",
  "apply migrations",
  "access production",
  "modify .env / print secrets",
  "bypass AGENTS.md",
  "call remote services from Director runtime",
  "execute shell commands from Director runtime",
];

export function buildExecutionPlan(
  task: RankedTask,
  roles: SpecialistRole[]
): ExecutionPlan {
  const assignment = selectSpecialists(task.item, roles);
  const section = task.item.section;

  const steps: PlanStep[] = [
    {
      order: 1,
      title: "Product clarification",
      ownerRoleId: "01_PRODUCT_OWNER",
      detail: `Write acceptance criteria for: ${task.item.title}. Mark out-of-scope explicitly.`,
    },
    {
      order: 2,
      title: "Architecture / risk",
      ownerRoleId: "02_SOLUTION_ARCHITECT",
      detail: `Plan module impact for ${section}. Note auth/RLS/migration blockers. No schema invention.`,
    },
    {
      order: 3,
      title: "Specialist implementation",
      ownerRoleId: assignment.primary.id,
      detail: `${assignment.primary.name} executes within role file boundaries. Consult: ${assignment.consult.map((r) => r.name).join(", ") || "none"}.`,
    },
    {
      order: 4,
      title: "Security review (if sensitive)",
      ownerRoleId: "06_SECURITY_ENGINEER",
      detail:
        "Required when touching auth, RLS, uploads, signed URLs, DEFINER grants, or XSS surfaces.",
    },
    {
      order: 5,
      title: "QA verification",
      ownerRoleId: "07_QA_ENGINEER",
      detail:
        "Run allowed local gates from the brief; report pass/fail honestly. Do not mark remote-unapplied work complete.",
    },
    {
      order: 6,
      title: "Human approval gates",
      ownerRoleId: "00_CHIEF_ARCHITECT",
      detail:
        "Stop for human Yes on commit, push, migration apply, auth/RLS, dependencies, production.",
    },
  ];

  const outOfScope = [
    "Remote Supabase apply",
    "Git commit / push",
    "Production access",
    "Dependency install/remove without approval",
    "Weakening security controls",
  ];

  if (task.blocked) {
    outOfScope.push(`Unblocking without resolving: ${task.blockReason}`);
  }

  return {
    task,
    assignment,
    objective: `Advance backlog item [${section}] ${task.item.title} (${task.rankLabel}). Status: ${task.item.status}.`,
    outOfScope,
    steps,
    validationCommands: [
      "pnpm exec tsc --noEmit",
      "pnpm build",
      "git diff --check",
    ],
    forbiddenActions: FORBIDDEN,
  };
}
