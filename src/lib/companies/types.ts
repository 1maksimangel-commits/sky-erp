export type CompanyFormInput = {
  code: string;
  name: string;
  short_name: string | null;
  country: string | null;
  city: string | null;
  tax_id: string | null;
  registration_number: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  is_active: boolean;
};

export const emptyCompanyForm = (): CompanyFormInput => ({
  code: "",
  name: "",
  short_name: null,
  country: null,
  city: null,
  tax_id: null,
  registration_number: null,
  email: null,
  phone: null,
  website: null,
  is_active: true,
});
