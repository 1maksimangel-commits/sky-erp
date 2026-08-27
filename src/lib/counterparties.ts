import { createClient } from "@/lib/supabase/server";

export type Counterparty = {
  id: string;
  code: string | null;
  legal_name: string;
  short_name: string | null;
  counterparty_type: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  tax_id: string | null;
  registration_number: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  is_active: boolean;
};

export type CounterpartyStats = {
  total: number;
  active: number;
  inactive: number;
  types: number;
};

export type CounterpartiesResult =
  | { data: Counterparty[]; stats: CounterpartyStats; error: null }
  | { data: null; stats: null; error: string };

const counterpartyColumns =
  "id, code, legal_name, short_name, counterparty_type, country, city, address, tax_id, registration_number, email, phone, website, is_active" as const;

function computeStats(counterparties: Counterparty[]): CounterpartyStats {
  const types = new Set(
    counterparties
      .map((item) => item.counterparty_type)
      .filter((type): type is string => Boolean(type))
  );

  return {
    total: counterparties.length,
    active: counterparties.filter((item) => item.is_active).length,
    inactive: counterparties.filter((item) => !item.is_active).length,
    types: types.size,
  };
}

export async function getCounterparties(): Promise<CounterpartiesResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("counterparties")
    .select(counterpartyColumns)
    .order("legal_name");

  if (error) {
    return {
      data: null,
      stats: null,
      error: error.message || "Unable to load counterparties from Supabase.",
    };
  }

  const counterparties = data ?? [];

  return {
    data: counterparties,
    stats: computeStats(counterparties),
    error: null,
  };
}

export type CounterpartyResult =
  | { data: Counterparty; error: null }
  | { data: null; error: string };

export async function getCounterpartyById(
  id: string
): Promise<CounterpartyResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("counterparties")
    .select(counterpartyColumns)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  if (!data) {
    return { data: null, error: "Counterparty not found." };
  }

  return { data: data as Counterparty, error: null };
}

export async function getActiveCounterparties(): Promise<CounterpartiesResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("counterparties")
    .select(counterpartyColumns)
    .eq("is_active", true)
    .order("legal_name");

  if (error) {
    return {
      data: null,
      stats: null,
      error: error.message || "Unable to load counterparties from Supabase.",
    };
  }

  const counterparties = data ?? [];

  return {
    data: counterparties,
    stats: computeStats(counterparties),
    error: null,
  };
}
