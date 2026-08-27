/**
 * AI Director — executive manager of the AI Engineering Department.
 *
 * The Director DOES NOT execute code, edit files, run shell, access Supabase,
 * call OpenAI, or run business logic. It analyses tasks and returns decisions.
 */

import type {
  DirectorApproval,
  DirectorApi,
  DirectorContext,
  DirectorDecision,
  DirectorDispatchBrief,
  DirectorOptions,
  DirectorPriority,
  DirectorRisk,
  DirectorTask,
} from "@/lib/ai/director/decision-types";
import {
  isBacklogItemBlocked,
  priorityRankLabel,
  scoreBacklogItem,
} from "@/lib/ai/director/priority";
import { buildApprovalRequest } from "@/lib/ai/director/reviewer";
import { estimateRisk } from "@/lib/ai/director/task";
import type {
  Assignment,
  BacklogItem,
  ExecutionPlan,
  RankedTask,
} from "@/lib/ai/director/types";
import type { SkyRuntimeApi } from "@/lib/ai/runtime/types";

export type {
  DirectorApi,
  DirectorApproval,
  DirectorApprovalState,
  DirectorContext,
  DirectorDecision,
  DirectorDecisionStatus,
  DirectorDispatchBrief,
  DirectorOptions,
  DirectorPriority,
  DirectorRisk,
  DirectorTask,
} from "@/lib/ai/director/decision-types";

export {
  loadDirectorInputs,
  parseAiTeamRoles,
  parseBacklogMarkdown,
  parseMarkdownTables,
  parseRoadmapMarkdown,
  runDirector,
  runDirectorQueue,
  runDirectorReport,
  type DirectorQueueRunResult,
} from "@/lib/ai/director/intake";

export class DirectorError extends Error {
  readonly name = "DirectorError";

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

let decisionSeq = 0;

function nextDecisionId(): string {
  decisionSeq += 1;
  return `decision-${Date.now().toString(36)}-${decisionSeq}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyApproval(): DirectorApproval {
  return {
    required: false,
    state: "not_required",
    gates: [],
    summary: "No approval assessment yet.",
    questionsForHuman: [],
    mayProceedWithoutApproval: true,
    decidedAt: null,
    decisionNote: null,
  };
}

function toBacklogItem(task: DirectorTask): BacklogItem {
  return {
    id: task.id,
    section: task.section,
    title: task.title,
    status: task.status,
    sourcePath: task.sourcePath,
  };
}

function buildPriority(ranked: RankedTask): DirectorPriority {
  return {
    rank: ranked.rank,
    label: ranked.rankLabel,
    score: ranked.score,
    reasons: ranked.reasons,
    blocked: ranked.blocked,
    blockReason: ranked.blockReason,
  };
}

function buildRisk(
  ranked: RankedTask,
  plan: ExecutionPlan | null
): DirectorRisk {
  const level = estimateRisk(ranked.item, ranked.rank);
  const reasons: string[] = [];
  if (ranked.blocked) {
    reasons.push(ranked.blockReason ?? "Task is blocked.");
  }
  if (level === "critical" || level === "high") {
    reasons.push(`Estimated risk level: ${level}.`);
  }
  for (const reason of ranked.reasons) {
    if (!reasons.includes(reason)) reasons.push(reason);
  }

  const gates = plan ? buildApprovalRequest(ranked, plan).gates : [];

  return { level, reasons, approvalGates: gates };
}

function buildDispatchBrief(
  plan: ExecutionPlan,
  assignment: Assignment
): DirectorDispatchBrief {
  return {
    primaryRoleId: assignment.primary.id,
    primaryRoleName: assignment.primary.name,
    consultRoleIds: assignment.consult.map((role) => role.id),
    objective: plan.objective,
    outOfScope: plan.outOfScope,
    steps: plan.steps.map((step) => ({
      order: step.order,
      title: step.title,
      ownerRoleId: step.ownerRoleId,
      detail: step.detail,
    })),
    validationCommands: plan.validationCommands,
    forbiddenActions: plan.forbiddenActions,
    dispatchedAt: nowIso(),
  };
}

function touch(
  decision: DirectorDecision,
  patch: Partial<DirectorDecision>
): DirectorDecision {
  return {
    ...decision,
    ...patch,
    updatedAt: nowIso(),
  };
}

/**
 * Central AI Director — planning and decision only.
 */
export class Director implements DirectorApi {
  private readonly runtime: SkyRuntimeApi;
  private decision: DirectorDecision | null = null;

  constructor(options: DirectorOptions) {
    this.runtime = options.runtime;
  }

  /**
   * Accept a task for analysis. Does not start specialist work.
   */
  async receiveTask(task: DirectorTask): Promise<DirectorDecision> {
    this.assertValidTask(task);

    const context = await this.buildContext();
    const createdAt = nowIso();

    this.decision = {
      decisionId: nextDecisionId(),
      status: "received",
      task: {
        id: task.id.trim(),
        title: task.title.trim(),
        description: task.description.trim(),
        section: task.section.trim(),
        status: task.status.trim(),
        sourcePath: task.sourcePath.trim(),
        tags: [...task.tags],
      },
      context,
      priority: null,
      risk: null,
      specialists: null,
      plan: null,
      approval: emptyApproval(),
      dispatchBrief: null,
      notes: ["Task received by AI Director. No execution performed."],
      createdAt,
      updatedAt: createdAt,
    };

    return this.decision;
  }

  /**
   * Analyse priority, risk, and specialist needs using Runtime project context.
   */
  async analyse(): Promise<DirectorDecision> {
    const current = this.requireDecision("analyse");
    const modules = this.requireRuntimeModules();
    const context = await this.buildContext();
    const backlogItem = toBacklogItem(current.task);
    const ranked = scoreBacklogItem(backlogItem);
    const blockedInfo = isBacklogItemBlocked(backlogItem);

    const roles = context.roles;
    if (!roles.length) {
      throw new DirectorError(
        "AI Director analyse() requires specialist roles from Runtime project context."
      );
    }

    const specialists = modules.dispatcher.selectSpecialists(backlogItem, roles);
    const priority = buildPriority({
      ...ranked,
      rankLabel: priorityRankLabel(ranked.rank),
      blocked: blockedInfo.blocked,
      blockReason: blockedInfo.reason,
    });
    const risk = buildRisk(
      {
        ...ranked,
        rankLabel: priority.label,
        blocked: priority.blocked,
        blockReason: priority.blockReason,
      },
      null
    );

    const notes = [
      ...current.notes,
      `Priority ${priority.label} (rank ${priority.rank}, score ${priority.score}).`,
      `Risk ${risk.level}. Primary specialist: ${specialists.primary.name}.`,
    ];

    if (priority.blocked) {
      this.decision = touch(current, {
        status: "blocked",
        context,
        priority,
        risk,
        specialists,
        notes: [
          ...notes,
          `Blocked: ${priority.blockReason ?? "unspecified blocker"}.`,
        ],
      });
      return this.decision;
    }

    this.decision = touch(current, {
      status: "analysed",
      context,
      priority,
      risk,
      specialists,
      notes,
    });
    return this.decision;
  }

  /**
   * Create an execution plan. Does not run specialists or edit the repository.
   */
  async plan(): Promise<DirectorDecision> {
    let current = this.requireDecision("plan");
    if (!current.priority || !current.specialists) {
      current = await this.analyse();
    }

    if (current.status === "blocked" || current.priority?.blocked) {
      throw new DirectorError(
        "AI Director cannot plan a blocked task. Resolve the blocker or reject the task."
      );
    }

    const modules = this.requireRuntimeModules();
    const roles = current.context.roles;
    const backlogItem = toBacklogItem(current.task);
    const ranked: RankedTask = {
      item: backlogItem,
      rank: current.priority!.rank,
      rankLabel: current.priority!.label,
      score: current.priority!.score,
      reasons: current.priority!.reasons,
      blocked: current.priority!.blocked,
      blockReason: current.priority!.blockReason,
    };

    const plan = modules.planner.buildExecutionPlan(ranked, roles);
    const specialists = modules.dispatcher.selectSpecialists(backlogItem, roles);
    plan.assignment = specialists;

    const approvalRequest = buildApprovalRequest(ranked, plan);
    const approval: DirectorApproval = {
      required: approvalRequest.required,
      state: approvalRequest.required ? "pending" : "not_required",
      gates: approvalRequest.gates,
      summary: approvalRequest.summary,
      questionsForHuman: approvalRequest.questionsForHuman,
      mayProceedWithoutApproval: approvalRequest.mayProceedWithoutApproval,
      decidedAt: null,
      decisionNote: null,
    };

    const risk = buildRisk(ranked, plan);
    const status = approval.required ? "awaiting_approval" : "planned";

    this.decision = touch(current, {
      status,
      plan,
      specialists,
      risk,
      approval,
      notes: [
        ...current.notes,
        "Execution plan created. Director will not execute this plan.",
        approval.required
          ? "Human approval required before dispatch."
          : "No additional approval required for local planning handoff.",
      ],
    });

    return this.decision;
  }

  /**
   * Record human approval for gated work. Director never invents approval.
   */
  async approve(note = "Approved by human."): Promise<DirectorDecision> {
    const current = this.requireDecision("approve");

    if (!current.plan) {
      throw new DirectorError(
        "AI Director approve() requires a plan. Call plan() first."
      );
    }
    if (current.status === "rejected") {
      throw new DirectorError("Cannot approve a rejected decision.");
    }
    if (current.status === "dispatched") {
      throw new DirectorError("Decision already dispatched.");
    }

    this.decision = touch(current, {
      status: "approved",
      approval: {
        ...current.approval,
        state: current.approval.required ? "approved" : "not_required",
        decidedAt: nowIso(),
        decisionNote: note.trim() || "Approved by human.",
      },
      notes: [...current.notes, "Human approval recorded."],
    });

    return this.decision;
  }

  /**
   * Record human rejection. No repository changes are made.
   */
  async reject(reason: string): Promise<DirectorDecision> {
    const current = this.requireDecision("reject");
    const trimmed = reason.trim();
    if (!trimmed) {
      throw new DirectorError("AI Director reject() requires a non-empty reason.");
    }

    this.decision = touch(current, {
      status: "rejected",
      approval: {
        ...current.approval,
        required: true,
        state: "rejected",
        decidedAt: nowIso(),
        decisionNote: trimmed,
      },
      dispatchBrief: null,
      notes: [...current.notes, `Rejected: ${trimmed}`],
    });

    return this.decision;
  }

  /**
   * Produce a specialist dispatch brief only.
   * Never executes shell, edits files, calls OpenAI, or touches Supabase.
   */
  async dispatch(): Promise<DirectorDecision> {
    let current = this.requireDecision("dispatch");

    if (!current.plan || !current.specialists) {
      current = await this.plan();
    }

    if (current.status === "rejected" || current.status === "blocked") {
      throw new DirectorError(
        `AI Director cannot dispatch a ${current.status} decision.`
      );
    }

    if (
      current.approval.required &&
      current.approval.state !== "approved" &&
      !current.approval.mayProceedWithoutApproval
    ) {
      throw new DirectorError(
        "AI Director cannot dispatch until human approve() is recorded for gated work."
      );
    }

    if (!current.plan || !current.specialists) {
      throw new DirectorError("AI Director dispatch() missing plan or specialists.");
    }

    const dispatchBrief = buildDispatchBrief(current.plan, current.specialists);

    this.decision = touch(current, {
      status: "dispatched",
      dispatchBrief,
      notes: [
        ...current.notes,
        `Dispatch brief prepared for ${dispatchBrief.primaryRoleName}. No code was executed by the Director.`,
      ],
    });

    return this.decision;
  }

  /** Current decision snapshot, or null if no task received. */
  status(): DirectorDecision | null {
    return this.decision;
  }

  private requireDecision(method: string): DirectorDecision {
    if (!this.decision) {
      throw new DirectorError(
        `AI Director ${method}() requires receiveTask() first.`
      );
    }
    return this.decision;
  }

  private requireRuntimeModules() {
    const modules = this.runtime.getModules();
    if (!modules || this.runtime.getStatus() !== "ready") {
      throw new DirectorError(
        "AI Director requires an initialized SKY Runtime (initialize() first)."
      );
    }
    return modules;
  }

  private async buildContext(): Promise<DirectorContext> {
    const runtimeStatus = this.runtime.getStatus();
    const config = this.runtime.getConfig();
    const repoRoot = config?.repoRoot ?? process.cwd();

    if (runtimeStatus !== "ready") {
      return {
        repoRoot,
        runtimeStatus,
        sprintTheme: null,
        roleCount: 0,
        roles: [],
        backlogItemCount: 0,
        receivedAt: nowIso(),
      };
    }

    const project = await this.runtime.loadProject();
    return {
      repoRoot: project.repoRoot,
      runtimeStatus,
      sprintTheme: project.inputs.sprintTheme,
      roleCount: project.inputs.roles.length,
      roles: project.inputs.roles,
      backlogItemCount: project.inputs.backlog.length,
      receivedAt: nowIso(),
    };
  }

  private assertValidTask(task: DirectorTask): void {
    if (!task.id?.trim() || !task.title?.trim()) {
      throw new DirectorError(
        "DirectorTask requires non-empty id and title."
      );
    }
    if (!task.section?.trim()) {
      throw new DirectorError("DirectorTask requires a non-empty section.");
    }
  }
}

/** Factory: bind Director to an initialized (or soon-to-be-initialized) Runtime. */
export function createDirector(runtime: SkyRuntimeApi): Director {
  return new Director({ runtime });
}
