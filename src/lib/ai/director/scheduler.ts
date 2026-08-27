import {
  buildDependencyGraph,
  dependenciesSatisfied,
  getPendingReady,
  sortByPriority,
} from "./queue";
import {
  appendHistory,
  getTask,
  upsertTask,
  type DirectorQueueState,
} from "./state";
import type { DirectorTask, DirectorTaskStatus, TaskHistoryEvent } from "./task";

export type DailyExecutionQueue = {
  date: string;
  orderedTaskIds: string[];
  tasks: DirectorTask[];
  skipped: Array<{ taskId: string; reason: string }>;
};

export type SchedulerTransitionResult = {
  state: DirectorQueueState;
  task: DirectorTask | null;
  ok: boolean;
  message: string;
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function transition(
  state: DirectorQueueState,
  taskId: string,
  toStatus: DirectorTaskStatus,
  message: string,
  patch?: Partial<DirectorTask>
): SchedulerTransitionResult {
  const current = getTask(state, taskId);
  if (!current) {
    return { state, task: null, ok: false, message: `Unknown task ${taskId}` };
  }

  const now = new Date().toISOString();
  const updated: DirectorTask = {
    ...current,
    ...patch,
    queueStatus: toStatus,
    updatedAt: now,
  };

  let next = upsertTask(state, updated);
  next = appendHistory(next, {
    taskId,
    fromStatus: current.queueStatus,
    toStatus,
    message,
  });

  return {
    state: next,
    task: updated,
    ok: true,
    message,
  };
}

/**
 * Build / refresh the daily execution queue (priority-ordered, dependency-aware).
 * Does not run shell commands or call remotes — planning only.
 */
export function buildDailyExecutionQueue(
  state: DirectorQueueState,
  options?: { date?: string; limit?: number }
): { state: DirectorQueueState; daily: DailyExecutionQueue } {
  const date = options?.date ?? todayUtc();
  const limit = options?.limit ?? 10;
  const skipped: DailyExecutionQueue["skipped"] = [];

  const candidates = sortByPriority(
    state.tasks.filter((task) =>
      ["pending", "approval_required", "failed"].includes(task.queueStatus)
    )
  );

  const ordered: DirectorTask[] = [];

  for (const task of candidates) {
    if (ordered.length >= limit) break;

    if (task.queueStatus === "approval_required") {
      skipped.push({
        taskId: task.id,
        reason: "Awaiting human approval",
      });
      continue;
    }

    if (task.queueStatus === "blocked") {
      skipped.push({ taskId: task.id, reason: task.blockReason ?? "Blocked" });
      continue;
    }

    const deps = dependenciesSatisfied(task, state);
    if (!deps.ok) {
      skipped.push({
        taskId: task.id,
        reason: `Unmet dependencies: ${deps.unmet.join(", ")}`,
      });
      continue;
    }

    if (
      task.queueStatus === "failed" &&
      task.retry.attempts >= task.retry.maxAttempts
    ) {
      skipped.push({
        taskId: task.id,
        reason: "Retry budget exhausted",
      });
      continue;
    }

    ordered.push(task);
  }

  // Also surface ready pending via helper for consistency
  for (const task of getPendingReady(state)) {
    if (ordered.length >= limit) break;
    if (!ordered.some((item) => item.id === task.id)) {
      ordered.push(task);
    }
  }

  const orderedTaskIds = ordered.slice(0, limit).map((task) => task.id);
  const next: DirectorQueueState = {
    ...state,
    dailyDate: date,
    dailyOrderedTaskIds: orderedTaskIds,
    updatedAt: new Date().toISOString(),
  };

  return {
    state: next,
    daily: {
      date,
      orderedTaskIds,
      tasks: orderedTaskIds
        .map((id) => getTask(next, id))
        .filter((task): task is DirectorTask => Boolean(task)),
      skipped,
    },
  };
}

/** Mark the next ready daily/pending task as running (logical start only). */
export function startNextTask(state: DirectorQueueState): SchedulerTransitionResult {
  const ready = getPendingReady(state);
  const fromDaily = state.dailyOrderedTaskIds
    .map((id) => getTask(state, id))
    .filter((task): task is DirectorTask => Boolean(task))
    .filter((task) => task.queueStatus === "pending");

  const nextTask = fromDaily[0] ?? ready[0] ?? null;
  if (!nextTask) {
    return {
      state,
      task: null,
      ok: false,
      message: "No pending task ready to run.",
    };
  }

  if (nextTask.approvalRequired) {
    return transition(
      state,
      nextTask.id,
      "approval_required",
      "Cannot start — human approval required.",
      { notes: [...nextTask.notes, "Start blocked on approval"] }
    );
  }

  const deps = dependenciesSatisfied(nextTask, state);
  if (!deps.ok) {
    return transition(
      state,
      nextTask.id,
      "blocked",
      `Cannot start — unmet dependencies: ${deps.unmet.join(", ")}`,
      { blockReason: `Unmet dependencies: ${deps.unmet.join(", ")}` }
    );
  }

  const running = state.tasks.filter((task) => task.queueStatus === "running");
  if (running.length > 0) {
    return {
      state,
      task: nextTask,
      ok: false,
      message: `Another task is already running: ${running[0]?.id}`,
    };
  }

  return transition(
    state,
    nextTask.id,
    "running",
    `Started by scheduler — owner ${nextTask.ownership.primaryRoleName}`,
    {
      startedAt: new Date().toISOString(),
      lastError: null,
      retry: {
        ...nextTask.retry,
        attempts: nextTask.retry.attempts + (nextTask.queueStatus === "failed" ? 0 : 0),
      },
    }
  );
}

export function startTask(
  state: DirectorQueueState,
  taskId: string
): SchedulerTransitionResult {
  const task = getTask(state, taskId);
  if (!task) {
    return { state, task: null, ok: false, message: `Unknown task ${taskId}` };
  }
  if (task.queueStatus === "approval_required" || task.approvalRequired) {
    return transition(
      state,
      taskId,
      "approval_required",
      "Human approval required before running."
    );
  }
  if (task.queueStatus === "blocked") {
    return {
      state,
      task,
      ok: false,
      message: task.blockReason ?? "Task is blocked.",
    };
  }
  const deps = dependenciesSatisfied(task, state);
  if (!deps.ok) {
    return transition(
      state,
      taskId,
      "blocked",
      `Unmet dependencies: ${deps.unmet.join(", ")}`,
      { blockReason: `Unmet dependencies: ${deps.unmet.join(", ")}` }
    );
  }
  if (!["pending", "failed"].includes(task.queueStatus)) {
    return {
      state,
      task,
      ok: false,
      message: `Cannot start from status ${task.queueStatus}`,
    };
  }

  return transition(state, taskId, "running", "Task marked running.", {
    startedAt: new Date().toISOString(),
    lastError: null,
  });
}

export function completeTask(
  state: DirectorQueueState,
  taskId: string,
  note?: string
): SchedulerTransitionResult {
  const task = getTask(state, taskId);
  if (!task) {
    return { state, task: null, ok: false, message: `Unknown task ${taskId}` };
  }
  if (task.queueStatus !== "running") {
    return {
      state,
      task,
      ok: false,
      message: "Only running tasks can be completed.",
    };
  }
  return transition(state, taskId, "completed", note ?? "Task completed.", {
    completedAt: new Date().toISOString(),
    blockReason: null,
    lastError: null,
  });
}

export function failTask(
  state: DirectorQueueState,
  taskId: string,
  error: string
): SchedulerTransitionResult {
  const task = getTask(state, taskId);
  if (!task) {
    return { state, task: null, ok: false, message: `Unknown task ${taskId}` };
  }
  const attempts = task.retry.attempts + 1;
  return transition(state, taskId, "failed", error, {
    lastError: error,
    retry: { ...task.retry, attempts },
    notes: [...task.notes, `Failure: ${error}`],
  });
}

export function retryTask(
  state: DirectorQueueState,
  taskId: string
): SchedulerTransitionResult {
  const task = getTask(state, taskId);
  if (!task) {
    return { state, task: null, ok: false, message: `Unknown task ${taskId}` };
  }
  if (task.queueStatus !== "failed") {
    return {
      state,
      task,
      ok: false,
      message: "Only failed tasks can be retried.",
    };
  }
  if (task.retry.attempts >= task.retry.maxAttempts) {
    return {
      state,
      task,
      ok: false,
      message: "Retry policy exhausted — human intervention required.",
    };
  }
  if (task.approvalRequired) {
    return transition(
      state,
      taskId,
      "approval_required",
      "Retry moved to approval_required.",
      { lastError: null }
    );
  }
  return transition(state, taskId, "pending", "Retry queued as pending.", {
    lastError: null,
    blockReason: null,
  });
}

export function requestApproval(
  state: DirectorQueueState,
  taskId: string,
  reason?: string
): SchedulerTransitionResult {
  return transition(
    state,
    taskId,
    "approval_required",
    reason ?? "Marked approval_required by scheduler.",
    { approvalRequired: true }
  );
}

/** Human granted approval — return to pending if dependencies ok. */
export function grantApproval(
  state: DirectorQueueState,
  taskId: string
): SchedulerTransitionResult {
  const task = getTask(state, taskId);
  if (!task) {
    return { state, task: null, ok: false, message: `Unknown task ${taskId}` };
  }
  const deps = dependenciesSatisfied(task, state);
  if (!deps.ok) {
    return transition(
      state,
      taskId,
      "blocked",
      `Approved but blocked on dependencies: ${deps.unmet.join(", ")}`,
      {
        approvalRequired: false,
        blockReason: `Unmet dependencies: ${deps.unmet.join(", ")}`,
      }
    );
  }
  return transition(
    state,
    taskId,
    "pending",
    "Human approval granted — task pending.",
    { approvalRequired: false, blockReason: null }
  );
}

export function markBlocked(
  state: DirectorQueueState,
  taskId: string,
  reason: string
): SchedulerTransitionResult {
  return transition(state, taskId, "blocked", reason, { blockReason: reason });
}

export function getExecutionHistory(
  state: DirectorQueueState,
  options?: { taskId?: string; limit?: number }
): TaskHistoryEvent[] {
  let events = [...state.history].sort((a, b) => b.at.localeCompare(a.at));
  if (options?.taskId) {
    events = events.filter((event) => event.taskId === options.taskId);
  }
  if (options?.limit && options.limit > 0) {
    events = events.slice(0, options.limit);
  }
  return events;
}

export function getSchedulerView(state: DirectorQueueState) {
  const graph = buildDependencyGraph(state.tasks);
  const { daily } = buildDailyExecutionQueue(state);
  return {
    counts: {
      pending: state.tasks.filter((t) => t.queueStatus === "pending").length,
      running: state.tasks.filter((t) => t.queueStatus === "running").length,
      blocked: state.tasks.filter((t) => t.queueStatus === "blocked").length,
      completed: state.tasks.filter((t) => t.queueStatus === "completed").length,
      failed: state.tasks.filter((t) => t.queueStatus === "failed").length,
      approval_required: state.tasks.filter(
        (t) => t.queueStatus === "approval_required"
      ).length,
    },
    dependencyGraph: graph,
    daily,
    history: getExecutionHistory(state, { limit: 50 }),
  };
}
