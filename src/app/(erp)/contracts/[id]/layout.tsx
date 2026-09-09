import { notFound } from "next/navigation";
import { ContractWorkspaceShell } from "@/components/contracts/ContractWorkspaceShell";
import { getContractById, getRelatedContracts } from "@/lib/contracts/db";
import { getAccessContext } from "@/lib/platform/permissions";

export default async function ContractWorkspaceLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const { data: contract, error } = await getContractById(id);

  if (error || !contract) {
    notFound();
  }

  const relatedContracts = await getRelatedContracts(contract.deal_id, contract.id);
  const context = await getAccessContext();
  return <ContractWorkspaceShell contract={contract} relatedContracts={relatedContracts} selectedCompanyId={context?.companyId}>{children}</ContractWorkspaceShell>;
}
