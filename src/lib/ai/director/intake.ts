import { promises as fs } from "fs";
import path from "path";
import { selectSpecialists } from "./dispatcher";
import { buildExecutionPlan } from "./planner";
import { selectHighestPriorityTask } from "./priority";
import {
  createQueueFromBacklog,
  queueSnapshot,
  type DependencyGraph,
} from "./queue";
import { buildDirectorReport } from "./reporter";
import { reviewPlan } from "./reviewer";
import {
  buildDailyExecutionQueue,
  getSchedulerView,
  type DailyExecutionQueue,
} from "./scheduler";
import type { DirectorQueueState } from "./state";
import type {
  BacklogItem,
  DirectorInputs,
  DirectorRunOptions,
  DirectorRunResult,
  RoadmapItem,
  SpecialistRole,
  SpecialistRoleId,
} from "./types";

const ROLE_ID_BY_CODE: Record<string, SpecialistRoleId> = {
  "00": "00_CHIEF_ARCHITECT",
  "01": "01_PRODUCT_OWNER",
  "02": "02_SOLUTION_ARCHITECT",
  "03": "03_BACKEND_ENGINEER",
  "04": "04_FRONTEND_ENGINEER",
  "05": "05_DATABASE_ENGINEER",
  "06": "06_SECURITY_ENGINEER",
  "07": "07_QA_ENGINEER",
  "08": "08_DEVOPS_ENGINEER",
  "09": "09_AI_ENGINEER",
  "10": "10_DOCUMENTATION_ENGINEER",
};

async function readTextIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

/** Parse GitHub-style markdown tables into row objects by header name. */
export function parseMarkdownTables(
  markdown: string
): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = [];
  const lines = markdown.split(/\r?\n/);

  for (let i = 0; i < lines.length - 1; i++) {
    const headerLine = lines[i]?.trim();
    const sepLine = lines[i + 1]?.trim();
    if (!headerLine?.startsWith("|") || !sepLine?.startsWith("|")) continue;
    if (!sepLine.includes("---")) continue;

    const headers = headerLine
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (headers.length < 2) continue;

    let j = i + 2;
    while (j < lines.length) {
      const line = lines[j]?.trim();
      if (!line?.startsWith("|")) break;
      const raw = line.split("|").slice(1, -1).map((cell) => cell.trim());
      if (raw.length === 0) break;
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = raw[idx] ?? "";
      });
      rows.push(row);
      j++;
    }
    i = j - 1;
  }

  return rows;
}

export function parseBacklogMarkdown(
  markdown: string,
  sourcePath: string
): BacklogItem[] {
  const items: BacklogItem[] = [];
  const lines = markdown.split(/\r?\n/);
  let section = "General";
  let index = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const heading = /^##\s+(.+)$/.exec(line.trim());
    if (heading) {
      section = heading[1].trim();
      continue;
    }

    if (!line.trim().startsWith("|")) continue;
    const sep = lines[i + 1]?.trim() ?? "";
    if (!/^\|[-:\s|]+$/.test(sep.replace(/\|/g, "|"))) continue;
    if (!sep.includes("---")) continue;

    const headers = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim().toLowerCase());
    const itemIdx = headers.findIndex((h) => h === "item");
    const statusIdx = headers.findIndex((h) => h === "status");
    if (itemIdx < 0 || statusIdx < 0) continue;

    let j = i + 2;
    while (j < lines.length) {
      const rowLine = lines[j]?.trim() ?? "";
      if (!rowLine.startsWith("|")) break;
      const cells = rowLine.split("|").slice(1, -1).map((cell) => cell.trim());
      const title = cells[itemIdx] ?? "";
      const status = cells[statusIdx] ?? "";
      if (title && !/^-+$/.test(title)) {
        index += 1;
        items.push({
          id: `backlog-${index}`,
          section,
          title,
          status,
          sourcePath,
        });
      }
      j++;
    }
    i = j - 1;
  }

  return items;
}

export function parseRoadmapMarkdown(
  markdown: string,
  sourcePath: string
): RoadmapItem[] {
  const tables = parseMarkdownTables(markdown);
  const items: RoadmapItem[] = [];
  let index = 0;

  for (const row of tables) {
    const area = row.Area ?? row.Item ?? row.Title ?? "";
    const notes = row.Notes ?? row.Status ?? row.Detail ?? "";
    if (!area || /^-+$/.test(area)) continue;
    index += 1;
    items.push({
      id: `roadmap-${index}`,
      section: path.basename(sourcePath, ".md"),
      title: area,
      notes,
      sourcePath,
    });
  }

  if (items.length === 0) {
    for (const line of markdown.split(/\r?\n/)) {
      const heading = /^##\s+(.+)$/.exec(line.trim());
      if (heading) {
        index += 1;
        items.push({
          id: `roadmap-${index}`,
          section: path.basename(sourcePath, ".md"),
          title: heading[1].trim(),
          notes: "",
          sourcePath,
        });
      }
    }
  }

  return items;
}

export function parseAiTeamRoles(markdown: string): SpecialistRole[] {
  const roles: SpecialistRole[] = [];
  const lines = markdown.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";
    if (!line.startsWith("|")) continue;
    const sep = lines[i + 1]?.trim() ?? "";
    if (!sep.includes("---")) continue;

    const headers = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim().toLowerCase());
    if (!headers.includes("#") || !headers.includes("role")) continue;

    const codeIdx = headers.indexOf("#");
    const roleIdx = headers.indexOf("role");
    const focusIdx = headers.indexOf("primary focus");

    let j = i + 2;
    while (j < lines.length) {
      const rowLine = lines[j]?.trim() ?? "";
      if (!rowLine.startsWith("|")) break;
      const cells = rowLine.split("|").slice(1, -1).map((cell) => cell.trim());
      const code = (cells[codeIdx] ?? "").padStart(2, "0");
      const name = cells[roleIdx] ?? "";
      const focus = cells[focusIdx] ?? "";
      const id = ROLE_ID_BY_CODE[code];
      if (id && name) {
        roles.push({
          id,
          code,
          name,
          focus,
          roleFile: `management/roles/${id}.md`,
        });
      }
      j++;
    }
    break;
  }

  return roles;
}

function parseSprintTheme(markdown: string | null): string | null {
  if (!markdown) return null;
  const match = /^##\s+Theme\s*\n+(.+)$/m.exec(markdown);
  if (match) return match[1].trim();
  const bullet = /\*\*Theme\*\*:\s*(.+)/i.exec(markdown);
  return bullet?.[1]?.trim() ?? null;
}

export async function loadDirectorInputs(
  repoRoot: string
): Promise<DirectorInputs> {
  const sourcePaths = [
    "management/BACKLOG.md",
    "knowledge/Roadmap/Current.md",
    "knowledge/Roadmap/Future.md",
    "management/AI_TEAM.md",
    "management/CURRENT_SPRINT.md",
    "management/AI_DIRECTOR.md",
  ];

  const abs = (rel: string) => path.join(repoRoot, rel);

  const [backlogMd, currentMd, futureMd, teamMd, sprintMd] = await Promise.all([
    readTextIfExists(abs("management/BACKLOG.md")),
    readTextIfExists(abs("knowledge/Roadmap/Current.md")),
    readTextIfExists(abs("knowledge/Roadmap/Future.md")),
    readTextIfExists(abs("management/AI_TEAM.md")),
    readTextIfExists(abs("management/CURRENT_SPRINT.md")),
  ]);

  if (!backlogMd) {
    throw new Error("AI Director: management/BACKLOG.md not found.");
  }
  if (!teamMd) {
    throw new Error("AI Director: management/AI_TEAM.md not found.");
  }

  const roles = parseAiTeamRoles(teamMd);
  if (roles.length < 11) {
    throw new Error(
      `AI Director: expected 11 specialist roles, found ${roles.length}.`
    );
  }

  return {
    backlog: parseBacklogMarkdown(backlogMd, "management/BACKLOG.md"),
    roadmapCurrent: currentMd
      ? parseRoadmapMarkdown(currentMd, "knowledge/Roadmap/Current.md")
      : [],
    roadmapFuture: futureMd
      ? parseRoadmapMarkdown(futureMd, "knowledge/Roadmap/Future.md")
      : [],
    roles,
    sprintTheme: parseSprintTheme(sprintMd),
    loadedAt: new Date().toISOString(),
    sourcePaths,
  };
}

/**
 * Run the AI Director planner (local filesystem only).
 * Does not execute shell commands, call remotes, or mutate business modules.
 */
export async function runDirector(
  options: DirectorRunOptions = {}
): Promise<DirectorRunResult> {
  const repoRoot = options.repoRoot ?? process.cwd();
  const inputs = await loadDirectorInputs(repoRoot);

  const { ranked, selected } = selectHighestPriorityTask(inputs.backlog, {
    preferSection: options.preferSection,
    preferTitleIncludes: options.preferTitleIncludes,
    allowBlocked: options.allowBlocked,
  });

  if (!selected) {
    const emptyReview = {
      verdict: "blocked" as const,
      notes: ["No actionable backlog item available."],
      approval: {
        required: true,
        gates: [],
        summary: "Nothing to execute.",
        questionsForHuman: [
          "Unblock auth/migration items or add actionable backlog rows?",
        ],
        mayProceedWithoutApproval: false,
      },
    };

    return {
      inputs,
      ranked,
      report: buildDirectorReport({
        inputs,
        selected: null,
        plan: null,
        review: emptyReview,
        candidatesConsidered: ranked.length,
      }),
    };
  }

  const plan = buildExecutionPlan(selected, inputs.roles);
  const assignmentCheck = selectSpecialists(selected.item, inputs.roles);
  plan.assignment = assignmentCheck;

  const review = reviewPlan(plan);
  const report = buildDirectorReport({
    inputs,
    selected,
    plan,
    review,
    candidatesConsidered: ranked.length,
  });

  return { inputs, ranked, report };
}

export async function runDirectorReport(
  options: DirectorRunOptions = {}
): Promise<string> {
  const result = await runDirector(options);
  return result.report.markdown;
}

export type DirectorQueueRunResult = {
  inputs: DirectorInputs;
  state: DirectorQueueState;
  daily: DailyExecutionQueue;
  dependencyGraph: DependencyGraph;
  counts: ReturnType<typeof queueSnapshot>;
  schedulerView: ReturnType<typeof getSchedulerView>;
};

/**
 * Build the Director task queue from backlog + roles, with daily ordering.
 * Local planning only — does not execute work, shell, or remotes.
 */
export async function runDirectorQueue(
  options: DirectorRunOptions = {}
): Promise<DirectorQueueRunResult> {
  const repoRoot = options.repoRoot ?? process.cwd();
  const inputs = await loadDirectorInputs(repoRoot);
  const state = createQueueFromBacklog(inputs.backlog, inputs.roles);
  const { state: withDaily, daily } = buildDailyExecutionQueue(state);
  const schedulerView = getSchedulerView(withDaily);

  return {
    inputs,
    state: withDaily,
    daily,
    dependencyGraph: schedulerView.dependencyGraph,
    counts: queueSnapshot(withDaily),
    schedulerView,
  };
}
