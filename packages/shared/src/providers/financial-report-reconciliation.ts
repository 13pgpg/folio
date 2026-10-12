import type {
  FinancialFactCandidate,
  FinancialReport,
  ProviderResult,
  ReconciliationPolicy,
  ReconciliationResult,
} from '@finagent/core';
import { reconcileFinancialFacts } from '@finagent/core';

export interface FinancialReportComparison {
  metric: string;
  period: string;
  result: ReconciliationResult;
}

export interface FinancialReportReconciliation {
  /** The first successful provider in the gateway's configured routing order. */
  selected?: Extract<ProviderResult<FinancialReport>, { ok: true }>;
  comparisons: FinancialReportComparison[];
}

/** Compare equal statement fields and fiscal periods from every successful provider. */
export function reconcileFinancialReportResults(
  results: ProviderResult<FinancialReport>[],
  policyForMetric: (metric: string) => Partial<Pick<
    ReconciliationPolicy, 'absoluteTolerance' | 'relativeTolerance'
  >> = () => ({})
): FinancialReportReconciliation {
  const successes = results.filter(
    (result): result is Extract<ProviderResult<FinancialReport>, { ok: true }> => result.ok
  );
  const priority = successes.map((result) => result.provenance.providerId);
  const byFact = new Map<string, { metric: string; period: string; candidates: FinancialFactCandidate[] }>();
  for (const result of successes) {
    const report = result.data;
    for (const statementKind of ['IS', 'BS', 'CF'] as const) {
      const statement = report.statements[statementKind];
      if (!statement) continue;
      for (const indicator of statement.indicators) {
        for (const account of indicator.accounts) {
          const metric = `${statementKind}.${account.field}`;
          for (const value of account.values) {
            const period = `${value.year}:${value.period}`;
            const key = JSON.stringify([metric, period]);
            const fact = byFact.get(key) ?? { metric, period, candidates: [] };
            fact.candidates.push({
              provider: result.provenance.providerId,
              instrument: report.instrumentId ?? report.symbol,
              metric,
              value: value.value,
              asOf: value.fpEnd * 1000,
              period: `${report.report}:${period}`,
              currency: account.percent ? undefined : indicator.currency,
              unit: account.percent ? 'percent' : 'currency',
              adjustment: 'reported',
            });
            byFact.set(key, fact);
          }
        }
      }
    }
  }

  const comparisons = [...byFact.values()].map(({ metric, period, candidates }) => {
    const overrides = policyForMetric(metric);
    const policy: ReconciliationPolicy = {
      version: 'folio-financial-report/v1',
      absoluteTolerance: 0,
      providerPriority: priority,
      maxAsOfSkewMs: 0,
      requireCurrency: candidates[0]?.unit === 'currency',
      ...overrides,
    };
    return { metric, period, result: reconcileFinancialFacts(candidates, policy) };
  });
  return { selected: successes[0], comparisons };
}
