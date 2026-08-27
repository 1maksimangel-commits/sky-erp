import type { DirectorTask, TaskHistoryEvent } from "./task";

export type DirectorQueueState = {
  version: 1;
  updatedAt: string;
  tasks: DirectorTask[];
  history: TaskHistoryEvent[];
  dailyDate: string | null;
  dailyOrderedTaskIds: string[];
};

export function createEmptyQueueState(): DirectorQueueState {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    tasks: [],
    history: [],
    dailyDate: null,
    dailyOrderedTaskIds: [],
  };
}

export function cloneQueueState(state: DirectorQueueState): DirectorQueueState {
  return structuredClone(state);
}

export function appendHistory(
  state: DirectorQueueState,
  event: Omit<TaskHistoryEvent, "at"> & { at?: string }
): DirectorQueueState {
  const next = cloneQueueState(state);
  next.history.push({
    at: event.at ?? new Date().toISOString(),
    taskId: event.taskId,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    message: event.message,
  });
  next.updatedAt = new Date().toISOString();
  return next;
}

export function upsertTask(
  state: DirectorQueueState,
  task: DirectorTask
): DirectorQueueState {
  const next = cloneQueueState(state);
  const idx = next.tasks.findIndex((item) => item.id === task.id);
  if (idx >= 0) {
    next.tasks[idx] = task;
  } else {
    next.tasks.push(task);
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

export function getTask(
  state: DirectorQueueState,
  taskId: string
): DirectorTask | null {
  return state.tasks.find((task) => task.id === taskId) ?? null;
}

export function listTasksByStatus(
  state: DirectorQueueState,
  status: DirectorTask["queueStatus"]
): DirectorTask[] {
  return state.tasks.filter((task) => task.queueStatus === status);
}

export function serializeQueueState(state: DirectorQueueState): string {
  return JSON.stringify(state, null, 2);
}

export function deserializeQueueState(json: string): DirectorQueueState {
  const parsed = JSON.parse(json) as DirectorQueueState;
  if (parsed.version !== 1 || !Array.isArray(parsed.tasks)) {
    throw new Error("AI Director: invalid queue state payload.");
  }
  return {
    version: 1,
    updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    tasks: parsed.tasks ?? [],
    history: parsed.history ?? [],
    dailyDate: parsed.dailyDate ?? null,
    dailyOrderedTaskIds: parsed.dailyOrderedTaskIds ?? [],
  };
}

/** In-memory store for a single process (no Supabase, no remotes). */
export class DirectorStateStore {
  private state: DirectorQueueState;

  constructor(initial?: DirectorQueueState) {
    this.state = initial ? cloneQueueState(initial) : createEmptyQueueState();
  }

  getState(): DirectorQueueState {
    return cloneQueueState(this.state);
  }

  setState(state: DirectorQueueState): void {
    this.state = cloneQueueState(state);
  }

  update(mutator: (state: DirectorQueueState) => DirectorQueueState): DirectorQueueState {
    this.state = mutator(this.getState());
    return this.getState();
  }
}
