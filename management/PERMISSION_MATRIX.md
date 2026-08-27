# SKY ERP — Permission Matrix

**Status:** Planned design  
**Legend**

| Symbol | Meaning |
| --- | --- |
| F | Full (read/write/delete/archive within company) |
| W | Write (create/update; delete limited) |
| R | Read |
| A | Approve (status transitions / signing / payment release) |
| P | Portal — own linked counterparty records only |
| — | No access |

Modules: **CRM · Contracts · Finance · Warehouse · Logistics · Documents · Analytics · Administration**

Permission keys (Planned) follow `module.action` style used today (`contracts.write`, `finance.read`, …), extended as needed (`contracts.approve`, `admin.memberships`, `analytics.read`).

---

## Role × module matrix

| Role | CRM | Contracts | Finance | Warehouse | Logistics | Documents | Analytics | Administration |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Platform Admin | F | F | F | F | F | F | F | F |
| Company Owner | F | F | F | F | F | F | F | F* |
| General Director | R+A | R+A | R+A | R | R | R | F | R |
| Commercial Director | F | F+A | R | R | R | W | F | — |
| Sales Manager | F | W+A† | R | R | R | W | R | — |
| Purchasing Manager | F‡ | W+A† | R | R | R | W | R | — |
| Logistics Manager | R | R | R | R | F | W | R | — |
| Warehouse Manager | R | R | — | F | R | W | R | — |
| Finance Manager | R | R | F+A | R | R | W | F | — |
| Accountant | R | R | W | — | R | W | R | — |
| Legal | R | R+A | R | — | R | W | R | — |
| Operator | W | W | R | W | W | W | R | — |
| Read Only | R | R | R | R | R | R | R | — |
| External Customer | P | P | P | — | P | P | — | — |
| External Supplier | P | P | — | — | P | P | — | — |

\* Company Owner: company-scoped admin (memberships, company settings); **not** platform teardown / global role catalog.  
† Sales vs Purchasing: write scoped to sales vs purchase contract types when modeled.  
‡ Purchasing CRM focus: suppliers; Sales CRM focus: buyers — both use CRM module with data filters (Planned).

---

## Permission groups by module

### CRM

| Permission | Description |
| --- | --- |
| `crm.read` | View customers, contacts, timeline, notes |
| `crm.write` | Create/update customers, contacts, notes, tasks |
| `crm.delete` | Archive/delete CRM records |
| `crm.export` | Export customer lists (Planned) |

### Contracts

| Permission | Description |
| --- | --- |
| `contracts.read` | View contracts and hub tabs |
| `contracts.write` | Create/update contracts, lines, hub ops |
| `contracts.delete` | Delete/cancel contracts (restricted) |
| `contracts.approve` | Approve / sign workflow transitions |
| `contracts.import` | PDF AI import + confirm |

### Finance

| Permission | Description |
| --- | --- |
| `finance.read` | Invoices, payments, banks, FX, reports |
| `finance.write` | Create invoices, register payments, expenses |
| `finance.approve` | Approve payments / release |
| `finance.setup` | Bank accounts, FX master edits |

### Warehouse

| Permission | Description |
| --- | --- |
| `warehouse.read` | Locations, lots, stock views |
| `warehouse.write` | Receive/issue/transfer/adjust |
| `warehouse.setup` | Location master data |

### Logistics

| Permission | Description |
| --- | --- |
| `logistics.read` | Shipments, timelines |
| `logistics.write` | Create/update shipments |
| `logistics.delete` | Delete shipments (restricted) |

### Documents

| Permission | Description |
| --- | --- |
| `documents.read` | Library + signed download (ACL-aware Planned) |
| `documents.write` | Upload/version |
| `documents.delete` | Delete documents |

### Analytics

| Permission | Description |
| --- | --- |
| `analytics.read` | Dashboards and reports (`/finance/reports`, future `/reports`) |
| `analytics.export` | Export report data (Planned) |

### Administration

| Permission | Description |
| --- | --- |
| `admin.companies` | Manage companies (platform / owner) |
| `admin.memberships` | Invite/assign roles per company |
| `admin.roles` | Edit role catalog (platform) |
| `admin.settings` | System settings |
| `admin.audit` | View audit log |

---

## Suggested grant lists (Planned seed)

Compact grants for `roles.permissions` jsonb (illustrative):

| Role | Grants |
| --- | --- |
| platform_admin | `["*"]` |
| company_owner | `["crm.*","contracts.*","finance.*","warehouse.*","logistics.*","documents.*","analytics.*","admin.memberships","admin.settings","admin.audit"]` |
| general_director | `["*.read","contracts.approve","finance.approve","crm.read","analytics.*","admin.audit"]` |
| commercial_director | `["crm.*","contracts.*","documents.*","analytics.read","finance.read","warehouse.read","logistics.read"]` |
| sales_manager | `["crm.*","contracts.read","contracts.write","contracts.approve","contracts.import","documents.*","finance.read","logistics.read","warehouse.read","analytics.read"]` |
| purchasing_manager | `["crm.*","contracts.read","contracts.write","contracts.approve","documents.*","finance.read","logistics.read","warehouse.read","analytics.read"]` |
| logistics_manager | `["logistics.*","contracts.read","warehouse.read","documents.*","crm.read","finance.read","analytics.read"]` |
| warehouse_manager | `["warehouse.*","products.read","logistics.read","documents.*","contracts.read","analytics.read"]` |
| finance_manager | `["finance.*","documents.*","contracts.read","crm.read","logistics.read","warehouse.read","analytics.*"]` |
| accountant | `["finance.read","finance.write","documents.*","contracts.read","analytics.read"]` |
| legal | `["contracts.read","contracts.approve","documents.*","crm.read","finance.read","analytics.read"]` |
| operator | `["crm.write","crm.read","contracts.write","contracts.read","logistics.write","logistics.read","warehouse.write","warehouse.read","documents.*","finance.read","analytics.read"]` |
| read_only | `["*.read"]` |
| external_customer | `["contracts.read","logistics.read","finance.read","documents.read"]` + portal filter |
| external_supplier | `["contracts.read","logistics.read","documents.read"]` + portal filter |

Portal filter = enforce `counterparty_id` match in RLS and queries (Planned).

---

## Enforcement points (Planned)

1. **Middleware / route meta** — coarse module access  
2. **`assertCan` in Server Actions** — fine-grained  
3. **RLS** — company (+ portal) isolation even if app bugs  
4. **UI** — hide controls; never sole control  

---

## Conflicts with current code

| Current | Design |
| --- | --- |
| `RoleCode` union in `src/lib/platform/types.ts` | Must expand when implementation is approved |
| Seeded `roles` rows (7 codes) | Additive seed of new codes; migrate old codes |
| Stub `getCurrentRole()` | Replace only with approved auth batch |
