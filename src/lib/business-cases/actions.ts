"use server";
import { saveDealCore } from "@/lib/deals/actions";
import type { BusinessCaseFormInput } from "@/lib/business-cases/types";
export type CreateBusinessCaseResult = { success: true; id?: string } | { success: false; error: string };
/** Compatibility action name for existing create forms. */
export async function createBusinessCase(input: BusinessCaseFormInput): Promise<CreateBusinessCaseResult> {
  return saveDealCore(null,input);
}
