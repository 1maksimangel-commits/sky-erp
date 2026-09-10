import { notFound } from "next/navigation";
import Link from "next/link";
import { CustomerProfileView } from "@/components/crm/CustomerProfileView";
import {
  getCrmAttachments,
  getCrmContacts,
  getCrmCustomerById,
  getCrmNotes,
  getCrmTimeline,
  getCrmLinkedContracts,
  getCrmLinkedDeals,
} from "@/lib/crm/db";

export default async function CrmCustomerPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const { data: customer, error } = await getCrmCustomerById(id);

  if (error || !customer) {
    notFound();
  }

  const [contacts, notes, timeline, attachments, contracts, deals] = await Promise.all([
    getCrmContacts(customer.id),
    getCrmNotes(customer.id),
    getCrmTimeline(customer.id),
    getCrmAttachments(customer.id),
    getCrmLinkedContracts(customer),
    getCrmLinkedDeals(customer),
  ]);

  return (
    <>
    <CustomerProfileView
      customer={customer}
      contacts={contacts.data}
      notes={notes.data}
      timeline={timeline.data}
      attachments={attachments.data}
    />
    <section className="mt-5 space-y-3 rounded-lg border border-border bg-card p-4" aria-label="Linked business records">
      <h3 className="text-sm font-semibold">Linked business records</h3>
      {[contacts, notes, timeline, attachments, contracts, deals].map((result, index) => result.error ? <p key={index} role="alert" className="text-sm text-destructive">{result.error}</p> : null)}
      {customer.counterparty_id ? <Link className="block text-sm underline" href={`/counterparties/${customer.counterparty_id}`}>Counterparty</Link> : <p className="text-sm text-muted-foreground">No canonical counterparty linked.</p>}
      {customer.company_id ? <Link className="block text-sm underline" href={`/companies/${customer.company_id}`}>Company</Link> : null}
      {deals.data.map(deal => <Link key={deal.id} className="block text-sm underline" href={`/business-cases/${deal.id}`}>Deal {deal.case_number}</Link>)}
      {contracts.data.map(contract => <Link key={contract.id} className="block text-sm underline" href={`/contracts/${contract.id}`}>Contract {contract.contract_number}</Link>)}
    </section>
    </>
  );
}
