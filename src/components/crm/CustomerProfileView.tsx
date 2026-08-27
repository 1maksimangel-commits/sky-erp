"use client";

import {
  Archive,
  Download,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CustomerFormModal } from "@/components/crm/CustomerFormModal";
import { PageActions } from "@/components/layout/ShellContext";
import { DetailGrid, DetailItem } from "@/components/platform/DetailGrid";
import { Toast } from "@/components/ui/Toast";
import {
  archiveCrmCustomer,
  createCrmContact,
  createCrmNote,
  createCrmTimelineEvent,
  deleteCrmAttachment,
  deleteCrmContact,
  deleteCrmCustomer,
  uploadCrmAttachment,
} from "@/lib/crm/actions";
import { formatCrmDate, formatCrmDateTime } from "@/lib/crm/format";
import {
  CRM_LANGUAGES,
  CRM_TIMELINE_TYPES,
  displayLegalName,
  type CrmAttachment,
  type CrmContact,
  type CrmCustomer,
  type CrmNote,
  type CrmTimelineEvent,
  type CrmTimelineType,
} from "@/lib/crm/types";
import {
  CRM_ATTACHMENT_ACCEPT,
  validateCrmAttachmentFile,
} from "@/lib/crm/validation";
import { formatFileSize } from "@/lib/documents/format";

const TABS = [
  "Company",
  "Contacts",
  "Business",
  "Timeline",
  "Attachments",
  "Notes",
] as const;

type Tab = (typeof TABS)[number];

type CustomerProfileViewProps = {
  customer: CrmCustomer;
  contacts: CrmContact[];
  notes: CrmNote[];
  timeline: CrmTimelineEvent[];
  attachments: CrmAttachment[];
};

const inputClassName =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

const emptyContactForm = {
  full_name: "",
  position: "",
  mobile: "",
  office_phone: "",
  email: "",
  wechat: "",
  whatsapp: "",
  telegram: "",
  language: "",
  birthday: "",
  notes: "",
  is_primary: false,
};

function timelineTone(type: string): string {
  switch (type) {
    case "Call":
      return "bg-sky-500/15 text-sky-300";
    case "Meeting":
      return "bg-violet-500/15 text-violet-300";
    case "Email":
      return "bg-amber-500/15 text-amber-300";
    case "Quote":
      return "bg-cyan-500/15 text-cyan-300";
    case "Contract":
      return "bg-emerald-500/15 text-emerald-300";
    case "Shipment":
      return "bg-orange-500/15 text-orange-300";
    case "Payment":
      return "bg-lime-500/15 text-lime-300";
    default:
      return "bg-zinc-500/15 text-zinc-300";
  }
}

export function CustomerProfileView({
  customer,
  contacts,
  notes,
  timeline,
  attachments,
}: CustomerProfileViewProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Company");
  const [editOpen, setEditOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [contactForm, setContactForm] = useState(emptyContactForm);
  const [timelineForm, setTimelineForm] = useState({
    event_type: "Call" as CrmTimelineType,
    title: "",
    description: "",
    event_at: "",
  });
  const [attachmentTitle, setAttachmentTitle] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<string>("all");

  const legalName = displayLegalName(customer);
  const filteredTimeline =
    timelineFilter === "all"
      ? timeline
      : timeline.filter((item) => item.event_type === timelineFilter);

  async function handleArchive() {
    setBusy(true);
    const result = await archiveCrmCustomer(customer.id);
    setBusy(false);
    if (!result.success) {
      setToast(result.error);
      return;
    }
    setToast("Customer archived.");
    router.refresh();
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${legalName}?`)) return;
    setBusy(true);
    const result = await deleteCrmCustomer(customer.id);
    setBusy(false);
    if (!result.success) {
      setToast(result.error);
      return;
    }
    router.push("/crm");
  }

  return (
    <div className="space-y-5">
      <PageActions>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleArchive()}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs"
        >
          <Archive className="h-3.5 w-3.5" />
          Archive
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleDelete()}
          className="inline-flex items-center gap-2 rounded-md border border-red-500/30 px-3 py-2 text-xs text-red-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </PageActions>

      <CustomerFormModal
        open={editOpen}
        customer={customer}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          router.refresh();
          setToast("Customer updated.");
        }}
      />

      {toast ? <Toast message={toast} onClose={() => setToast(null)} /> : null}

      <div className="erp-panel p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {legalName}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {customer.short_name ? `${customer.short_name} · ` : ""}
              {customer.contact_person ?? "No primary contact"} ·{" "}
              {customer.customer_type ?? customer.category} · {customer.status}
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            {[customer.city, customer.country].filter(Boolean).join(", ") ||
              "Location not set"}
            <br />
            Next follow-up: {formatCrmDate(customer.next_follow_up_at)}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === item
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            {item}
            {item === "Contacts" && contacts.length
              ? ` (${contacts.length})`
              : ""}
            {item === "Attachments" && attachments.length
              ? ` (${attachments.length})`
              : ""}
          </button>
        ))}
      </div>

      {tab === "Company" ? (
        <div className="erp-panel p-5">
          <DetailGrid>
            <DetailItem label="Legal name" value={legalName} />
            <DetailItem label="Short name" value={customer.short_name} />
            <DetailItem label="Country" value={customer.country} />
            <DetailItem label="City" value={customer.city} />
            <DetailItem label="Address" value={customer.address} />
            <DetailItem label="Website" value={customer.website} />
            <DetailItem label="Tax ID" value={customer.tax_id} />
            <DetailItem label="Status" value={customer.status} />
          </DetailGrid>
        </div>
      ) : null}

      {tab === "Contacts" ? (
        <div className="space-y-4">
          <form
            className="erp-panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              const result = await createCrmContact({
                customerId: customer.id,
                ...contactForm,
                birthday: contactForm.birthday || null,
              });
              setBusy(false);
              if (!result.success) {
                setToast(result.error);
                return;
              }
              setContactForm(emptyContactForm);
              setToast("Contact added.");
              router.refresh();
            }}
          >
            <input
              required
              placeholder="Name"
              value={contactForm.full_name}
              onChange={(e) =>
                setContactForm((c) => ({ ...c, full_name: e.target.value }))
              }
              className={inputClassName}
            />
            <input
              placeholder="Position"
              value={contactForm.position}
              onChange={(e) =>
                setContactForm((c) => ({ ...c, position: e.target.value }))
              }
              className={inputClassName}
            />
            <input
              placeholder="Mobile"
              value={contactForm.mobile}
              onChange={(e) =>
                setContactForm((c) => ({ ...c, mobile: e.target.value }))
              }
              className={inputClassName}
            />
            <input
              placeholder="Office phone"
              value={contactForm.office_phone}
              onChange={(e) =>
                setContactForm((c) => ({ ...c, office_phone: e.target.value }))
              }
              className={inputClassName}
            />
            <input
              placeholder="Email"
              value={contactForm.email}
              onChange={(e) =>
                setContactForm((c) => ({ ...c, email: e.target.value }))
              }
              className={inputClassName}
            />
            <input
              placeholder="WeChat"
              value={contactForm.wechat}
              onChange={(e) =>
                setContactForm((c) => ({ ...c, wechat: e.target.value }))
              }
              className={inputClassName}
            />
            <input
              placeholder="WhatsApp"
              value={contactForm.whatsapp}
              onChange={(e) =>
                setContactForm((c) => ({ ...c, whatsapp: e.target.value }))
              }
              className={inputClassName}
            />
            <input
              placeholder="Telegram"
              value={contactForm.telegram}
              onChange={(e) =>
                setContactForm((c) => ({ ...c, telegram: e.target.value }))
              }
              className={inputClassName}
            />
            <select
              value={contactForm.language}
              onChange={(e) =>
                setContactForm((c) => ({ ...c, language: e.target.value }))
              }
              className={inputClassName}
            >
              <option value="">Language</option>
              {CRM_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={contactForm.birthday}
              onChange={(e) =>
                setContactForm((c) => ({ ...c, birthday: e.target.value }))
              }
              className={inputClassName}
            />
            <input
              placeholder="Notes"
              value={contactForm.notes}
              onChange={(e) =>
                setContactForm((c) => ({ ...c, notes: e.target.value }))
              }
              className={`${inputClassName} sm:col-span-2 lg:col-span-2`}
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={contactForm.is_primary}
                onChange={(e) =>
                  setContactForm((c) => ({
                    ...c,
                    is_primary: e.target.checked,
                  }))
                }
              />
              Primary contact
            </label>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background sm:col-span-2 lg:col-span-3"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Add contact
            </button>
          </form>

          <div className="erp-table-wrap">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead>
                <tr>
                  {[
                    "Name",
                    "Position",
                    "Mobile",
                    "Office",
                    "Email",
                    "WeChat",
                    "WhatsApp",
                    "Telegram",
                    "Language",
                    "Birthday",
                    "",
                  ].map((label) => (
                    <th
                      key={label || "actions"}
                      className="px-3 py-3 text-xs font-medium text-muted-foreground"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td className="px-3 py-3 text-foreground">
                      {contact.full_name}
                      {contact.is_primary ? (
                        <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                          Primary
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {contact.position ?? contact.title ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {contact.mobile ?? contact.phone ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {contact.office_phone ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {contact.email ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {contact.wechat ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {contact.whatsapp ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {contact.telegram ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {contact.language ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {formatCrmDate(contact.birthday)}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={async () => {
                          const result = await deleteCrmContact(
                            contact.id,
                            customer.id
                          );
                          if (!result.success) setToast(result.error);
                          else {
                            setToast("Contact deleted.");
                            router.refresh();
                          }
                        }}
                        className="rounded-md p-1.5 text-muted-foreground hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {!contacts.length ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-3 py-8 text-center text-sm text-muted-foreground"
                    >
                      No contacts yet. Add unlimited contacts above.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "Business" ? (
        <div className="erp-panel p-5">
          <DetailGrid>
            <DetailItem label="Customer type" value={customer.customer_type} />
            <DetailItem
              label="Interested products"
              value={customer.interested_products}
            />
            <DetailItem label="Markets" value={customer.markets} />
            <DetailItem label="Annual volume" value={customer.annual_volume} />
            <DetailItem
              label="Preferred Incoterms"
              value={customer.preferred_incoterms}
            />
            <DetailItem
              label="Preferred currency"
              value={customer.preferred_currency}
            />
            <DetailItem
              label="Preferred payment terms"
              value={customer.preferred_payment_terms}
            />
            <DetailItem label="Category" value={customer.category} />
            <DetailItem label="Manager" value={customer.manager} />
          </DetailGrid>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit business profile
          </button>
        </div>
      ) : null}

      {tab === "Timeline" ? (
        <div className="space-y-4">
          <form
            className="erp-panel grid gap-3 p-4 sm:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              const result = await createCrmTimelineEvent({
                customerId: customer.id,
                event_type: timelineForm.event_type,
                title: timelineForm.title,
                description: timelineForm.description,
                event_at: timelineForm.event_at
                  ? new Date(timelineForm.event_at).toISOString()
                  : null,
              });
              setBusy(false);
              if (!result.success) {
                setToast(result.error);
                return;
              }
              setTimelineForm({
                event_type: "Call",
                title: "",
                description: "",
                event_at: "",
              });
              setToast("Timeline event added.");
              router.refresh();
            }}
          >
            <select
              value={timelineForm.event_type}
              onChange={(e) =>
                setTimelineForm((c) => ({
                  ...c,
                  event_type: e.target.value as CrmTimelineType,
                }))
              }
              className={inputClassName}
            >
              {CRM_TIMELINE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={timelineForm.event_at}
              onChange={(e) =>
                setTimelineForm((c) => ({ ...c, event_at: e.target.value }))
              }
              className={inputClassName}
            />
            <input
              required
              placeholder="Title"
              value={timelineForm.title}
              onChange={(e) =>
                setTimelineForm((c) => ({ ...c, title: e.target.value }))
              }
              className={`${inputClassName} sm:col-span-2`}
            />
            <textarea
              rows={2}
              placeholder="Details"
              value={timelineForm.description}
              onChange={(e) =>
                setTimelineForm((c) => ({ ...c, description: e.target.value }))
              }
              className={`${inputClassName} resize-none sm:col-span-2`}
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background sm:col-span-2"
            >
              Log activity
            </button>
          </form>

          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setTimelineFilter("all")}
              className={`rounded-md px-2.5 py-1 text-xs ${
                timelineFilter === "all"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/40"
              }`}
            >
              All
            </button>
            {CRM_TIMELINE_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTimelineFilter(type)}
                className={`rounded-md px-2.5 py-1 text-xs ${
                  timelineFilter === type
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/40"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filteredTimeline.map((event) => (
              <div key={event.id} className="erp-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${timelineTone(event.event_type)}`}
                    >
                      {event.event_type}
                    </span>
                    <p className="text-sm font-medium text-foreground">
                      {event.title}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatCrmDateTime(event.event_at)}
                  </p>
                </div>
                {event.description ? (
                  <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                    {event.description}
                  </p>
                ) : null}
                {event.created_by_name ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {event.created_by_name}
                  </p>
                ) : null}
              </div>
            ))}
            {!filteredTimeline.length ? (
              <p className="text-sm text-muted-foreground">
                No timeline activity yet.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "Attachments" ? (
        <div className="space-y-4">
          <form
            className="erp-panel grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!attachmentFile) {
                setToast("Choose a file to upload.");
                return;
              }
              const clientError = validateCrmAttachmentFile(attachmentFile);
              if (clientError) {
                setToast(clientError);
                return;
              }
              setBusy(true);
              const formData = new FormData();
              formData.set("file", attachmentFile);
              if (attachmentTitle.trim()) {
                formData.set("title", attachmentTitle.trim());
              }
              const result = await uploadCrmAttachment({
                customerId: customer.id,
                formData,
                title: attachmentTitle,
              });
              setBusy(false);
              if (!result.success) {
                setToast(result.error);
                return;
              }
              setAttachmentFile(null);
              setAttachmentTitle("");
              setToast("Attachment uploaded.");
              router.refresh();
            }}
          >
            <input
              placeholder="Title (optional)"
              value={attachmentTitle}
              onChange={(e) => setAttachmentTitle(e.target.value)}
              className={inputClassName}
            />
            <input
              type="file"
              accept={CRM_ATTACHMENT_ACCEPT}
              onChange={(e) =>
                setAttachmentFile(e.target.files?.[0] ?? null)
              }
              className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:text-foreground"
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Upload
            </button>
          </form>

          <div className="space-y-2">
            {attachments.map((file) => (
              <div
                key={file.id}
                className="erp-panel flex items-center justify-between gap-3 p-4"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="rounded-md bg-accent p-2 text-muted-foreground">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {file.title || file.file_name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {file.file_name} · {formatFileSize(file.file_size)} ·{" "}
                      {formatCrmDateTime(file.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {file.signed_url ? (
                    <a
                      href={file.signed_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={async () => {
                      const result = await deleteCrmAttachment({
                        id: file.id,
                        customerId: customer.id,
                        filePath: file.file_path,
                      });
                      if (!result.success) setToast(result.error);
                      else {
                        setToast("Attachment deleted.");
                        router.refresh();
                      }
                    }}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {!attachments.length ? (
              <p className="text-sm text-muted-foreground">
                No attachments yet. Upload documents or images.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "Notes" ? (
        <div className="space-y-4">
          <form
            className="erp-panel space-y-3 p-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const text = noteBody.trim();
              if (!text) {
                setToast("Note body is required.");
                return;
              }
              setBusy(true);
              const result = await createCrmNote({
                customerId: customer.id,
                body: text,
              });
              setBusy(false);
              if (!result.success) {
                setToast(result.error);
                return;
              }
              setNoteBody("");
              setToast("Note saved.");
              router.refresh();
            }}
          >
            <textarea
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              rows={5}
              placeholder="Write a note..."
              className={inputClassName}
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background"
            >
              Save note
            </button>
          </form>
          <div className="space-y-2">
            {notes.map((note) => (
              <div key={note.id} className="erp-panel p-4">
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {note.body}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {note.created_by_name ?? "Operator"} ·{" "}
                  {formatCrmDateTime(note.created_at)}
                </p>
              </div>
            ))}
            {!notes.length ? (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
