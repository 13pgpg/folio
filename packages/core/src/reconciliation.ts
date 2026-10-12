/** Deterministic, provider-neutral reconciliation of one financial fact. */
export type ReconciliationState =
  | 'agreement'
  | 'within-tolerance'
  | 'material-conflict'
  | 'incomparable'
  | 'insufficient-sources';

export interface FinancialFactCandidate {
  provider: string;
  instrument?: string;
  metric?: string;
  value: number;
  /** Timestamp of the underlying fact, in epoch milliseconds. */
  asOf?: number;
  period?: string;
  currency?: string;
  unit?: string;
  adjustment?: string;
}

export interface ReconciliationPolicy {
  version: string;
  absoluteTolerance?: number;
  relativeTolerance?: number;
  providerPriority?: string[];
  /** Refuse monetary comparisons when the currency is not recorded. */
  requireCurrency?: boolean;
  /** Require timestamps to align within this many milliseconds when both exist. */
  maxAsOfSkewMs?: number;
}

export interface ReconciliationResult {
  state: ReconciliationState;
  candidates: FinancialFactCandidate[];
  selected?: FinancialFactCandidate;
  discrepancy?: number;
  reason: string;
  policyVersion: string;
  sourceCount?: number;
  selectedReason?: string;
}

export function reconcileFinancialFacts(
  candidates: FinancialFactCandidate[],
  policy: ReconciliationPolicy
): ReconciliationResult {
  const base = {
    candidates: candidates.map((candidate) => ({ ...candidate })),
    policyVersion: policy.version,
    sourceCount: new Set(candidates.map((candidate) => candidate.provider)).size,
  };
  if (base.sourceCount < 2) {
    return { ...base, state: 'insufficient-sources', reason: 'At least two provider candidates are required.' };
  }

  const first = candidates[0];
  const comparable = candidates.every((candidate) =>
    Number.isFinite(candidate.value)
    && candidate.instrument === first.instrument
    && candidate.metric === first.metric
    && candidate.period === first.period
    && candidate.currency === first.currency
    && (!policy.requireCurrency || Boolean(candidate.currency))
    && candidate.unit === first.unit
    && candidate.adjustment === first.adjustment
    && (policy.maxAsOfSkewMs === undefined
      || (candidate.asOf !== undefined && first.asOf !== undefined
        && Math.abs(candidate.asOf - first.asOf) <= policy.maxAsOfSkewMs))
  );
  if (!comparable) {
    return {
      ...base,
      state: 'incomparable',
      reason: 'Candidates differ in instrument, metric, period, currency, unit, adjustment, or timestamp semantics.',
    };
  }

  const values = candidates.map((candidate) => candidate.value);
  const discrepancy = Math.max(...values) - Math.min(...values);
  const scale = Math.max(...values.map((value) => Math.abs(value)), 1);
  const within = (policy.absoluteTolerance !== undefined && discrepancy <= policy.absoluteTolerance)
    || (policy.relativeTolerance !== undefined && discrepancy / scale <= policy.relativeTolerance);
  const state: ReconciliationState = discrepancy === 0
    ? 'agreement'
    : within ? 'within-tolerance' : 'material-conflict';
  const selected = (policy.providerPriority ?? [])
    .map((provider) => candidates.find((candidate) => candidate.provider === provider))
    .find((candidate) => candidate !== undefined);
  // A material disagreement with no explicit priority must not silently pick
  // whichever provider happened to arrive first.
  const resolved = selected ?? (state === 'material-conflict' ? undefined : first);
  const selectedReason = selected
    ? `Selected provider "${selected.provider}" per policy priority.`
    : resolved ? 'Candidates agree under policy tolerance; first candidate retained.' : undefined;

  return {
    ...base,
    state,
    discrepancy,
    ...(resolved ? { selected: { ...resolved }, selectedReason } : {}),
    reason: state === 'agreement'
      ? 'Candidates agree exactly.'
      : state === 'within-tolerance'
        ? 'Difference is within policy tolerance.'
        : 'Material disagreement; candidates are preserved and never averaged.',
  };
}
