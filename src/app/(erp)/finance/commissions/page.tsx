import { createClient } from "@/lib/supabase/server";
import { getFinanceOptions } from "@/lib/finance/db";
import { OperationalRecordsView } from "@/components/finance/OperationalRecordsView";

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<{ record?: string }> }) {
  const db = await createClient();
  const [records, options, params] = await Promise.all([
    db.from("deal_commission_links").select("id,company_id,business_case_id,contract_id,currency,status,label,expected_amount,basis,rate,base_quantity,base_amount,beneficiary_id").order("created_at", { ascending: false }),
    getFinanceOptions(), searchParams,
  ]);
  if (records.error) throw new Error(records.error.message);
  return <OperationalRecordsView kind="commissions" rows={records.data ?? []} categories={[]} options={options} recordId={params.record} />;
}
