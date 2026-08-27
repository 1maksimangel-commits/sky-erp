import type {
  Assignment,
  ApprovalGateId,
  ExecutionPlan,
  PriorityRank,
  SpecialistRole,
  SpecialistRoleId,
} from "@/lib/ai/director/types";
import type { RiskLevel } from "@/lib/ai/director/task";
import type { RuntimeStatus, SkyRuntimeApi } from "@/lib/ai/runtime/types";

/**
 * Executive Director task — work item received for analysis only.
 * Distinct from the queue model in `task.ts` (`Queued` DirectorTask).
 */
export type DirectorTask = {
  id: string;
  title: string;
  description: string;
  section: string;
  status: string;
  sourcePath: string;
  tags: string[];
};

/** Priority assessment produced by the Director (never mutates the repo). */
export type DirectorPriority = {
  rank: PriorityRank;
  label: string;
  score: number;
  reasons: string[];
  blocked: boolean;
  blockReason: string | null;
};

/** Risk assessment for approval gating. */
export type DirectorRisk = {
  level: RiskLevel;
  reasons: string[];
  approvalGates: ApprovalGateId[];
};

export type DirectorApprovalState =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected";

/** Human approval request / decision (Director never self-approves gated work). */
export type DirectorApproval = {
  required: boolean;
  state: DirectorApprovalState;
  gates: ApprovalGateId[];
  summary: string;
  questionsForHuman: string[];
  mayProceedWithoutApproval: boolean;
  decidedAt: string | null;
  decisionNote: string | null;
};

/** Project / runtime context used during analysis. */
export type DirectorContext = {
  repoRoot: string;
  runtimeStatus: RuntimeStatus;
  sprintTheme: string | null;
  roleCount: number;
  roles: SpecialistRole[];
  backlogItemCount: number;
  receivedAt: string;
};

export type DirectorDecisionStatus =
  | "received"
  | "analysed"
  | "planned"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "dispatched"
  | "blocked";

/** Specialist handoff package — instructions only; Director does not execute. */
export type DirectorDispatchBrief = {
  primaryRoleId: SpecialistRoleId;
  primaryRoleName: string;
  consultRoleIds: SpecialistRoleId[];
  objective: string;
  outOfScope: string[];
  steps: Array<{
    order: number;
    title: string;
    ownerRoleId: SpecialistRoleId;
    detail: string;
  }>;
  validationCommands: string[];
  forbiddenActions: string[];
  dispatchedAt: string;
};

/**
 * Final structured outcome of the Director for a single task.
 * Specialists / humans act on this; the Director never edits code.
 */
export type DirectorDecision = {
  decisionId: string;
  status: DirectorDecisionStatus;
  task: DirectorTask;
  context: DirectorContext;
  priority: DirectorPriority | null;
  risk: DirectorRisk | null;
  specialists: Assignment | null;
  plan: ExecutionPlan | null;
  approval: DirectorApproval;
  dispatchBrief: DirectorDispatchBrief | null;
  notes: string[];
  createdAt: string;
  updatedAt: string;
};

/** Public executive Director API. */
export interface DirectorApi {
  receiveTask(task: DirectorTask): Promise<DirectorDecision>;
  analyse(): Promise<DirectorDecision>;
  plan(): Promise<DirectorDecision>;
  approve(note?: string): Promise<DirectorDecision>;
  reject(reason: string): Promise<DirectorDecision>;
  dispatch(): Promise<DirectorDecision>;
  status(): DirectorDecision | null;
}

export type DirectorOptions = {
  runtime: SkyRuntimeApi;
};
