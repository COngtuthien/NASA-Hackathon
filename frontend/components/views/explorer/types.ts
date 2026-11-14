// Phase 14 Research-to-Safety Explorer: response types of /api/v1/explorer/*.
import type { EvidenceKind } from "@/components/evidence-tag";

export type ScenarioCard = {
  id: string; title: string; question: string; domain: string; icon: string; summary: string;
  primary: { investigation_id: string; short_name: string };
  supporting: { investigation_id: string; short_name: string; role: string }[];
  records: number;
};
export type ScenarioList = {
  scenarios: ScenarioCard[]; disclaimer: string;
  ranking: {
    weights: Record<string, number>; topic_points: Record<string, number>; role_points: Record<string, number>;
    environment_points: Record<string, number>; evidence_points: Record<string, { points: number; label: string }>;
  };
};

export type FacetOption = { value: string; label: string; records?: number; investigations?: string[] };
export type Facet =
  | { label: string; kind: "category"; options: FacetOption[] }
  | { label: string; kind: "range"; min: number | null; max: number | null; records: number; unit: string };

export type Ranked = {
  rank: number; investigation_id: string; short_name: string; title: string; role: "primary" | "supporting" | "context";
  readiness: string; score: number; explanation: string; related_count: number;
  limitations: { code: string; text: string }[];
  links: { analysis?: string | null; studio?: string | null; copilot?: string };
  components: {
    relevance: { value: number; topic: number; topic_basis: string; environment: number; environment_basis: string; role: number;
      studies: { phenomenon: string; label: string; focus: string; source_ref: string }[] };
    evidence: { value: number; class: string; label: string; directness: number };
    applicability: { value: number | null; basis: string; evaluated: string[]; not_recorded: string[]; n_match: number | null;
      n_total: number; rejected: Record<string, number>; incomplete: Record<string, number> };
  };
};

export type EvidenceItem = {
  id: string; investigation_id: string; evidence_class: EvidenceKind; title: string; observation: string;
  conditions: Record<string, string | number>; limitations: string[];
  source: { label: string; document_id: string | null; page: number | null; ref: string };
  links: { label: string; href: string }[];
};

export type Workspace = {
  scenario: { id: string; title: string; question: string; domain: string; summary: string };
  filters: Record<string, string | (number | null)[]>;
  facets: Record<string, Facet>;
  ranked: Ranked[];
  matching: Record<string, { n_total: number; n_match: number; evaluated: string[]; not_recorded: string[];
    rejected: Record<string, number>; incomplete: Record<string, number> }>;
  no_match: boolean; no_match_message: string | null;
  evidence: EvidenceItem[];
  summary: Record<string, unknown> & { kind: string; title: string; note: string };
  interpretation: { shows: string[]; why_it_matters: string; cannot_conclude: string[]; missing: string[] };
  links: Record<string, { label: string; href: string; note?: string } | null>;
  disclaimer: string;
};

export const ROLE_LABEL: Record<string, string> = { primary: "Primary evidence", supporting: "Supporting", context: "Context only" };
export const READINESS_LABEL: Record<string, string> = {
  quantitative: "Per-test data", curated_tables: "Curated report tables", figure_data: "Figure data + model",
  conditions_only: "Conditions only", documentation_only: "Documents only", metadata_only: "Metadata only",
};
