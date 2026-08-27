"use client";

import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { ContractStepPanel } from "@/components/contracts/ContractStepPanel";
import type { ContractData } from "@/lib/contracts/types";
import {
  getNextStep,
  getPreviousStep,
  getWorkflowStep,
  getWorkflowStepIndex,
  WORKFLOW_STEPS,
  type WorkflowStepId,
} from "@/lib/contracts/workflow";

type ContractWorkflowProps = {
  contract: ContractData;
  onChange: (contract: ContractData) => void;
  onBack: () => void;
};

export function ContractWorkflow({
  contract,
  onChange,
  onBack,
}: ContractWorkflowProps) {
  const currentStep = contract.currentStep;
  const stepMeta = getWorkflowStep(currentStep);
  const currentIndex = getWorkflowStepIndex(currentStep);
  const StepIcon = stepMeta.icon;
  const previousStep = getPreviousStep(currentStep);
  const nextStep = getNextStep(currentStep);

  function goToStep(stepId: WorkflowStepId) {
    onChange({ ...contract, currentStep: stepId });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All business cases
          </button>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {contract.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {contract.case_number} · {contract.buyer.legal_name || "No buyer"} →{" "}
            {contract.supplier.legal_name || "No supplier"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <p className="text-xs text-muted-foreground">Current stage</p>
          <p className="mt-1 font-medium text-foreground">{stepMeta.label}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-card-border bg-card">
        <div className="border-b border-border px-4 py-3 lg:hidden">
          <p className="text-xs font-medium text-muted-foreground">
            Workflow progress
          </p>
          <p className="mt-1 text-sm text-foreground">
            Step {currentIndex + 1} of {WORKFLOW_STEPS.length}: {stepMeta.label}
          </p>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr]">
          <nav className="hidden max-h-[720px] overflow-y-auto border-r border-border bg-accent/10 lg:block">
            <div className="space-y-1 p-3">
              {WORKFLOW_STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = step.id === currentStep;
                const isComplete = index < currentIndex;

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => goToStep(step.id)}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? "bg-foreground text-background"
                        : isComplete
                          ? "text-emerald-400 hover:bg-accent/60"
                          : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${
                        isActive
                          ? "bg-background text-foreground"
                          : isComplete
                            ? "bg-emerald-500/20"
                            : "bg-accent"
                      }`}
                    >
                      {isComplete ? "✓" : index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">
                        {step.label}
                      </span>
                    </span>
                    <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="min-w-0">
            <div className="border-b border-border px-5 py-4 sm:px-6">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-accent p-2 text-muted-foreground">
                  <StepIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {stepMeta.label}
                  </h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {stepMeta.description}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-1 lg:hidden">
                {WORKFLOW_STEPS.map((step, index) => (
                  <div key={step.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => goToStep(step.id)}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        step.id === currentStep
                          ? "bg-foreground text-background"
                          : index < currentIndex
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-accent text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </button>
                    {index < WORKFLOW_STEPS.length - 1 ? (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 py-5 sm:px-6">
              <ContractStepPanel
                stepId={currentStep}
                contract={contract}
                onChange={onChange}
              />
            </div>

            <div className="flex items-center justify-between border-t border-border px-5 py-4 sm:px-6">
              <button
                type="button"
                disabled={!previousStep}
                onClick={() => previousStep && goToStep(previousStep)}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                type="button"
                disabled={!nextStep}
                onClick={() => nextStep && goToStep(nextStep)}
                className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
