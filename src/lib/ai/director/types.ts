/** AI Director runtime types — planning only; no remote execution. */

export type PriorityRank = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type SpecialistRoleId =
  | "00_CHIEF_ARCHITECT"
  | "01_PRODUCT_OWNER"
  | "02_SOLUTION_ARCHITECT"
  | "03_BACKEND_ENGINEER"
  | "04_FRONTEND_ENGINEER"
  | "05_DATABASE_ENGINEER"
  | "06_SECURITY_ENGINEER"
  | "07_QA_ENGINEER"
  | "08_DEVOPS_ENGINEER"
  | "09_AI_ENGINEER"
  | "10_DOCUMENTATION_ENGINEER";

export type SpecialistRole = {
  id: SpecialistRoleId;
  code: string;
  name: string;
  focus: string;
  roleFile: string;
};

export type BacklogItem = {
  id: string;
  section: string;
  title: string;
  status: string;
  sourcePath: string;
};

export type RoadmapItem = {
  id: string;
  section: string;
  title: string;
  notes: string;
  sourcePath: string;
};

export type DirectorInputs = {
  backlog: BacklogItem[];
  roadmapCurrent: RoadmapItem[];
  roadmapFuture: RoadmapItem[];
  roles: SpecialistRole[];
  sprintTheme: string | null;
  loadedAt: string;
  sourcePaths: string[];
};

export type RankedTask = {
  item: BacklogItem;
  rank: PriorityRank;
  rankLabel: string;
  score: number;
  reasons: string[];
  blocked: boolean;
  blockReason: string | null;
};

export type Assignment = {
  primary: SpecialistRole;
  consult: SpecialistRole[];
  rationale: string;
};

export type PlanStep = {
  order: number;
  title: string;
  ownerRoleId: SpecialistRoleId;
  detail: string;
};

export type ExecutionPlan = {
  task: RankedTask;
  assignment: Assignment;
  objective: string;
  outOfScope: string[];
  steps: PlanStep[];
  validationCommands: string[];
  forbiddenActions: string[];
};

export type ApprovalGateId =
  | "G-PLAN"
  | "G-DEPS"
  | "G-AUTH"
  | "G-RLS"
  | "G-MIG"
  | "G-REMOTE"
  | "G-COMMIT"
  | "G-PUSH"
  | "G-DELETE"
  | "G-REFACTOR"
  | "G-AI-LIVE"
  | "G-ENV"
  | "G-FORBIDDEN";

export type ApprovalRequest = {
  required: boolean;
  gates: ApprovalGateId[];
  summary: string;
  questionsForHuman: string[];
  mayProceedWithoutApproval: boolean;
};

export type ReviewVerdict = "accept_plan" | "revise_plan" | "blocked";

export type DirectorReview = {
  verdict: ReviewVerdict;
  notes: string[];
  approval: ApprovalRequest;
};

export type DirectorReport = {
  generatedAt: string;
  title: string;
  markdown: string;
  selectedTask: RankedTask | null;
  plan: ExecutionPlan | null;
  review: DirectorReview;
  candidatesConsidered: number;
};

export type DirectorRunOptions = {
  /** Optional repo root; defaults to process.cwd(). */
  repoRoot?: string;
  /** Prefer a backlog section (e.g. "Security"). */
  preferSection?: string;
  /** Prefer title substring match. */
  preferTitleIncludes?: string;
  /** Include blocked tasks as selectable (default false). */
  allowBlocked?: boolean;
};

export type DirectorRunResult = {
  inputs: DirectorInputs;
  ranked: RankedTask[];
  report: DirectorReport;
};
