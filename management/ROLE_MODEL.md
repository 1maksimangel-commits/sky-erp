# SKY ERP — Role Model

**Status:** Planned design (not wired in application code)  
**Related:** `PERMISSION_MATRIX.md`, `AUTH_SYSTEM.md`, `COMPANY_MODEL.md`

## Current vs target

| Layer | Current (confirmed) | Target (Planned) |
| --- | --- | --- |
| Codes in app | `admin`, `finance`, `sales`, `logistics`, `warehouse`, `management`, `readonly` | Expanded ERP roles below |
| Binding | Global `user_profiles.role_code` (unused by session) | Per-company `company_memberships.role_code` |
| Runtime | Always `admin` stub | Session + membership |

AGENTS.md historically lists Admin / Management / Finance / Sales / Warehouse / Logistics / Read Only. The model below **extends** that list for seafood-trading operations; mapping notes are included.

---

## Required roles

| Code (Planned) | Display name | Scope | Mission |
| --- | --- | --- | --- |
| `platform_admin` | Platform Admin | Cross-company | Operate the platform; manage companies, memberships, global settings |
| `company_owner` | Company Owner | One company | Full company authority short of platform teardown |
| `general_director` | General Director | One company | Executive oversight; approve major commercial/finance actions |
| `commercial_director` | Commercial Director | One company | Own commercial strategy; contracts & CRM leadership |
| `sales_manager` | Sales Manager | One company | Sales contracts, customers, quotations path |
| `purchasing_manager` | Purchasing Manager | One company | Purchase side, suppliers, procurement contracts |
| `logistics_manager` | Logistics Manager | One company | Shipments, bookings, logistics docs |
| `warehouse_manager` | Warehouse Manager | One company | Inventory, lots, warehouse ops |
| `finance_manager` | Finance Manager | One company | Invoices, payments, banks, FX policy |
| `accountant` | Accountant | One company | Day-to-day finance posting; limited setup |
| `legal` | Legal | One company | Contracts review, compliance docs, restricted finance write |
| `operator` | Operator | One company | Day-to-day data entry within assigned modules |
| `read_only` | Read Only | One company | Read across allowed modules; no writes |
| `external_customer` | External Customer | One company + linked buyer | Portal-limited view of own contracts/shipments/invoices |
| `external_supplier` | External Supplier | One company + linked supplier | Portal-limited view of own POs/shipments/docs |

### Mapping from current seed roles

| Current code | Suggested migration target |
| --- | --- |
| `admin` | `platform_admin` (or company_owner if single-tenant interim) |
| `management` | `general_director` |
| `finance` | `finance_manager` |
| `sales` | `sales_manager` |
| `logistics` | `logistics_manager` |
| `warehouse` | `warehouse_manager` |
| `readonly` | `read_only` |

---

## Role attributes

| Attribute | Rule |
| --- | --- |
| Multi-company | Only `platform_admin` may switch across companies without membership (still audited) |
| Membership required | All other roles require active `company_memberships` row |
| External roles | Must also link `counterparty_id` (buyer/supplier) — Planned column on membership |
| Least privilege | Default deny; grant via matrix |
| Separation of duties | Approvals (Planned) should not be self-approved for high-value payments/contracts |

---

## Forbidden combinations (Planned policy)

| Rule |
| --- |
| External roles must not receive Administration or cross-company CRM write |
| `read_only` must not receive `*.write` or approve permissions |
| `accountant` must not change bank master data without `finance_manager` (Planned control) |
| No role bypasses RLS except via explicit SECURITY DEFINER functions that re-check membership |

---

## Session shape (Planned)

```text
{
  userId: uuid,           -- auth.users.id
  profileId: uuid,        -- user_profiles.id
  activeCompanyId: uuid,  -- resolved company
  roleCode: string,       -- membership role for that company
  permissions: string[],  -- expanded from matrix / roles.permissions
  counterpartyId?: uuid   -- external roles only
}
```
