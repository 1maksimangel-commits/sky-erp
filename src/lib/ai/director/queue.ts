import {
  compareTasksByPriority,
  createTaskFromBacklog,
  remapDependencies,
  type DirectorTask,
  type DirectorTaskStatus,
} from "./task";
import {
  appendHistory,
  createEmptyQueueState,
  getTask,
  listTasksByStatus,
  upsertTask,
  type DirectorQueueState,
} from "./state";
import type { BacklogItem, SpecialistRole } from "./types";

export type DependencyGraph = {
  nodes: string[];
  edges: Array<{ from: string; to: string }>;
  /** taskId → dependency task ids */
  adjacency: Record<string, string[]>;
  cycles: string[][];
};

export function buildDependencyGraph(tasks: DirectorTask[]): DependencyGraph {
  const ids = new Set(tasks.map((task) => task.id));
  const adjacency: Record<string, string[]> = {};
  const edges: Array<{ from: string; to: string }> = [];

  for (const task of tasks) {
    adjacency[task.id] = task.dependsOn.filter((dep) => ids.has(dep));
    for (const dep of adjacency[task.id]) {
      edges.push({ from: dep, to: task.id });
    }
  }

  const cycles = detectCycles(adjacency);
  return {
    nodes: [...ids],
    edges,
    adjacency,
    cycles,
  };
}

function detectCycles(adjacency: Record<string, string[]>): string[][] {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycles: string[][] = [];
  const stack: string[] = [];

  function dfs(node: string) {
    if (visiting.has(node)) {
      const idx = stack.indexOf(node);
      cycles.push(stack.slice(idx).concat(node));
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    stack.push(node);
    for (const next of adjacency[node] ?? []) {
      dfs(next);
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of Object.keys(adjacency)) {
    dfs(node);
  }
  return cycles;
}

export function dependenciesSatisfied(
  task: DirectorTask,
  state: DirectorQueueState
): { ok: boolean; unmet: string[] } {
  const unmet: string[] = [];
  for (const depId of task.dependsOn) {
    const dep = getTask(state, depId);
    if (!dep) {
      unmet.push(`${depId} (missing)`);
      continue;
    }
    if (dep.queueStatus !== "completed") {
      unmet.push(`${depId} (${dep.queueStatus})`);
    }
  }
  return { ok: unmet.length === 0, unmet };
}

export function sortByPriority(tasks: DirectorTask[]): DirectorTask[] {
  return [...tasks].sort(compareTasksByPriority);
}

export function enqueueBacklogItems(
  state: DirectorQueueState,
  backlog: BacklogItem[],
  roles: SpecialistRole[]
): DirectorQueueState {
  let next = state;
  const created: DirectorTask[] = [];
  const backlogIdToTaskId = new Map<string, string>();

  for (const item of backlog) {
    const task = createTaskFromBacklog(item, roles, backlog);
    backlogIdToTaskId.set(item.id, task.id);
    created.push(task);
  }

  const remapped = remapDependencies(created, backlogIdToTaskId);
  for (const task of remapped) {
    next = upsertTask(next, task);
    next = appendHistory(next, {
      taskId: task.id,
      fromStatus: null,
      toStatus: task.queueStatus,
      message: `Enqueued from backlog: ${task.title}`,
    });
  }

  return next;
}

export function listQueue(
  state: DirectorQueueState,
  status?: DirectorTaskStatus
): DirectorTask[] {
  const tasks = status ? listTasksByStatus(state, status) : [...state.tasks];
  return sortByPriority(tasks);
}

export function getPendingReady(state: DirectorQueueState): DirectorTask[] {
  return sortByPriority(
    state.tasks.filter((task) => {
      if (task.queueStatus !== "pending") return false;
      return dependenciesSatisfied(task, state).ok;
    })
  );
}

export function queueSnapshot(state: DirectorQueueState): Record<
  DirectorTaskStatus,
  number
> {
  const counts: Record<DirectorTaskStatus, number> = {
    pending: 0,
    running: 0,
    blocked: 0,
    completed: 0,
    failed: 0,
    approval_required: 0,
  };
  for (const task of state.tasks) {
    counts[task.queueStatus] += 1;
  }
  return counts;
}

export function createQueueFromBacklog(
  backlog: BacklogItem[],
  roles: SpecialistRole[]
): DirectorQueueState {
  return enqueueBacklogItems(createEmptyQueueState(), backlog, roles);
}
