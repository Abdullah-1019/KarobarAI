import { config } from '../../core/config';

export type AutomatedDecision = 'APPROVED' | 'REJECTED' | 'MANUAL_REVIEW';
export type DecisionReason = 'HIGH_SIMILARITY' | 'LOW_SIMILARITY' | 'UNCERTAIN_SIMILARITY'
  | 'INSUFFICIENT_EVIDENCE' | 'POLICY_INELIGIBLE' | 'AUTOMATION_DISABLED' | 'INVALID_CONFIGURATION';

export interface ComparisonForDecision {
  score: number | null;
  pairs: number[];
  referenceCount: number;
  returnCount: number;
  evidenceSufficient: boolean;
  comparisonCompleted: boolean;
  policyEligible: boolean;
}

export interface ReturnDecisionResult {
  decision: AutomatedDecision;
  reason: DecisionReason;
  acceptThreshold: number;
  reviewThreshold: number;
}

/** DINOv2 cosine similarity is an uncalibrated visual indicator, never identity proof. */
export function decideAutomatedReturn(
  input: ComparisonForDecision,
  settings = config.returnDecisions,
): ReturnDecisionResult {
  const base = { acceptThreshold: settings.acceptThreshold, reviewThreshold: settings.reviewThreshold };
  const review = (reason: DecisionReason): ReturnDecisionResult => ({ ...base, decision: 'MANUAL_REVIEW', reason });
  if (!Number.isFinite(settings.reviewThreshold) || !Number.isFinite(settings.acceptThreshold)
    || settings.reviewThreshold < 0 || settings.acceptThreshold > 1
    || settings.reviewThreshold >= settings.acceptThreshold) return review('INVALID_CONFIGURATION');
  if (!settings.enabled) return review('AUTOMATION_DISABLED');
  if (!input.policyEligible) return review('POLICY_INELIGIBLE');
  if (!input.comparisonCompleted || !input.evidenceSufficient || input.score === null
    || !Number.isFinite(input.score) || input.score < -1 || input.score > 1
    || input.referenceCount < 1 || input.returnCount !== input.referenceCount
    || input.pairs.length !== input.referenceCount
    || input.pairs.some((score) => !Number.isFinite(score) || score < -1 || score > 1)) {
    return review('INSUFFICIENT_EVIDENCE');
  }
  const sorted = [...input.pairs].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
  if (Math.abs(median - input.score) > 0.00001) return review('INSUFFICIENT_EVIDENCE');
  if (input.score >= settings.acceptThreshold) return { ...base, decision: 'APPROVED', reason: 'HIGH_SIMILARITY' };
  if (input.score < settings.reviewThreshold) return { ...base, decision: 'REJECTED', reason: 'LOW_SIMILARITY' };
  return review('UNCERTAIN_SIMILARITY');
}
