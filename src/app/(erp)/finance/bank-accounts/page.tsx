import { BankAccountsView } from "@/components/finance/BankAccountsView";
import { getBankAccounts, getFinanceOptions } from "@/lib/finance/db";

export default async function BankAccountsPage() {
  const [{ data, error }, options] = await Promise.all([
    getBankAccounts(),
    getFinanceOptions(),
  ]);

  return (
    <BankAccountsView accounts={data} options={options} error={error} />
  );
}
