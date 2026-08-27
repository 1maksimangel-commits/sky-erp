import type { DependencyGraph } from "@/lib/ai/director/queue";
import type { DirectorQueueState } from "@/lib/ai/director/state";
import type {
  DirectorTask,
  DirectorTaskStatus,
} from "@/lib/ai/director/task";
import type {
  Assignment,
  BacklogItem,
  DirectorInputs,
  DirectorReport,
  DirectorReview,
  ExecutionPlan,
  RankedTask,
  SpecialistRole,
} from "@/lib/ai/director/types";

/** Lifecycle of the SKY Runtime process. */
export type RuntimeStatus = "uninitialized" | "ready" | "shut_down";

/** Configuration accepted by `initialize()`. */
export type RuntimeConfig = {
  /** Absolute or process-relative repository root. Defaults to `process.cwd()`. */
  repoRoot: string;
  /** Prefer backlog section when planning (e.g. `"Security"`). */
  preferSection?: string;
  /** Prefer title substring when planning. */
  preferTitleIncludes?: string;
  /** Allow selecting blocked backlog items (default false). */
  allowBlocked: boolean;
};

/** Partial config supplied by callers; defaults filled during initialize. */
export type RuntimeConfigInput = {
  repoRoot?: string;
  preferSection?: string;
  preferTitleIncludes?: string;
  allowBlocked?: boolean;
};

/** Loaded AI Director surface (planning entrypoints). */
export type DirectorModule = {
  loadDirectorInputs: (repoRoot: string) => Promise<DirectorInputs>;
  runDirector: (options?: {
    repoRoot?: string;
    preferSection?: string;
    preferTitleIncludes?: string;
    allowBlocked?: boolean;
  }) => Promise<{
    inputs: DirectorInputs;
    ranked: RankedTask[];
    report: DirectorReport;
  }>;
  runDirectorQueue: (options?: {
    repoRoot?: string;
    preferSection?: string;
    preferTitleIncludes?: string;
    allowBlocked?: boolean;
  }) => Promise<{
    inputs: DirectorInputs;
    state: DirectorQueueState;
    dependencyGraph: DependencyGraph;
  }>;
  parseBacklogMarkdown: (markdown: string, sourcePath: string) => BacklogItem[];
};

/** Planner module surface. */
export type PlannerModule = {
  buildExecutionPlan: (
    task: RankedTask,
    roles: SpecialistRole[]
  ) => ExecutionPlan;
};

/** Dispatcher module surface. */
export type DispatcherModule = {
  selectSpecialists: (
    item: BacklogItem,
    roles: SpecialistRole[]
  ) => Assignment;
};

/** Queue module surface. */
export type QueueModule = {
  createQueueFromBacklog: (
    backlog: BacklogItem[],
    roles: SpecialistRole[]
  ) => DirectorQueueState;
  queueSnapshot: (
    state: DirectorQueueState
  ) => Record<DirectorTaskStatus, number>;
  listQueue: (
    state: DirectorQueueState,
    status?: DirectorTaskStatus
  ) => DirectorTask[];
};

/** Reviewer module surface. */
export type ReviewerModule = {
  reviewPlan: (plan: ExecutionPlan) => DirectorReview;
};

/** Reporter module surface. */
export type ReporterModule = {
  buildDirectorReport: (input: {
    inputs: DirectorInputs;
    selected: RankedTask | null;
    plan: ExecutionPlan | null;
    review: DirectorReview;
    candidatesConsidered: number;
  }) => DirectorReport;
};

/** Bundle of organization modules bound during `initialize()`. */
export type RuntimeModuleBundle = {
  director: DirectorModule;
  planner: PlannerModule;
  dispatcher: DispatcherModule;
  queue: QueueModule;
  reviewer: ReviewerModule;
  reporter: ReporterModule;
};

/** Project context loaded from management / knowledge sources. */
export type RuntimeProject = {
  repoRoot: string;
  loadedAt: string;
  inputs: DirectorInputs;
  queueState: DirectorQueueState;
  queueCounts: Record<DirectorTaskStatus, number>;
};

/** Backlog snapshot. */
export type RuntimeBacklog = {
  items: BacklogItem[];
  roles: SpecialistRole[];
  loadedAt: string;
  sourcePath: string;
  unfinishedCount: number;
};

/** Result of `plan()`. */
export type RuntimePlanResult = {
  ranked: RankedTask[];
  selected: RankedTask | null;
  plan: ExecutionPlan | null;
  assignment: Assignment | null;
};

/** Result of `review()`. */
export type RuntimeReviewResult = {
  review: DirectorReview;
  plan: ExecutionPlan | null;
  selected: RankedTask | null;
};

/** Result of `report()`. */
export type RuntimeReportResult = {
  report: DirectorReport;
  markdown: string;
};

/**
 * Single Runtime API for the AI organization control plane.
 * Does not mutate business modules, Supabase, or git.
 */
export interface SkyRuntimeApi {
  initialize(config?: RuntimeConfigInput): Promise<void>;
  loadProject(): Promise<RuntimeProject>;
  loadBacklog(): Promise<RuntimeBacklog>;
  plan(): Promise<RuntimePlanResult>;
  execute(): Promise<never>;
  review(): Promise<RuntimeReviewResult>;
  report(): Promise<RuntimeReportResult>;
  shutdown(): Promise<void>;
  getStatus(): RuntimeStatus;
  getConfig(): RuntimeConfig | null;
  getModules(): RuntimeModuleBundle | null;
}
