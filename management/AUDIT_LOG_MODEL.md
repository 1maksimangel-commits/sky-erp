# SKY ERP — Audit Log Model

**Status:** Planned design extending confirmed platform activity primitives  
**Related:** `AUTH_SYSTEM.md`, existing `activity_log` / `timeline_events` / `recordEntityEvent`

---

## 1. Current state (confirmed)

| Mechanism | Role today |
| --- | --- |
| `public.activity_log` + `log_activity` RPC | Entity-centric activity |
| `public.timeline_events` + `add_timeline_event` | Operator timeline |
| `recordEntityEvent` | Fan-out helper (activity + timeline + optional notification) |
| Login / logout audit | **Missing** |
| Dedicated immutable audit table | **Missing** |

Limitations: activity is best-effort; actor often free-text; no guaranteed login trail; open RLS on activity tables.

---

## 2. Target model (Planned)

### 2.1 `audit_events` (append-only)

Dedicated security/compliance log, separate from UX timeline.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| occurred_at | timestamptz | default now() |
| actor_user_id | uuid null | auth.users |
| actor_email | text null | denormalized for forensics |
| company_id | uuid null | active company when relevant |
| event_type | text | see catalog |
| entity_type | text null | |
| entity_id | uuid null | |
| summary | text | human readable |
| metadata | jsonb | non-secret context |
| ip_hash | text null | optional; never store raw secrets |
| user_agent | text null | optional truncated |
| request_id | text null | correlation |

**Rules:**

- Insert-only from trusted server paths / SECURITY DEFINER that checks `auth.uid()`  
- No update/delete for normal roles  
- Never store passwords, tokens, API keys, or full document contents  

### 2.2 Keep existing UX logs

| Store | Continues to serve |
| --- | --- |
| timeline_events | Entity story for operators |
| activity_log | Lightweight change feed |
| notifications | User alerts |

Mutating business actions should write **audit_events** (security) and may still call `recordEntityEvent` (UX).

---

## 3. Required event catalog

| event_type | When | Minimum metadata |
| --- | --- | --- |
| `login` | Successful session establishment | method (password/oauth Planned) |
| `logout` | Session end | |
| `login_failed` | Failed attempt (Planned) | reason code only |
| `record_create` | Insert of business entity | entity_type, entity_id |
| `record_update` | Update | entity_type, entity_id, changed_fields[] |
| `record_delete` | Delete/archive | entity_type, entity_id |
| `approval` | Approve/reject transition | entity_type, from_status, to_status |
| `payment` | Payment registered / voided | payment_id, invoice_id, amount, currency |
| `contract_signing` | Contract signed / countersigned | contract_id, signature_status |

Additional recommended (Planned): `permission_denied`, `company_switch`, `membership_change`, `export`.

---

## 4. Mapping to modules

| Action | audit event_type | Also UX? |
| --- | --- | --- |
| createContract / updateContract / deleteContract | record_* / contract_signing when applicable | yes |
| registerPayment | payment | yes |
| approve workflow (Planned) | approval | yes |
| CRM create/update/delete | record_* | optional |
| Warehouse stock RPC success | record_update / stock movement id | optional |
| Login page success (Planned) | login | no timeline |
| Logout (Planned) | logout | no timeline |

---

## 5. Retention & access (Planned policy)

| Topic | Rule |
| --- | --- |
| Who can read | `admin.audit` / Platform Admin / Company Owner / General Director |
| Retention | Configurable; do not purge from app without approval |
| Export | Audited itself |

---

## 6. Implementation sketch (not coded)

```text
Server Action success
  → business write
  → insert audit_events (event_type, actor, company_id, entity…)
  → recordEntityEvent(...) // existing UX fan-out
```

Login/logout handlers (Planned routes) write audit_events only.

---

## 7. Proposal SQL

See `supabase/migrations/20260805070000_auth_foundation_proposal.sql` for `audit_events` DDL proposal (not applied).
