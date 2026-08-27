"use client";

import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Circle,
  XCircle,
} from "lucide-react";
import type { ContractData } from "@/lib/contracts/types";
import type { WorkflowStepId } from "@/lib/contracts/workflow";

const inputClassName =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

const labelClassName = "mb-1.5 block text-xs font-medium text-muted-foreground";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClassName}>{label}</label>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={inputClassName}
    />
  );
}

function TextArea({
  value,
  onChange,
  rows = 3,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputClassName} resize-none`}
    />
  );
}

type ContractStepPanelProps = {
  stepId: WorkflowStepId;
  contract: ContractData;
  onChange: (contract: ContractData) => void;
};

export function ContractStepPanel({
  stepId,
  contract,
  onChange,
}: ContractStepPanelProps) {
  function update<K extends keyof ContractData>(
    section: K,
    value: ContractData[K]
  ) {
    onChange({ ...contract, [section]: value, updatedAt: new Date().toISOString() });
  }

  if (stepId === "business_case") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Case number">
          <TextInput
            value={contract.case_number}
            onChange={(value) => update("case_number", value)}
          />
        </Field>
        <Field label="Title">
          <TextInput
            value={contract.title}
            onChange={(value) => update("title", value)}
          />
        </Field>
        <Field label="Case type">
          <TextInput
            value={contract.businessCase.case_type}
            onChange={(value) =>
              update("businessCase", {
                ...contract.businessCase,
                case_type: value,
              })
            }
          />
        </Field>
        <Field label="Contract number">
          <TextInput
            value={contract.businessCase.contract_number}
            onChange={(value) =>
              update("businessCase", {
                ...contract.businessCase,
                contract_number: value,
              })
            }
          />
        </Field>
        <Field label="Contract date">
          <TextInput
            type="date"
            value={contract.businessCase.contract_date}
            onChange={(value) =>
              update("businessCase", {
                ...contract.businessCase,
                contract_date: value,
              })
            }
          />
        </Field>
        <Field label="Contract amount">
          <TextInput
            type="number"
            value={contract.businessCase.contract_amount}
            onChange={(value) =>
              update("businessCase", {
                ...contract.businessCase,
                contract_amount: value,
              })
            }
          />
        </Field>
        <Field label="Currency">
          <TextInput
            value={contract.businessCase.currency}
            onChange={(value) =>
              update("businessCase", {
                ...contract.businessCase,
                currency: value,
              })
            }
          />
        </Field>
        <Field label="Incoterms">
          <TextInput
            value={contract.businessCase.incoterms}
            onChange={(value) =>
              update("businessCase", {
                ...contract.businessCase,
                incoterms: value,
              })
            }
          />
        </Field>
      </div>
    );
  }

  if (stepId === "buyer") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Legal name">
          <TextInput
            value={contract.buyer.legal_name}
            onChange={(value) =>
              update("buyer", { ...contract.buyer, legal_name: value })
            }
          />
        </Field>
        <Field label="Contact">
          <TextInput
            value={contract.buyer.contact}
            onChange={(value) =>
              update("buyer", { ...contract.buyer, contact: value })
            }
          />
        </Field>
        <Field label="Country">
          <TextInput
            value={contract.buyer.country}
            onChange={(value) =>
              update("buyer", { ...contract.buyer, country: value })
            }
          />
        </Field>
        <Field label="Payment terms">
          <TextInput
            value={contract.buyer.paymentTerms}
            onChange={(value) =>
              update("buyer", { ...contract.buyer, paymentTerms: value })
            }
          />
        </Field>
      </div>
    );
  }

  if (stepId === "supplier") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Legal name">
          <TextInput
            value={contract.supplier.legal_name}
            onChange={(value) =>
              update("supplier", { ...contract.supplier, legal_name: value })
            }
          />
        </Field>
        <Field label="Contact">
          <TextInput
            value={contract.supplier.contact}
            onChange={(value) =>
              update("supplier", { ...contract.supplier, contact: value })
            }
          />
        </Field>
        <Field label="Country">
          <TextInput
            value={contract.supplier.country}
            onChange={(value) =>
              update("supplier", { ...contract.supplier, country: value })
            }
          />
        </Field>
        <Field label="Payment terms">
          <TextInput
            value={contract.supplier.paymentTerms}
            onChange={(value) =>
              update("supplier", { ...contract.supplier, paymentTerms: value })
            }
          />
        </Field>
      </div>
    );
  }

  if (stepId === "products") {
    return (
      <div className="space-y-4">
        {contract.products.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No products added yet. Link items from the product catalog.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-accent/30">
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Product
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Qty
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Purchase
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Sale
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {contract.products.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-3 font-mono text-xs">{line.sku}</td>
                      <td className="px-4 py-3">{line.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {line.quantity.toLocaleString()} {line.unit}
                      </td>
                      <td className="px-4 py-3">${line.purchasePrice.toFixed(2)}</td>
                      <td className="px-4 py-3">${line.salePrice.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <button
          type="button"
          className="rounded-md border border-border bg-accent/40 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          Add product line
        </button>
      </div>
    );
  }

  if (stepId === "purchase_contract") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contract number">
          <TextInput
            value={contract.purchaseContract.number}
            onChange={(value) =>
              update("purchaseContract", {
                ...contract.purchaseContract,
                number: value,
              })
            }
          />
        </Field>
        <Field label="Date">
          <TextInput
            type="date"
            value={contract.purchaseContract.date}
            onChange={(value) =>
              update("purchaseContract", {
                ...contract.purchaseContract,
                date: value,
              })
            }
          />
        </Field>
        <Field label="Amount">
          <TextInput
            value={contract.purchaseContract.amount}
            onChange={(value) =>
              update("purchaseContract", {
                ...contract.purchaseContract,
                amount: value,
              })
            }
          />
        </Field>
        <Field label="Currency">
          <TextInput
            value={contract.purchaseContract.currency}
            onChange={(value) =>
              update("purchaseContract", {
                ...contract.purchaseContract,
                currency: value,
              })
            }
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Terms">
            <TextArea
              value={contract.purchaseContract.terms}
              onChange={(value) =>
                update("purchaseContract", {
                  ...contract.purchaseContract,
                  terms: value,
                })
              }
            />
          </Field>
        </div>
      </div>
    );
  }

  if (stepId === "sales_contract") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contract number">
          <TextInput
            value={contract.salesContract.number}
            onChange={(value) =>
              update("salesContract", {
                ...contract.salesContract,
                number: value,
              })
            }
          />
        </Field>
        <Field label="Date">
          <TextInput
            type="date"
            value={contract.salesContract.date}
            onChange={(value) =>
              update("salesContract", {
                ...contract.salesContract,
                date: value,
              })
            }
          />
        </Field>
        <Field label="Amount">
          <TextInput
            value={contract.salesContract.amount}
            onChange={(value) =>
              update("salesContract", {
                ...contract.salesContract,
                amount: value,
              })
            }
          />
        </Field>
        <Field label="Currency">
          <TextInput
            value={contract.salesContract.currency}
            onChange={(value) =>
              update("salesContract", {
                ...contract.salesContract,
                currency: value,
              })
            }
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Terms">
            <TextArea
              value={contract.salesContract.terms}
              onChange={(value) =>
                update("salesContract", {
                  ...contract.salesContract,
                  terms: value,
                })
              }
            />
          </Field>
        </div>
      </div>
    );
  }

  if (stepId === "invoice") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Invoice number">
          <TextInput
            value={contract.invoice.number}
            onChange={(value) =>
              update("invoice", { ...contract.invoice, number: value })
            }
          />
        </Field>
        <Field label="Invoice date">
          <TextInput
            type="date"
            value={contract.invoice.date}
            onChange={(value) =>
              update("invoice", { ...contract.invoice, date: value })
            }
          />
        </Field>
        <Field label="Amount">
          <TextInput
            value={contract.invoice.amount}
            onChange={(value) =>
              update("invoice", { ...contract.invoice, amount: value })
            }
          />
        </Field>
        <Field label="Due date">
          <TextInput
            type="date"
            value={contract.invoice.dueDate}
            onChange={(value) =>
              update("invoice", { ...contract.invoice, dueDate: value })
            }
          />
        </Field>
      </div>
    );
  }

  if (stepId === "packing") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Packing list reference">
          <TextInput
            value={contract.packing.reference}
            onChange={(value) =>
              update("packing", { ...contract.packing, reference: value })
            }
          />
        </Field>
        <Field label="Cartons">
          <TextInput
            value={contract.packing.cartons}
            onChange={(value) =>
              update("packing", { ...contract.packing, cartons: value })
            }
          />
        </Field>
        <Field label="Net weight">
          <TextInput
            value={contract.packing.netWeight}
            onChange={(value) =>
              update("packing", { ...contract.packing, netWeight: value })
            }
          />
        </Field>
        <Field label="Gross weight">
          <TextInput
            value={contract.packing.grossWeight}
            onChange={(value) =>
              update("packing", { ...contract.packing, grossWeight: value })
            }
          />
        </Field>
      </div>
    );
  }

  if (stepId === "health") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Certificate number">
          <TextInput
            value={contract.health.certificateNo}
            onChange={(value) =>
              update("health", { ...contract.health, certificateNo: value })
            }
          />
        </Field>
        <Field label="Issuing authority">
          <TextInput
            value={contract.health.authority}
            onChange={(value) =>
              update("health", { ...contract.health, authority: value })
            }
          />
        </Field>
        <Field label="Issued date">
          <TextInput
            type="date"
            value={contract.health.issuedDate}
            onChange={(value) =>
              update("health", { ...contract.health, issuedDate: value })
            }
          />
        </Field>
        <Field label="Expiry date">
          <TextInput
            type="date"
            value={contract.health.expiryDate}
            onChange={(value) =>
              update("health", { ...contract.health, expiryDate: value })
            }
          />
        </Field>
      </div>
    );
  }

  if (stepId === "origin") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Certificate number">
          <TextInput
            value={contract.origin.certificateNo}
            onChange={(value) =>
              update("origin", { ...contract.origin, certificateNo: value })
            }
          />
        </Field>
        <Field label="Country of origin">
          <TextInput
            value={contract.origin.country}
            onChange={(value) =>
              update("origin", { ...contract.origin, country: value })
            }
          />
        </Field>
        <Field label="Issued date">
          <TextInput
            type="date"
            value={contract.origin.issuedDate}
            onChange={(value) =>
              update("origin", { ...contract.origin, issuedDate: value })
            }
          />
        </Field>
      </div>
    );
  }

  if (stepId === "bl") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="BL number">
          <TextInput
            value={contract.bl.number}
            onChange={(value) => update("bl", { ...contract.bl, number: value })}
          />
        </Field>
        <Field label="Vessel">
          <TextInput
            value={contract.bl.vessel}
            onChange={(value) => update("bl", { ...contract.bl, vessel: value })}
          />
        </Field>
        <Field label="Port of loading">
          <TextInput
            value={contract.bl.portOfLoading}
            onChange={(value) =>
              update("bl", { ...contract.bl, portOfLoading: value })
            }
          />
        </Field>
        <Field label="Port of discharge">
          <TextInput
            value={contract.bl.portOfDischarge}
            onChange={(value) =>
              update("bl", { ...contract.bl, portOfDischarge: value })
            }
          />
        </Field>
        <Field label="ETD">
          <TextInput
            type="date"
            value={contract.bl.etd}
            onChange={(value) => update("bl", { ...contract.bl, etd: value })}
          />
        </Field>
        <Field label="ETA">
          <TextInput
            type="date"
            value={contract.bl.eta}
            onChange={(value) => update("bl", { ...contract.bl, eta: value })}
          />
        </Field>
      </div>
    );
  }

  if (stepId === "container") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Container number">
          <TextInput
            value={contract.container.number}
            onChange={(value) =>
              update("container", { ...contract.container, number: value })
            }
          />
        </Field>
        <Field label="Seal number">
          <TextInput
            value={contract.container.sealNo}
            onChange={(value) =>
              update("container", { ...contract.container, sealNo: value })
            }
          />
        </Field>
        <Field label="Container type">
          <TextInput
            value={contract.container.type}
            onChange={(value) =>
              update("container", { ...contract.container, type: value })
            }
          />
        </Field>
        <Field label="Temperature">
          <TextInput
            value={contract.container.temperature}
            onChange={(value) =>
              update("container", { ...contract.container, temperature: value })
            }
          />
        </Field>
      </div>
    );
  }

  if (stepId === "payments") {
    return (
      <div className="space-y-4">
        {contract.payments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No payment schedule defined yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-accent/30">
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                    Label
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                    Due
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contract.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3">{payment.label}</td>
                    <td className="px-4 py-3">${payment.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {payment.dueDate}
                    </td>
                    <td className="px-4 py-3 capitalize">{payment.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button
          type="button"
          className="rounded-md border border-border bg-accent/40 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          Add payment
        </button>
      </div>
    );
  }

  if (stepId === "commission") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Agent">
          <TextInput
            value={contract.commission.agent}
            onChange={(value) =>
              update("commission", { ...contract.commission, agent: value })
            }
          />
        </Field>
        <Field label="Rate (%)">
          <TextInput
            value={contract.commission.rate}
            onChange={(value) =>
              update("commission", { ...contract.commission, rate: value })
            }
          />
        </Field>
        <Field label="Amount">
          <TextInput
            value={contract.commission.amount}
            onChange={(value) =>
              update("commission", { ...contract.commission, amount: value })
            }
          />
        </Field>
      </div>
    );
  }

  if (stepId === "profit") {
    const purchase = Number(contract.profit.purchaseTotal) || 0;
    const sales = Number(contract.profit.salesTotal) || 0;
    const logistics = Number(contract.profit.logisticsCost) || 0;
    const commission = Number(contract.profit.commissionCost) || 0;
    const net = sales - purchase - logistics - commission;
    const margin = sales > 0 ? ((net / sales) * 100).toFixed(1) : "0.0";

    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Purchase total">
            <TextInput
              value={contract.profit.purchaseTotal}
              onChange={(value) =>
                update("profit", { ...contract.profit, purchaseTotal: value })
              }
            />
          </Field>
          <Field label="Sales total">
            <TextInput
              value={contract.profit.salesTotal}
              onChange={(value) =>
                update("profit", { ...contract.profit, salesTotal: value })
              }
            />
          </Field>
          <Field label="Logistics cost">
            <TextInput
              value={contract.profit.logisticsCost}
              onChange={(value) =>
                update("profit", { ...contract.profit, logisticsCost: value })
              }
            />
          </Field>
          <Field label="Commission cost">
            <TextInput
              value={contract.profit.commissionCost}
              onChange={(value) =>
                update("profit", { ...contract.profit, commissionCost: value })
              }
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-accent/20 p-4">
            <p className="text-xs text-muted-foreground">Net profit</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              ${net.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-accent/20 p-4">
            <p className="text-xs text-muted-foreground">Margin</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-400">
              {margin}%
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (stepId === "timeline") {
    return (
      <div className="space-y-3">
        {contract.timeline.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No milestones recorded yet.
          </div>
        ) : (
          contract.timeline.map((event, index) => (
            <div
              key={event.id}
              className="flex items-start gap-3 rounded-lg border border-border bg-accent/10 p-4"
            >
              <div className="mt-0.5">
                {event.status === "done" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : event.status === "current" ? (
                  <Circle className="h-4 w-4 fill-blue-500 text-blue-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{event.label}</p>
                <p className="text-xs text-muted-foreground">{event.date}</p>
              </div>
              <span className="text-xs capitalize text-muted-foreground">
                {event.status}
              </span>
              {index < contract.timeline.length - 1 ? null : null}
            </div>
          ))
        )}
      </div>
    );
  }

  if (stepId === "ai_check") {
    return (
      <div className="space-y-3">
        {contract.aiCheck.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed border-border p-10 text-center">
            <Bot className="h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">
              Run AI check
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Validate margin, documents, and payment alignment automatically.
            </p>
            <button
              type="button"
              className="mt-4 rounded-md bg-foreground px-4 py-2 text-xs font-medium text-background"
            >
              Run check
            </button>
          </div>
        ) : (
          contract.aiCheck.map((item) => {
            const Icon =
              item.status === "pass"
                ? CheckCircle2
                : item.status === "warn"
                  ? AlertTriangle
                  : XCircle;
            const color =
              item.status === "pass"
                ? "text-emerald-400"
                : item.status === "warn"
                  ? "text-amber-400"
                  : "text-red-400";

            return (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-accent/10 p-4"
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.message}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }

  return null;
}
