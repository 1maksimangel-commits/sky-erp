# SKY ERP Knowledge Base

## Purpose

Canonical engineering documentation for SKY ERP. Agents and developers read this before changing the system.

## Authority

1. **`AGENTS.md` (repository root)** — highest priority; never weakened by these docs.  
2. **Code + `supabase/migrations/`** — override outdated prose.  
3. **This `knowledge/` tree** — single authoritative topic docs.  
4. **`knowledge/Archive/`** — historical copies only; do not treat as current.

## Mandatory reading order

1. `AGENTS.md`  
2. `knowledge/README.md` (this file)  
3. `knowledge/DOCUMENTATION_INDEX.md`  
4. `01_ENGINEERING_POLICY.md`  
5. `05_SECURITY_AND_AGENT_BOUNDARIES.md`  
6. `02_SYSTEM_ARCHITECTURE.md`  
7. `03_DATABASE_AND_MIGRATIONS.md` and/or `04_BUSINESS_CONTEXT.md` as needed  
8. Relevant file under `Modules/`  
9. `Development/` and `Memory/KNOWN_ISSUES.md` when relevant  

## Tree

```text
knowledge/
  README.md
  DOCUMENTATION_INDEX.md
  DOCUMENTATION_AUDIT.md
  00_PROJECT_VISION.md
  01_ENGINEERING_POLICY.md
  02_SYSTEM_ARCHITECTURE.md
  03_DATABASE_AND_MIGRATIONS.md
  04_BUSINESS_CONTEXT.md
  05_SECURITY_AND_AGENT_BOUNDARIES.md
  Modules/
  Development/
  Roadmap/
  Memory/
  Archive/
```

## One topic → one document

See [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) for the full map of canonical vs archived files.

## Maintenance

- Update the matching canonical file when behavior changes.  
- Archive superseded docs; never silently delete knowledge.  
- Mark incomplete work **Planned**. Do not invent schema or APIs.
