"use client";
import { useRouter } from "next/navigation";
import { ContractImportReviewWorkspace } from "./ContractImportReviewWorkspace";
import type { ComponentProps } from "react";

export function ContractImportPageClient(props: Omit<ComponentProps<typeof ContractImportReviewWorkspace>, "onClose" | "onCompleted">) {
  const router = useRouter();
  return <ContractImportReviewWorkspace {...props} onClose={() => router.push("/contracts")} onCompleted={(_message,href) => { if (href) router.push(href); else router.refresh(); }} />;
}
