import { assertCan } from "@/lib/platform/permissions";
import { createClient } from "@/lib/supabase/server";
import { createContractPdf } from "@/lib/contracts/pdf";
import { uploadDocument } from "@/lib/documents/actions";
import { getDefaultDocumentTemplate } from "@/lib/document-templates/actions";
import { renderContractDocx, renderTextTemplateDocx } from "@/lib/contracts/docx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "contract";
}

async function optionalImage(formData: FormData, name: string) {
  const value = formData.get(name);
  if (!(value instanceof File) || value.size === 0) return null;
  if (!new Set(["image/png", "image/jpeg"]).has(value.type)) {
    throw new Error(`${name === "seal" ? "Seal" : "Signature"} must be a PNG or JPEG image.`);
  }
  if (value.size > 5 * 1024 * 1024) {
    throw new Error(`${name === "seal" ? "Seal" : "Signature"} image must not exceed 5 MB.`);
  }
  return { bytes: new Uint8Array(await value.arrayBuffer()), mimeType: value.type };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await assertCan("contracts.write");
  if (denied) return Response.json({ error: denied }, { status: 403 });

  try {
    const { id } = await context.params;
    const formData = await request.formData();
    const requestedKind = formData.get("documentKind");
    const documentKind =
      requestedKind === "supplement" || requestedKind === "annex" || requestedKind === "invoice" ? (requestedKind === "annex" ? "supplement" : requestedKind) : "contract";
    const createInvoice = formData.get("createInvoice") === "true" && documentKind === "contract";
    const outputFormat = formData.get("format") === "docx" ? "docx" : "pdf";
    const includeApprovalMarks = formData.get("includeApprovalMarks") === "true";
    const [seal, signature] = includeApprovalMarks
      ? await Promise.all([optionalImage(formData, "seal"), optionalImage(formData, "signature")])
      : [null, null];
    if (includeApprovalMarks && !seal && !signature) {
      return Response.json(
        { error: "Select an authorized seal or signature image before applying approval marks." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: contract, error } = await supabase
      .from("contracts")
      .select(`
        id, contract_number, title, status, contract_date, expiry_date, currency, amount, incoterms, company_id,
        company:company_id ( name, seal_document_id, signature_document_id ), buyer:buyer_id ( legal_name ), supplier:supplier_id ( legal_name )
      `)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error || !contract) {
      return Response.json({ error: error?.message ?? "Contract not found." }, { status: 404 });
    }
    const loadedContract = contract;
    const templateType = documentKind === "invoice" ? "invoice" : documentKind === "supplement" ? "supplement" : "contract";
    const template = await getDefaultDocumentTemplate(templateType, loadedContract.company_id);
    if (!template || !template.is_active) {
      return Response.json({ error: "No active default template is configured.", code: "TEMPLATE_MISSING", uploadUrl: "/document-templates" }, { status: 409 });
    }
    const selectedTemplate = template;
    let templateBytes: Uint8Array | null = null;
    if (!selectedTemplate.template_content) {
      const templateFile = await supabase.storage.from("documents").download(selectedTemplate.storage_path);
      if (templateFile.error || !templateFile.data) {
        return Response.json({ error: "The selected default template file is unavailable. Upload a new template.", code: "TEMPLATE_UNAVAILABLE", uploadUrl: "/document-templates" }, { status: 409 });
      }
      templateBytes = new Uint8Array(await templateFile.data.arrayBuffer());
    }
    async function loadApprovalMark(documentId: string | null | undefined) {
      if (!documentId) return null;
      const { data: document } = await supabase
        .from("documents")
        .select("file_path, storage_path, mime_type")
        .eq("id", documentId)
        .maybeSingle();
      const path = document?.file_path || document?.storage_path;
      if (!path) return null;
      const downloaded = await supabase.storage.from("documents").download(path);
      if (downloaded.error || !downloaded.data) return null;
      return { bytes: new Uint8Array(await downloaded.data.arrayBuffer()), mimeType: document.mime_type };
    }

    const { data: lines, error: lineError } = await supabase
      .from("contract_products")
      .select("quantity, product:product_id ( name, sku )")
      .eq("contract_id", id)
      .order("created_at", { ascending: true });
    if (lineError) return Response.json({ error: lineError.message }, { status: 400 });

    const relation = (value: unknown, key: "name" | "legal_name") => {
      const row = Array.isArray(value) ? value[0] : value;
      return row && typeof row === "object" && key in row ? String(row[key as keyof typeof row]) : null;
    };
    const products = (lines ?? []).map((line) => {
      const product = Array.isArray(line.product) ? line.product[0] : line.product;
      return {
        name: product?.name ?? "Product",
        sku: product?.sku ?? null,
        quantity: line.quantity == null ? null : Number(line.quantity),
      };
    });
    const companyRelation = Array.isArray(loadedContract.company) ? loadedContract.company[0] : loadedContract.company;
    const approvalMarks = includeApprovalMarks
      ? await Promise.all([
          loadApprovalMark(companyRelation?.seal_document_id),
          loadApprovalMark(companyRelation?.signature_document_id),
        ])
      : [null, null];

    const pdfInput = {
      contractNumber: loadedContract.contract_number,
      title: loadedContract.title,
      status: loadedContract.status,
      contractDate: loadedContract.contract_date,
      expiryDate: loadedContract.expiry_date,
      company: relation(loadedContract.company, "name"),
      buyer: relation(loadedContract.buyer, "legal_name"),
      supplier: relation(loadedContract.supplier, "legal_name"),
      currency: loadedContract.currency,
      amount: loadedContract.amount == null ? null : Number(loadedContract.amount),
      incoterms: loadedContract.incoterms,
      products,
      seal: approvalMarks[0]?.bytes ?? seal?.bytes,
      sealMimeType: approvalMarks[0]?.mimeType ?? seal?.mimeType,
      signature: approvalMarks[1]?.bytes ?? signature?.bytes,
      signatureMimeType: approvalMarks[1]?.mimeType ?? signature?.mimeType,
    };

    async function generateAndStore(kind: "contract" | "supplement" | "invoice") {
      const docxData = {
        contract_number: loadedContract.contract_number,
        title: loadedContract.title,
        status: loadedContract.status,
        contract_date: loadedContract.contract_date,
        expiry_date: loadedContract.expiry_date,
        company: relation(loadedContract.company, "name"),
        buyer: relation(loadedContract.buyer, "legal_name"),
        supplier: relation(loadedContract.supplier, "legal_name"),
        currency: loadedContract.currency,
        amount: loadedContract.amount == null ? null : Number(loadedContract.amount),
        incoterms: loadedContract.incoterms,
        products: products.map((item) => `${item.name}${item.quantity == null ? "" : ` — ${item.quantity}`}`).join("; "),
      };
      const bytes = outputFormat === "docx"
          ? selectedTemplate.template_content
          ? renderTextTemplateDocx(selectedTemplate.template_content, { ...docxData, "contract.number": docxData.contract_number, "seller.name": docxData.company, "buyer.name": docxData.buyer, "consignee.name": null, "commercial.price": docxData.amount, "commercial.currency": docxData.currency, incoterms: docxData.incoterms })
          : renderContractDocx(templateBytes!, docxData)
        : await createContractPdf({ ...pdfInput, documentKind: kind });
      const label = kind === "invoice" ? "Commercial Invoice" : kind === "supplement" ? "Supplement" : "Contract";
      // Keep generated records within the canonical database document types.
      // The UI label still distinguishes Commercial Invoice, while the
      // persisted value `invoice` is accepted by older and newer schemas.
      const storedType = kind === "invoice" ? "invoice" : kind === "supplement" ? "supplement" : "contract";
      const extension = outputFormat === "docx" ? "docx" : "pdf";
      const mimeType = outputFormat === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf";
      const fileName = `${safeFileName(loadedContract.contract_number)}-${kind}-generated.${extension}`;
      const pdfArrayBuffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(pdfArrayBuffer).set(bytes);
      const uploadForm = new FormData();
      uploadForm.set("file", new File([pdfArrayBuffer], fileName, { type: mimeType }));
      uploadForm.set("document_type", storedType);
      uploadForm.set("title", `Generated ${label.toLowerCase()} ${loadedContract.contract_number}`);
      uploadForm.set(
        "notes",
        includeApprovalMarks ? "Generated with explicitly selected approval marks." : "Generated without approval marks."
      );
      const uploaded = await uploadDocument({
        entityType: "contract",
        entityId: id,
        formData: uploadForm,
        documentType: storedType,
        title: `Generated ${label.toLowerCase()} ${loadedContract.contract_number}`,
        tags: ["generated", kind, includeApprovalMarks ? "approval-marks" : "unsigned"],
      });
      if (!uploaded.success) throw new Error(uploaded.error);
      return { bytes, fileName, documentId: uploaded.id, mimeType };
    }

    const generated = await generateAndStore(documentKind);
    if (createInvoice) await generateAndStore("invoice");

    return new Response(Buffer.from(generated.bytes), {
      status: 200,
      headers: {
        "Content-Type": generated.mimeType,
        "Content-Disposition": `attachment; filename="${generated.fileName}"`,
        "X-SKY-Document-Id": generated.documentId,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const details = error && typeof error === "object" && "properties" in error
      ? (error as { properties?: { errors?: Array<{ properties?: { explanation?: string } }> } }).properties?.errors
          ?.map((item) => item.properties?.explanation)
          .filter((value): value is string => Boolean(value))
          .join(" ")
      : null;
    return Response.json(
      { error: details || (error instanceof Error ? error.message : "Unable to generate contract from template.") },
      { status: 500 }
    );
  }
}
