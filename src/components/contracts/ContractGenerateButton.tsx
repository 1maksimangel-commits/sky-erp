import Link from "next/link";
import { FileText } from "lucide-react";
export function ContractGenerateButton({ contractId }: { contractId: string }) {
  return <Link href={`/documents/generate?contractId=${contractId}`} className="inline-flex items-center gap-2 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background"><FileText className="h-4 w-4" />Generate Documents</Link>;
}
