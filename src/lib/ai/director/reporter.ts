import type {
  DirectorInputs,
  DirectorReport,
  DirectorReview,
  ExecutionPlan,
  RankedTask,
} from "./types";

export function buildDirectorReport(input: {
  inputs: DirectorInputs;
  selected: RankedTask | null;
  plan: ExecutionPlan | null;
  review: DirectorReview;
  candidatesConsidered: number;
}): DirectorReport {
  const generatedAt = new Date().toISOString();
  const title = input.selected
    ? `AI Director Report — ${input.selected.item.title}`
    : "AI Director Report — No actionable task";

  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`Generated: ${generatedAt}`);
  lines.push("");
  lines.push("## Intake");
  lines.push("");
  lines.push(`- Backlog items: ${input.inputs.backlog.length}`);
  lines.push(`- Roadmap current rows: ${input.inputs.roadmapCurrent.length}`);
  lines.push(`- Roadmap future rows: ${input.inputs.roadmapFuture.length}`);
  lines.push(`- Specialist roles: ${input.inputs.roles.length}`);
  lines.push(
    `- Sprint theme: ${input.inputs.sprintTheme ?? "(not found)"}`
  );
  lines.push(`- Candidates considered: ${input.candidatesConsidered}`);
  lines.push("");
  lines.push("### Sources");
  lines.push("");
  for (const path of input.inputs.sourcePaths) {
    lines.push(`- \`${path}\``);
  }
  lines.push("");

  if (!input.selected || !input.plan) {
    lines.push("## Selection");
    lines.push("");
    lines.push("No eligible backlog task found (all blocked or empty backlog).");
    lines.push("");
    lines.push("## Review");
    lines.push("");
    lines.push(`Verdict: **${input.review.verdict}**`);
    for (const note of input.review.notes) {
      lines.push(`- ${note}`);
    }
  } else {
    const task = input.selected;
    const plan = input.plan;

    lines.push("## Selected task");
    lines.push("");
    lines.push(`- **Section:** ${task.item.section}`);
    lines.push(`- **Title:** ${task.item.title}`);
    lines.push(`- **Status:** ${task.item.status}`);
    lines.push(`- **Priority:** ${task.rankLabel} (score ${task.score})`);
    lines.push(`- **Blocked:** ${task.blocked ? "yes" : "no"}`);
    if (task.blockReason) {
      lines.push(`- **Block reason:** ${task.blockReason}`);
    }
    lines.push("- **Reasons:**");
    for (const reason of task.reasons) {
      lines.push(`  - ${reason}`);
    }
    lines.push("");

    lines.push("## Specialist assignment");
    lines.push("");
    lines.push(`- **Primary:** ${plan.assignment.primary.name} (\`${plan.assignment.primary.id}\`)`);
    lines.push(
      `- **Consult:** ${
        plan.assignment.consult.map((r) => r.name).join(", ") || "—"
      }`
    );
    lines.push(`- **Rationale:** ${plan.assignment.rationale}`);
    lines.push("");

    lines.push("## Execution plan");
    lines.push("");
    lines.push(`**Objective:** ${plan.objective}`);
    lines.push("");
    lines.push("### Out of scope");
    lines.push("");
    for (const item of plan.outOfScope) {
      lines.push(`- ${item}`);
    }
    lines.push("");
    lines.push("### Steps");
    lines.push("");
    for (const step of plan.steps) {
      lines.push(
        `${step.order}. **${step.title}** — \`${step.ownerRoleId}\`: ${step.detail}`
      );
    }
    lines.push("");
    lines.push("### Validation commands (for specialists — not run by Director runtime)");
    lines.push("");
    for (const cmd of plan.validationCommands) {
      lines.push(`- \`${cmd}\``);
    }
    lines.push("");
    lines.push("### Forbidden actions");
    lines.push("");
    for (const item of plan.forbiddenActions) {
      lines.push(`- ${item}`);
    }
    lines.push("");

    lines.push("## Approval request");
    lines.push("");
    lines.push(
      `- **Required:** ${input.review.approval.required ? "YES" : "no"}`
    );
    lines.push(
      `- **May proceed without approval (local only):** ${
        input.review.approval.mayProceedWithoutApproval ? "yes" : "no"
      }`
    );
    lines.push(
      `- **Gates:** ${input.review.approval.gates.join(", ") || "—"}`
    );
    lines.push(`- **Summary:** ${input.review.approval.summary}`);
    lines.push("- **Questions for human:**");
    for (const q of input.review.approval.questionsForHuman) {
      lines.push(`  - ${q}`);
    }
    lines.push("");

    lines.push("## Review verdict");
    lines.push("");
    lines.push(`**${input.review.verdict}**`);
    for (const note of input.review.notes) {
      lines.push(`- ${note}`);
    }
  }

  lines.push("");
  lines.push("## Director constraints");
  lines.push("");
  lines.push("- No external commands executed by this runtime.");
  lines.push("- No remote services called.");
  lines.push("- No Supabase access.");
  lines.push("- No business modules modified by the Director module itself.");
  lines.push("- No commits or pushes.");

  return {
    generatedAt,
    title,
    markdown: lines.join("\n"),
    selectedTask: input.selected,
    plan: input.plan,
    review: input.review,
    candidatesConsidered: input.candidatesConsidered,
  };
}
