import { Suspense } from "react";
import { CompaniesView } from "@/components/companies/CompaniesView";
import { getCompanies } from "@/lib/companies";

export default async function CompaniesPage() {
  const { data, error } = await getCompanies();

  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
      <CompaniesView companies={data} error={error} />
    </Suspense>
  );
}
