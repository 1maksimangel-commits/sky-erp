# SKY Runtime — AI Organization Control Plane

**Status:** Implemented (planning control plane)  
**Authority:** Subordinate to `AGENTS.md`  
**Code:** `src/lib/ai/runtime/`  
**Does not:** mutate business modules, touch Supabase, create migrations, commit, or push

---

## Mission

**SKY Runtime** is the central runtime of the AI Engineering Department. It binds the AI Director and specialist planning modules behind one typed API so agents and humans can initialize, load project context, plan, review, and report without scattering imports across the repository.

```text
Human / agent
  → SkyRuntime.initialize()
  → loadProject() / loadBacklog()
  → plan() → review() → report()
  → stop for human approval when gates require it
  → execute() reserved for a future specialist runner (NotImplementedError today)
  → shutdown()
```

---

## Location

| Path | Role |
| --- | --- |
| `src/lib/ai/runtime/runtime.ts` | `SkyRuntime` class and factories |
| `src/lib/ai/runtime/types.ts` | Strict TypeScript interfaces (no `any`) |
| `src/lib/ai/runtime/errors.ts` | `RuntimeError`, `NotImplementedError` |
| `src/lib/ai/runtime/index.ts` | Public barrel exports |

Underlying modules (loaded at initialize, not reimplemented):

| Module | Source |
| --- | --- |
| AI Director | `src/lib/ai/director/director.ts` |
| Planner | `src/lib/ai/director/planner.ts` |
| Dispatcher | `src/lib/ai/director/dispatcher.ts` |
| Queue | `src/lib/ai/director/queue.ts` |
| Reviewer | `src/lib/ai/director/reviewer.ts` |
| Reporter | `src/lib/ai/director/reporter.ts` |

---

## Runtime API

```ts
import { createSkyRuntime } from "@/lib/ai/runtime";

const runtime = createSkyRuntime();
await runtime.initialize({ repoRoot: process.cwd() });

const project = await runtime.loadProject();
const backlog = await runtime.loadBacklog();
const plan = await runtime.plan();
const review = await runtime.review();
const report = await runtime.report();

await runtime.shutdown();
```

| Method | Behavior |
| --- | --- |
| `initialize(config?)` | Bind Director, Planner, Dispatcher, Queue, Reviewer, Reporter; set status `ready` |
| `loadProject()` | Load Director inputs + enqueue backlog into Director queue snapshot |
| `loadBacklog()` | Return parsed backlog items, roles, unfinished count |
| `plan()` | Rank backlog, dispatch specialists, build execution plan |
| `execute()` | Throws `NotImplementedError` (specialist runner is a future module) |
| `review()` | Run Reviewer approval-gate analysis on current plan |
| `report()` | Build Director markdown report for the session |
| `shutdown()` | Unbind modules, clear session, status `shut_down` |
| `getStatus()` / `getConfig()` / `getModules()` | Introspection |

Also available: `getSkyRuntime()` (shared instance), `resetSkyRuntimeForTests()`.

---

## Lifecycle

```text
uninitialized
    │ initialize()
    ▼
  ready  ←── plan / review / report / load*
    │ shutdown()
    ▼
 shut_down
```

- Calling API methods before `initialize()` throws `RuntimeError`.
- Re-`initialize()` while `ready` throws; call `shutdown()` first.
- `execute()` always throws `NotImplementedError` while ready (by design).

---

## Safety boundaries

| Allowed | Forbidden |
| --- | --- |
| Read management / knowledge markdown via Director loaders | Business module edits |
| Local planning, ranking, queue snapshots | Supabase access |
| Review gates + markdown reports | Migrations / remote apply |
| Typed errors for missing future modules | Commit / push / shell execution from Runtime |

Runtime remains subordinate to `management/APPROVAL_MATRIX.md` and `AGENTS.md`.

---

## Errors

| Error | When |
| --- | --- |
| `RuntimeError` | Invalid lifecycle (not ready, double init, missing report inputs) |
| `NotImplementedError` | `execute()` until a future agent-execution module exists |

---

## Relationship to AI Director

SKY Runtime **does not replace** the AI Director. It **hosts** it.

- Director: triage, priority, plan, queue, review, report algorithms  
- Runtime: process lifecycle + single API + module binding  

Specialists still execute work outside this process (Cursor agents / humans) until an execution module is approved and implemented.
