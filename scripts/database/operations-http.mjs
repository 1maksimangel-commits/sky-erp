import { verifyShipmentsHttp } from './shipments-http.mjs';
import { verifyWarehouseHttp } from './warehouse-http.mjs';
import { verifyFinanceHttp } from './finance-http.mjs';

// Invoked only inside canonical replay with fictional users and a fresh local DB.
export async function verifyOperationsHttp(core) {
  await verifyShipmentsHttp(core);
  await verifyWarehouseHttp(core);
  await verifyFinanceHttp(core);
  const check = (ok, message) => { if (!ok) throw new Error(`Operations: ${message}`); };
  for (const fixture of core.fixtures) {
    const load = fixture.user.load;
    const crm = load('src/lib/crm/actions.ts');
    const created = await crm.createCrmCustomer({ ...load('src/lib/crm/types.ts').emptyCrmCustomerForm(), company_name: 'Fictional operations customer', legal_name: 'Fictional operations customer', counterparty_id: fixture.parties[0] });
    check(created.success, `CRM create: ${created.error ?? ''}`);
    fixture.crmId = created.data.id;
    const db = load('src/lib/crm/db.ts');
    const read = await db.getCrmCustomerById(fixture.crmId);
    check(!read.error && read.data.company_id === fixture.company && read.data.counterparty_id === fixture.parties[0], 'CRM canonical Company / Counterparty references');
    const deals = await db.getCrmLinkedDeals(read.data);
    const contracts = await db.getCrmLinkedContracts(read.data);
    check(!deals.error && deals.data.some(row => row.id === fixture.deal) && !contracts.error, 'CRM canonical Deal and legal Contract party loaders');
    for (const fn of [db.getCrmCustomers, db.getCrmDashboardStats]) check(!(await fn()).error, 'CRM list loader schema/RLS');
    const linked = await load('src/lib/operations/db.ts').getOperationalRecords({ dealId: fixture.deal });
    check(!linked.error, `Deal operational view: ${linked.error ?? ''}`);
    for (const group of linked.groups) check(new Set(group.rows.map(row => row.id)).size === group.rows.length, `duplicate ${group.label} records`);
    const foreign = core.fixtures.find(other => other.company !== fixture.company);
    const hidden = await load('src/lib/operations/db.ts').getOperationalRecords({ dealId: foreign.deal });
    check(!hidden.error, 'foreign Deal filter safely respects per-record RLS');
    // Explicitly shared internal transactions may be visible, private records may not.
    const privateRows = linked.groups.flatMap(group => group.rows).filter(row => !row.contractId);
    const foreignView = await foreign.user.load('src/lib/operations/db.ts').getOperationalRecords({ dealId: fixture.deal });
    check(!foreignView.error && !foreignView.groups.some(group => group.rows.some(row => privateRows.some(own => own.id === row.id))), 'private operations isolated');
    const contract = await load('src/lib/operations/db.ts').getOperationalRecords({ contractId: fixture.contractId });
    check(!contract.error && contract.groups.filter(group => group.label !== 'Payments').every(group => group.rows.every(row => row.contractId === fixture.contractId)), 'Contract operational traceability');
    const finance = await load('src/lib/contracts/finance.ts').getContractFinance(fixture.contractId, 'Unused display number', 100000, 'USD');
    check(!finance.error, 'Contract finance canonical allocation loader');
    const expected = contract.groups.find(group => group.label === 'Payments').rows;
    check(finance.payments.every(payment => expected.some(row => row.id === payment.id)), 'Contract finance does not graft unrelated Deal payments');
  }
  console.log('Operations: shipment, inventory ownership, financial allocations, exact calculations, original currencies, CRM and Deal/Contract traceability passed.');
}
