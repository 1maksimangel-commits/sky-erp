import type { BacklogItem, PriorityRank, RankedTask } from "./types";

const RANK_LABELS: Record<PriorityRank, string> = {
  0: "P0 Safety / integrity",
  1: "P1 Security prerequisites",
  2: "P2 Schema consistency",
  3: "P3 Business Engine spine",
  4: "P4 Module stabilization",
  5: "P5 Product features",
  6: "P6 Tech debt",
  7: "P7 Nice-to-have docs",
};

function textBlob(item: BacklogItem): string {
  return `${item.section} ${item.title} ${item.status}`.toLowerCase();
}

export function isBacklogItemBlocked(item: BacklogItem): {
  blocked: boolean;
  reason: string | null;
} {
  const status = item.status.toLowerCase();
  const blob = textBlob(item);

  if (/blocked on auth|requires? auth|wait(?:ing)? on auth/.test(blob)) {
    return { blocked: true, reason: "Blocked on authentication foundation." };
  }
  if (/ops\s*[—-]\s*approval required|approval required/.test(status)) {
    return {
      blocked: true,
      reason: "Requires human ops / migration apply approval.",
    };
  }
  if (/not applied/.test(status) && /remotely|apply/.test(blob)) {
    return {
      blocked: true,
      reason: "Migration authored but apply requires human approval.",
    };
  }
  if (/policy \(ongoing\)|policy \/ present/.test(status)) {
    return { blocked: true, reason: "Standing policy — not an actionable task." };
  }
  if (/^current$/i.test(item.status.trim())) {
    return { blocked: true, reason: "Marked current/complete — not actionable." };
  }
  if (/^present$/i.test(item.status.trim())) {
    return { blocked: true, reason: "Marked present — not actionable." };
  }

  return { blocked: false, reason: null };
}

export function classifyPriorityRank(item: BacklogItem): {
  rank: PriorityRank;
  reasons: string[];
} {
  const blob = textBlob(item);
  const reasons: string[] = [];

  if (
    /xss|secret|leak|destructive|payment corruption|cross-company|signed url|mime allowlist|using \(true\)|anon execute|definer/.test(
      blob
    ) &&
    !/blocked on auth/.test(blob)
  ) {
    reasons.push("Security or integrity keywords.");
    return { rank: 0, reasons };
  }

  if (
    item.section === "Security" ||
    item.section === "Authentication" ||
    /session-based role|middleware|rls|auth stub|company-scoped/.test(blob)
  ) {
    reasons.push("Auth / security prerequisite section.");
    return { rank: 1, reasons };
  }

  if (
    item.section === "Database" ||
    /migration|schema|business_case_id|fk|column/.test(blob)
  ) {
    reasons.push("Schema / migration consistency.");
    return { rank: 2, reasons };
  }

  if (
    /business case|business engine|contract hub|stamp/.test(blob) ||
    item.section === "Contracts"
  ) {
    reasons.push("Commercial spine / Business Engine.");
    return { rank: 3, reasons };
  }

  if (
    ["Finance", "Logistics", "Warehouse", "CRM", "Documents", "AI"].includes(
      item.section
    )
  ) {
    reasons.push("Module stabilization area.");
    return { rank: 4, reasons };
  }

  if (item.section === "Reports" || /feature|crud|credit notes/.test(blob)) {
    reasons.push("Product / reporting feature.");
    return { rank: 5, reasons };
  }

  if (item.section === "DevOps" || /lint|lockfile|ci|pnpm/.test(blob)) {
    reasons.push("Tech debt / DevOps.");
    return { rank: 6, reasons };
  }

  if (item.section === "Documentation" || /docs|knowledge|legacy/.test(blob)) {
    reasons.push("Documentation.");
    return { rank: 7, reasons };
  }

  reasons.push("Default medium priority.");
  return { rank: 5, reasons };
}

/** Higher score = more urgent. Blocked items score very low unless allowed. */
export function scoreBacklogItem(item: BacklogItem): RankedTask {
  const { rank, reasons } = classifyPriorityRank(item);
  const { blocked, reason: blockReason } = isBacklogItemBlocked(item);

  let score = (7 - rank) * 100;

  if (/confirmed gap|partial|in repo fix|not applied|stub/.test(item.status.toLowerCase())) {
    score += 25;
    reasons.push("Open gap / incomplete status.");
  }
  if (/planned/.test(item.status.toLowerCase()) && !blocked) {
    score += 10;
  }
  if (blocked) {
    score -= 500;
    reasons.push(blockReason ?? "Blocked.");
  }

  return {
    item,
    rank,
    rankLabel: RANK_LABELS[rank],
    score,
    reasons,
    blocked,
    blockReason,
  };
}

export function selectHighestPriorityTask(
  items: BacklogItem[],
  options?: {
    preferSection?: string;
    preferTitleIncludes?: string;
    allowBlocked?: boolean;
  }
): { ranked: RankedTask[]; selected: RankedTask | null } {
  const ranked = items
    .map(scoreBacklogItem)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));

  const preferSection = options?.preferSection?.toLowerCase();
  const preferTitle = options?.preferTitleIncludes?.toLowerCase();
  const allowBlocked = options?.allowBlocked ?? false;

  const eligible = ranked.filter((task) => allowBlocked || !task.blocked);

  if (preferSection || preferTitle) {
    const preferred = eligible.find((task) => {
      const sectionOk = preferSection
        ? task.item.section.toLowerCase() === preferSection
        : true;
      const titleOk = preferTitle
        ? task.item.title.toLowerCase().includes(preferTitle)
        : true;
      return sectionOk && titleOk;
    });
    if (preferred) {
      return { ranked, selected: preferred };
    }
  }

  return { ranked, selected: eligible[0] ?? null };
}

export function priorityRankLabel(rank: PriorityRank): string {
  return RANK_LABELS[rank];
}
