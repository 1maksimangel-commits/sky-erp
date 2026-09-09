import { redirect } from "next/navigation";

export default function NewContractPage() {
  redirect("/contracts?new=1");
}
