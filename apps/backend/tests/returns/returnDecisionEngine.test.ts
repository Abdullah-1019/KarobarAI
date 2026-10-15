import { decideAutomatedReturn, type ComparisonForDecision } from '../../src/modules/returns/return-decision-engine';

const settings = { enabled: true, acceptThreshold: 0.80, reviewThreshold: 0.60 };
function evidence(score: number): ComparisonForDecision {
  return { score, pairs: [score, score], referenceCount: 2, returnCount: 2,
    evidenceSufficient: true, comparisonCompleted: true, policyEligible: true };
}

describe('automated return decision boundaries', () => {
  test.each([
    [0.10, 'REJECTED'], [0.599, 'REJECTED'], [0.600, 'MANUAL_REVIEW'],
    [0.799, 'MANUAL_REVIEW'], [0.800, 'APPROVED'], [0.95, 'APPROVED'],
  ] as const)('%s yields %s', (score, expected) => {
    expect(decideAutomatedReturn(evidence(score), settings).decision).toBe(expected);
  });

  it('does not automate missing, invalid, conflicting, or ineligible evidence', () => {
    for (const change of [
      { policyEligible: false }, { evidenceSufficient: false }, { comparisonCompleted: false },
      { score: null }, { score: Number.NaN }, { score: Number.POSITIVE_INFINITY },
      { pairs: [0.1] }, { pairs: [0.1, Number.NaN] }, { referenceCount: 0 },
      { returnCount: 1 },
    ]) {
      expect(decideAutomatedReturn({ ...evidence(0.1), ...change }, settings).decision).toBe('MANUAL_REVIEW');
    }
  });

  it('checks that the overall score is the median of every paired score', () => {
    expect(decideAutomatedReturn({ ...evidence(0.7), pairs: [0.6, 0.8] }, settings).decision).toBe('MANUAL_REVIEW');
    expect(decideAutomatedReturn({ ...evidence(0.95), pairs: [0.1, 0.1] }, settings).reason).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('fails closed on invalid settings and when automation is disabled', () => {
    expect(decideAutomatedReturn(evidence(0.1), { ...settings, enabled: false }).reason).toBe('AUTOMATION_DISABLED');
    for (const reviewThreshold of [0.8, -0.1, Number.NaN]) {
      expect(decideAutomatedReturn(evidence(0.1), { ...settings, reviewThreshold }).reason).toBe('INVALID_CONFIGURATION');
    }
  });
});
