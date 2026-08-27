import { notFound } from "next/navigation";
import { CustomerProfileView } from "@/components/crm/CustomerProfileView";
import {
  getCrmAttachments,
  getCrmContacts,
  getCrmCustomerById,
  getCrmNotes,
  getCrmTimeline,
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

  const [contacts, notes, timeline, attachments] = await Promise.all([
    getCrmContacts(customer.id),
    getCrmNotes(customer.id),
    getCrmTimeline(customer.id),
    getCrmAttachments(customer.id),
  ]);

  return (
    <CustomerProfileView
      customer={customer}
      contacts={contacts.data}
      notes={notes.data}
      timeline={timeline.data}
      attachments={attachments.data}
    />
  );
}
