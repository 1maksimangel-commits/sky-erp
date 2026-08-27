import {
  loadDirectorInputs,
  parseBacklogMarkdown,
  runDirector,
  runDirectorQueue,
} from "@/lib/ai/director/director";
import { selectSpecialists } from "@/lib/ai/director/dispatcher";
import { buildExecutionPlan } from "@/lib/ai/director/planner";
import {
  createQueueFromBacklog,
  listQueue,
  queueSnapshot,
} from "@/lib/ai/director/queue";
import { buildDirectorReport } from "@/lib/ai/director/reporter";
import { reviewPlan } from "@/lib/ai/director/reviewer";
import type {
  Assignment,
  DirectorInputs,
  DirectorReport,
  DirectorReview,
  ExecutionPlan,
  RankedTask,
} from "@/lib/ai/director/types";
import { NotImplementedError, RuntimeError } from "@/lib/ai/runtime/errors";
import type {
  RuntimeBacklog,
  RuntimeConfig,
  RuntimeConfigInput,
  RuntimeModuleBundle,
  RuntimePlanResult,
  RuntimeProject,
  RuntimeReportResult,
  RuntimeReviewResult,
  RuntimeStatus,
  SkyRuntimeApi,
} from "@/lib/ai/runtime/types";

const BACKLOG_SOURCE = "management/BACKLOG.md";

function isUnfinishedBacklogStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.startsWith("done")) return false;
  if (normalized.includes("mitigated")) return false;
  if (/\bin repo\b/.test(normalized) && !normalized.includes("incomplete")) {
    return false;
  }
  return true;
}

/**
 * SKY Runtime — central control plane for the AI Engineering Department.
 *
 * Loads AI Director, Planner, Dispatcher, Queue, Reviewer, and Reporter.
 * Planning and review only. Does not mutate business modules, Supabase, git,
 * or apply migrations.
 */
export class SkyRuntime implements SkyRuntimeApi {
  private status: RuntimeStatus = "uninitialized";
  private config: RuntimeConfig | null = null;
  private modules: RuntimeModuleBundle | null = null;

  private projectInputs: DirectorInputs | null = null;
  private lastRanked: RankedTask[] = [];
  private lastSelected: RankedTask | null = null;
  private lastPlan: ExecutionPlan | null = null;
  private lastAssignment: Assignment | null = null;
  private lastReview: DirectorReview | null = null;
  private lastReport: DirectorReport | null = null;

  getStatus(): RuntimeStatus {
    return this.status;
  }

  getConfig(): RuntimeConfig | null {
    return this.config;
  }

  getModules(): RuntimeModuleBundle | null {
    return this.modules;
  }

  /**
   * Initialize the runtime and bind organization modules.
   */
  async initialize(config: RuntimeConfigInput = {}): Promise<void> {
    if (this.status === "ready") {
      throw new RuntimeError(
        "SKY Runtime is already initialized. Call shutdown() before re-initialize()."
      );
    }

    this.config = {
      repoRoot: config.repoRoot ?? process.cwd(),
      preferSection: config.preferSection,
      preferTitleIncludes: config.preferTitleIncludes,
      allowBlocked: config.allowBlocked ?? false,
    };

    this.modules = {
      director: {
        loadDirectorInputs,
        runDirector,
        runDirectorQueue,
        parseBacklogMarkdown,
      },
      planner: {
        buildExecutionPlan,
      },
      dispatcher: {
        selectSpecialists,
      },
      queue: {
        createQueueFromBacklog,
        queueSnapshot,
        listQueue,
      },
      reviewer: {
        reviewPlan,
      },
      reporter: {
        buildDirectorReport,
      },
    };

    this.clearSessionArtifacts();
    this.status = "ready";
  }

  /**
   * Load project planning inputs (backlog, roadmap, roles, sprint) and queue.
   */
  async loadProject(): Promise<RuntimeProject> {
    const { config, modules } = this.requireReady();

    const inputs = await modules.director.loadDirectorInputs(config.repoRoot);
    const queueState = modules.queue.createQueueFromBacklog(
      inputs.backlog,
      inputs.roles
    );
    const queueCounts = modules.queue.queueSnapshot(queueState);

    this.projectInputs = inputs;

    return {
      repoRoot: config.repoRoot,
      loadedAt: inputs.loadedAt,
      inputs,
      queueState,
      queueCounts,
    };
  }

  /**
   * Load and parse the structured backlog for the AI organization.
   */
  async loadBacklog(): Promise<RuntimeBacklog> {
    const { modules } = this.requireReady();

    const inputs =
      this.projectInputs ??
      (await modules.director.loadDirectorInputs(this.requireConfig().repoRoot));

    this.projectInputs = inputs;

    return {
      items: inputs.backlog,
      roles: inputs.roles,
      loadedAt: new Date().toISOString(),
      sourcePath: BACKLOG_SOURCE,
      unfinishedCount: inputs.backlog.filter((item) =>
        isUnfinishedBacklogStatus(item.status)
      ).length,
    };
  }

  /**
   * Rank backlog, assign specialists, and build an execution plan.
   */
  async plan(): Promise<RuntimePlanResult> {
    const { config, modules } = this.requireReady();

    const result = await modules.director.runDirector({
      repoRoot: config.repoRoot,
      preferSection: config.preferSection,
      preferTitleIncludes: config.preferTitleIncludes,
      allowBlocked: config.allowBlocked,
    });

    this.projectInputs = result.inputs;
    this.lastRanked = result.ranked;
    this.lastSelected = result.report.selectedTask;
    this.lastPlan = result.report.plan;
    this.lastAssignment = result.report.plan?.assignment ?? null;
    this.lastReview = result.report.review;
    this.lastReport = result.report;

    if (this.lastSelected && this.lastPlan) {
      const assignment = modules.dispatcher.selectSpecialists(
        this.lastSelected.item,
        result.inputs.roles
      );
      this.lastPlan = {
        ...this.lastPlan,
        assignment,
      };
      this.lastAssignment = assignment;
    }

    return {
      ranked: this.lastRanked,
      selected: this.lastSelected,
      plan: this.lastPlan,
      assignment: this.lastAssignment,
    };
  }

  /**
   * Specialist execution is outside the planning Runtime.
   * Future agent-runner modules will own this capability.
   */
  async execute(): Promise<never> {
    this.requireReady();
    throw new NotImplementedError(
      "SkyRuntime.execute() is not implemented: specialist agent execution depends on a future execution module. Use plan(), review(), and report() for the planning control plane."
    );
  }

  /**
   * Review the current plan against approval gates.
   */
  async review(): Promise<RuntimeReviewResult> {
    const { modules } = this.requireReady();

    if (!this.lastPlan && !this.lastSelected) {
      await this.plan();
    }

    if (!this.lastPlan) {
      const review: DirectorReview = this.lastReview ?? {
        verdict: "blocked",
        notes: ["No execution plan available to review."],
        approval: {
          required: true,
          gates: [],
          summary: "Nothing to review.",
          questionsForHuman: [
            "Load backlog and ensure an actionable unfinished item exists?",
          ],
          mayProceedWithoutApproval: false,
        },
      };
      this.lastReview = review;
      return {
        review,
        plan: null,
        selected: this.lastSelected,
      };
    }

    const review = modules.reviewer.reviewPlan(this.lastPlan);
    this.lastReview = review;

    return {
      review,
      plan: this.lastPlan,
      selected: this.lastSelected,
    };
  }

  /**
   * Build a Director markdown report for the current planning session.
   */
  async report(): Promise<RuntimeReportResult> {
    const { modules } = this.requireReady();

    if (!this.projectInputs || !this.lastReview) {
      await this.plan();
    }

    if (!this.projectInputs || !this.lastReview) {
      throw new RuntimeError(
        "SKY Runtime cannot build a report: project inputs or review are missing after plan()."
      );
    }

    const report = modules.reporter.buildDirectorReport({
      inputs: this.projectInputs,
      selected: this.lastSelected,
      plan: this.lastPlan,
      review: this.lastReview,
      candidatesConsidered: this.lastRanked.length,
    });

    this.lastReport = report;

    return {
      report,
      markdown: report.markdown,
    };
  }

  /**
   * Release module bindings and clear session state.
   */
  async shutdown(): Promise<void> {
    this.modules = null;
    this.config = null;
    this.clearSessionArtifacts();
    this.status = "shut_down";
  }

  private requireConfig(): RuntimeConfig {
    if (!this.config) {
      throw new RuntimeError(
        "SKY Runtime has no config. Call initialize() first."
      );
    }
    return this.config;
  }

  private requireReady(): {
    config: RuntimeConfig;
    modules: RuntimeModuleBundle;
  } {
    if (this.status !== "ready" || !this.config || !this.modules) {
      throw new RuntimeError(
        `SKY Runtime is not ready (status=${this.status}). Call initialize() first.`
      );
    }
    return { config: this.config, modules: this.modules };
  }

  private clearSessionArtifacts(): void {
    this.projectInputs = null;
    this.lastRanked = [];
    this.lastSelected = null;
    this.lastPlan = null;
    this.lastAssignment = null;
    this.lastReview = null;
    this.lastReport = null;
  }
}

/** Factory for a fresh SKY Runtime instance. */
export function createSkyRuntime(): SkyRuntime {
  return new SkyRuntime();
}

/** Shared process-level runtime instance (lazy; still requires initialize()). */
let sharedRuntime: SkyRuntime | null = null;

export function getSkyRuntime(): SkyRuntime {
  if (!sharedRuntime) {
    sharedRuntime = createSkyRuntime();
  }
  return sharedRuntime;
}

export function resetSkyRuntimeForTests(): void {
  sharedRuntime = null;
}
