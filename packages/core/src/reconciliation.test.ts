import { describe, expect, it } from 'bun:test';
import { reconcileFinancialFacts } from './reconciliation';

const base = { period: '2025Q4', currency: 'USD', unit: 'USD', adjustment: 'reported' };

describe('reconcileFinancialFacts', () => {
  it('detects material conflict without averaging', () => {
    const r = reconcileFinancialFacts(
      [{ ...base, provider: 'a', value: 100 }, { ...base, provider: 'b', value: 120 }],
      { version: '1', relativeTolerance: 0.03 }
    );
    expect(r.state).toBe('material-conflict');
    expect(r.selected).toBeUndefined();
    expect(r.candidates.map((candidate) => candidate.value)).toEqual([100, 120]);
  });

  it('rejects mismatched semantics', () => {
    expect(
      reconcileFinancialFacts(
        [{ ...base, provider: 'a', value: 1 }, { ...base, provider: 'b', value: 1, period: '2024Q4' }],
        { version: '1' }
      ).state
    ).toBe('incomparable');
  });

  it('accepts tolerance', () => {
    expect(
      reconcileFinancialFacts(
        [{ ...base, provider: 'a', value: 100 }, { ...base, provider: 'b', value: 101 }],
        { version: '1', absoluteTolerance: 2 }
      ).state
    ).toBe('within-tolerance');
  });

  it('uses explicit provider priority without averaging', () => {
    const r = reconcileFinancialFacts(
      [{ ...base, provider: 'fallback', value: 100 }, { ...base, provider: 'primary', value: 130 }],
      { version: '1', providerPriority: ['primary', 'fallback'], relativeTolerance: 0.03 }
    );
    expect(r.state).toBe('material-conflict');
    expect(r.selected?.provider).toBe('primary');
    expect(r.selected?.value).toBe(130);
    expect(r.candidates.map((candidate) => candidate.value)).toEqual([100, 130]);
  });

  it('does not compare different instruments, metrics, or market timestamps', () => {
    const first = { ...base, provider: 'a', instrument: 'AAPL.US', metric: 'lastPrice', value: 100, asOf: 1000 };
    const policy = { version: '2', maxAsOfSkewMs: 60_000 };
    expect(reconcileFinancialFacts([first, { ...first, provider: 'b', instrument: 'MSFT.US' }], policy).state)
      .toBe('incomparable');
    expect(reconcileFinancialFacts([first, { ...first, provider: 'b', metric: 'high' }], policy).state)
      .toBe('incomparable');
    expect(reconcileFinancialFacts([first, { ...first, provider: 'b', asOf: 62_000 }], policy).state)
      .toBe('incomparable');
  });

  it('refuses monetary comparison when currency metadata is absent', () => {
    const r = reconcileFinancialFacts(
      [{ provider: 'a', value: 100 }, { provider: 'b', value: 100 }],
      { version: '2', requireCurrency: true }
    );
    expect(r.state).toBe('incomparable');
    expect(r.selected).toBeUndefined();
  });

  it('needs two distinct providers rather than two values from one provider', () => {
    const result = reconcileFinancialFacts(
      [{ ...base, provider: 'a', value: 100 }, { ...base, provider: 'a', value: 130 }],
      { version: '2' }
    );
    expect(result.state).toBe('insufficient-sources');
    expect(result.sourceCount).toBe(1);
  });
});
