import type {
  ApprovalGateId,
  ApprovalRequest,
  DirectorReview,
  ExecutionPlan,
  RankedTask,
} from "./types";

function detectGates(task: RankedTask, plan: ExecutionPlan): ApprovalGateId[] {
  const blob = `${task.item.section} ${task.item.title} ${task.item.status}`.toLowerCase();
  const gates = new Set<ApprovalGateId>();

  gates.add("G-PLAN");

  if (/auth|middleware|session|role stub|jwt/.test(blob)) {
    gates.add("G-AUTH");
  }
  if (/rls|using \(true\)|anon execute|definer|policy/.test(blob)) {
    gates.add("G-RLS");
  }
  if (/migration|not applied|schema|column|apply/.test(blob)) {
    gates.add("G-MIG");
  }
  if (/remotely|remote|ops|production|supabase db/.test(blob)) {
    gates.add("G-REMOTE");
  }
  if (/lockfile|pnpm-only|dependency|npm \+ pnpm|install/.test(blob)) {
    gates.add("G-DEPS");
  }
  if (/openai|live external|tool-calling/.test(blob)) {
    gates.add("G-AI-LIVE");
  }
  if (/delete|legacy public\/management/.test(blob)) {
    gates.add("G-DELETE");
  }
  if (/refactor|rewrite/.test(blob)) {
    gates.add("G-REFACTOR");
  }
  if (/weaken|bypass security/.test(blob)) {
    gates.add("G-FORBIDDEN");
  }

  // Commits/pushes always gated if implementation is expected later.
  gates.add("G-COMMIT");
  gates.add("G-PUSH");

  void plan;
  return [...gates];
}

export function buildApprovalRequest(
  task: RankedTask,
  plan: ExecutionPlan
): ApprovalRequest {
  const gates = detectGates(task, plan);
  const hardBlock = gates.includes("G-FORBIDDEN");
  const needsYes = gates.some((gate) =>
    [
      "G-AUTH",
      "G-RLS",
      "G-MIG",
      "G-REMOTE",
      "G-DEPS",
      "G-AI-LIVE",
      "G-DELETE",
      "G-REFACTOR",
      "G-FORBIDDEN",
    ].includes(gate)
  );

  const questions: string[] = [];
  if (gates.includes("G-AUTH")) {
    questions.push("Approve auth/middleware/session implementation work?");
  }
  if (gates.includes("G-RLS")) {
    questions.push(
      "Approve RLS changes? (Effective RLS should wait until auth/membership is ready.)"
    );
  }
  if (gates.includes("G-MIG") || gates.includes("G-REMOTE")) {
    questions.push("Approve migration apply / remote database operations?");
  }
  if (gates.includes("G-DEPS")) {
    questions.push("Approve dependency or lockfile changes?");
  }
  if (gates.includes("G-AI-LIVE")) {
    questions.push("Approve live OpenAI / external AI calls for this task?");
  }
  if (hardBlock) {
    questions.push(
      "This item implies weakening security — refuse unless redesigned safely."
    );
  }
  if (!questions.length) {
    questions.push(
      "Approve proceeding with local in-repo work under AGENTS.md (still no commit/push unless asked)?"
    );
  }

  const mayProceedWithoutApproval =
    !hardBlock &&
    !task.blocked &&
    !gates.includes("G-REMOTE") &&
    !gates.includes("G-MIG") &&
    !gates.includes("G-AUTH") &&
    !gates.includes("G-RLS") &&
    !gates.includes("G-DEPS") &&
    !gates.includes("G-AI-LIVE");

  return {
    required: needsYes || hardBlock || task.blocked,
    gates,
    summary: task.blocked
      ? `Task is blocked: ${task.blockReason}`
      : hardBlock
        ? "Forbidden security weakening path detected."
        : needsYes
          ? "Human approval required before gated actions."
          : "Local planning may proceed; commit/push/migrate still gated.",
    questionsForHuman: questions,
    mayProceedWithoutApproval,
  };
}

export function reviewPlan(plan: ExecutionPlan): DirectorReview {
  const notes: string[] = [];
  const approval = buildApprovalRequest(plan.task, plan);

  if (plan.task.blocked) {
    notes.push(`Blocked task selected or considered: ${plan.task.blockReason}`);
    return {
      verdict: "blocked",
      notes,
      approval,
    };
  }

  if (approval.gates.includes("G-FORBIDDEN")) {
    notes.push("Reject: security weakening is not approvable as a shortcut.");
    return { verdict: "blocked", notes, approval };
  }

  if (!plan.steps.length) {
    notes.push("Plan has no steps.");
    return {
      verdict: "revise_plan",
      notes,
      approval,
    };
  }

  if (approval.required && !approval.mayProceedWithoutApproval) {
    notes.push("Plan accepted pending human approval on gated actions.");
    return { verdict: "accept_plan", notes, approval };
  }

  notes.push("Plan accepted for local specialist execution within AGENTS.md.");
  return { verdict: "accept_plan", notes, approval };
}
