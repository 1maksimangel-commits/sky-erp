import { createClient } from "@/lib/supabase/server";
import { getFinanceOptions } from "@/lib/finance/db";
import { OperationalRecordsView } from "@/components/finance/OperationalRecordsView";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ record?: string }> }) {
  const db = await createClient();
  const [records, categories, options, params] = await Promise.all([
    db.from("expenses").select("id,company_id,business_case_id,contract_id,currency,status,description,amount,supplier_id,category_id,shipment_id,expense_date").order("created_at", { ascending: false }),
    db.from("expense_categories").select("id,name").order("name"), getFinanceOptions(), searchParams,
  ]);
  if (records.error || categories.error) throw new Error(records.error?.message ?? categories.error?.message);
  return <OperationalRecordsView kind="expenses" rows={records.data ?? []} categories={categories.data ?? []} options={options} recordId={params.record} />;
}
