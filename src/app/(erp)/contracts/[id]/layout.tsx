import { notFound } from "next/navigation";
import { ContractWorkspaceShell } from "@/components/contracts/ContractWorkspaceShell";
import { getContractById } from "@/lib/contracts/db";

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

  return (
    <ContractWorkspaceShell contract={contract}>{children}</ContractWorkspaceShell>
  );
}
