import { selectSpecialists } from "./dispatcher";
import { isBacklogItemBlocked, scoreBacklogItem } from "./priority";
import { buildApprovalRequest } from "./reviewer";
import { buildExecutionPlan } from "./planner";
import type {
  ApprovalGateId,
  Assignment,
  BacklogItem,
  PriorityRank,
  SpecialistRole,
  SpecialistRoleId,
} from "./types";

export type DirectorTaskStatus =
  | "pending"
  | "running"
  | "blocked"
  | "completed"
  | "failed"
  | "approval_required";

export type EffortEstimate = "XS" | "S" | "M" | "L" | "XL";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type RetryPolicy = {
  maxAttempts: number;
  attempts: number;
  backoffLabel: string;
};

export type DirectorTask = {
  id: string;
  title: string;
  section: string;
  sourceBacklogId: string | null;
  sourceStatus: string;
  queueStatus: DirectorTaskStatus;
  priorityRank: PriorityRank;
  priorityScore: number;
  priorityLabel: string;
  dependsOn: string[];
  ownership: {
    primaryRoleId: SpecialistRoleId;
    primaryRoleName: string;
    consultRoleIds: SpecialistRoleId[];
  };
  assignment: Assignment;
  estimatedEffort: EffortEstimate;
  riskLevel: RiskLevel;
  retry: RetryPolicy;
  approvalGates: ApprovalGateId[];
  approvalRequired: boolean;
  blockReason: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastError: string | null;
  notes: string[];
};

export type TaskHistoryEvent = {
  at: string;
  taskId: string;
  fromStatus: DirectorTaskStatus | null;
  toStatus: DirectorTaskStatus;
  message: string;
};

let taskSeq = 0;

function nextTaskId(prefix = "dir"): string {
  taskSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${taskSeq}`;
}

export function estimateEffort(item: BacklogItem, rank: PriorityRank): EffortEstimate {
  const blob = `${item.section} ${item.title} ${item.status}`.toLowerCase();
  if (/policy|present pattern|priority principle/.test(blob)) return "XS";
  if (/mime|signed url|lint|lockfile|placeholder|stub/.test(blob)) return "S";
  if (/migration|column|crud|partial|stabiliz/.test(blob)) return "M";
  if (/auth|middleware|session|rls|business engine|reporting platform/.test(blob)) {
    return "L";
  }
  if (rank <= 1) return "L";
  if (rank >= 6) return "S";
  return "M";
}

export function estimateRisk(item: BacklogItem, rank: PriorityRank): RiskLevel {
  const blob = `${item.section} ${item.title} ${item.status}`.toLowerCase();
  if (/weaken|destructive|production|remote|anon execute|definer|xss|secret/.test(blob)) {
    return "critical";
  }
  if (/auth|rls|migration apply|openai|payment|finance/.test(blob) || rank === 0) {
    return "high";
  }
  if (rank <= 2 || /schema|rpc|upload/.test(blob)) return "medium";
  return "low";
}

export function defaultRetryPolicy(risk: RiskLevel): RetryPolicy {
  switch (risk) {
    case "critical":
      return { maxAttempts: 1, attempts: 0, backoffLabel: "none — human gate" };
    case "high":
      return { maxAttempts: 2, attempts: 0, backoffLabel: "manual retry after review" };
    case "medium":
      return { maxAttempts: 3, attempts: 0, backoffLabel: "retry up to 3 attempts" };
    default:
      return { maxAttempts: 3, attempts: 0, backoffLabel: "retry up to 3 attempts" };
  }
}

export function inferDependencies(
  item: BacklogItem,
  allItems: BacklogItem[]
): string[] {
  const blob = `${item.section} ${item.title} ${item.status}`.toLowerCase();
  const deps: string[] = [];

  const needsAuth =
    /blocked on auth|rls|anon|company-scoped|authenticated policies/.test(blob) ||
    (item.section === "Security" && /rls|anon|definer/.test(blob));

  if (needsAuth) {
    for (const other of allItems) {
      if (other.id === item.id) continue;
      if (
        other.section === "Authentication" &&
        /session-based role|middleware/.test(
          `${other.title} ${other.status}`.toLowerCase()
        )
      ) {
        deps.push(other.id);
      }
    }
  }

  if (/payments\.business_case_id|business_case_id column/.test(blob)) {
    // no soft deps — apply is human gated
  }

  return [...new Set(deps)];
}

/**
 * Build a queue task from a backlog item with automatic specialist assignment.
 */
export function createTaskFromBacklog(
  item: BacklogItem,
  roles: SpecialistRole[],
  allItems: BacklogItem[] = [item]
): DirectorTask {
  const ranked = scoreBacklogItem(item);
  const assignment = selectSpecialists(item, roles);
  const { blocked, reason } = isBacklogItemBlocked(item);
  const plan = buildExecutionPlan(ranked, roles);
  const approval = buildApprovalRequest(ranked, plan);
  const riskLevel = estimateRisk(item, ranked.rank);
  const now = new Date().toISOString();

  let queueStatus: DirectorTaskStatus = "pending";
  if (blocked) queueStatus = "blocked";
  else if (approval.required && !approval.mayProceedWithoutApproval) {
    queueStatus = "approval_required";
  }

  return {
    id: nextTaskId("task"),
    title: item.title,
    section: item.section,
    sourceBacklogId: item.id,
    sourceStatus: item.status,
    queueStatus,
    priorityRank: ranked.rank,
    priorityScore: ranked.score,
    priorityLabel: ranked.rankLabel,
    dependsOn: inferDependencies(item, allItems),
    ownership: {
      primaryRoleId: assignment.primary.id,
      primaryRoleName: assignment.primary.name,
      consultRoleIds: assignment.consult.map((role) => role.id),
    },
    assignment,
    estimatedEffort: estimateEffort(item, ranked.rank),
    riskLevel,
    retry: defaultRetryPolicy(riskLevel),
    approvalGates: approval.gates,
    approvalRequired: approval.required && !approval.mayProceedWithoutApproval,
    blockReason: reason,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
    lastError: null,
    notes: [...ranked.reasons],
  };
}

/** Map backlog source ids in dependsOn to concrete task ids after enqueue. */
export function remapDependencies(
  tasks: DirectorTask[],
  backlogIdToTaskId: Map<string, string>
): DirectorTask[] {
  return tasks.map((task) => ({
    ...task,
    dependsOn: task.dependsOn
      .map((dep) => backlogIdToTaskId.get(dep) ?? dep)
      .filter((dep) => dep !== task.id),
  }));
}

export function compareTasksByPriority(a: DirectorTask, b: DirectorTask): number {
  if (a.priorityScore !== b.priorityScore) {
    return b.priorityScore - a.priorityScore;
  }
  if (a.priorityRank !== b.priorityRank) {
    return a.priorityRank - b.priorityRank;
  }
  return a.createdAt.localeCompare(b.createdAt);
}

export function resetTaskSequenceForTests(): void {
  taskSeq = 0;
}
