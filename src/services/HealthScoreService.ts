import { Transaction, Budget } from './DatabaseService';

export interface HealthBreakdown {
  diversity: number;
  consistency: number;
  adherence: number;
}

export interface HealthResult {
  score: number;
  breakdown: HealthBreakdown;
  label: string;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** Category diversity: higher when spending is spread across categories */
function calcDiversity(transactions: Transaction[]): number {
  if (transactions.length === 0) return 50;

  const totals: Record<string, number> = {};
  let grandTotal = 0;
  transactions.forEach((t) => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
    grandTotal += t.amount;
  });

  if (grandTotal === 0) return 50;

  const categoryCount = Object.keys(totals).length;
  const maxPct = Math.max(...Object.values(totals)) / grandTotal;

  // More categories + lower concentration = better
  const categoryScore = clamp((categoryCount / 5) * 100, 0, 100);
  const concentrationScore = (1 - maxPct) * 100;

  return Math.round(categoryScore * 0.4 + concentrationScore * 0.6);
}

/** Spending consistency: lower variance in daily spend = higher score */
function calcConsistency(transactions: Transaction[]): number {
  if (transactions.length < 3) return 60;

  // Group by date
  const dailyTotals: Record<string, number> = {};
  transactions.forEach((t) => {
    const day = new Date(t.created_at * 1000).toDateString();
    dailyTotals[day] = (dailyTotals[day] || 0) + t.amount;
  });

  const values = Object.values(dailyTotals);
  if (values.length < 2) return 60;

  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean === 0) return 50;

  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const cv = Math.sqrt(variance) / mean; // coefficient of variation

  // CV < 0.3 = very consistent (score ~95)
  // CV ~ 1.0 = moderate (score ~60)
  // CV > 2.0 = very spiky (score ~20)
  return Math.round(clamp(100 - cv * 40, 10, 98));
}

/** Budget adherence: how well spending stays within set budgets */
function calcAdherence(
  transactions: Transaction[],
  budgets: Budget[]
): number {
  if (budgets.length === 0) return -1; // no budgets set

  const spent: Record<string, number> = {};
  transactions.forEach((t) => {
    spent[t.category] = (spent[t.category] || 0) + t.amount;
  });

  let totalScore = 0;
  budgets.forEach((b) => {
    const categorySpent = spent[b.category] || 0;
    const ratio = categorySpent / b.amount;

    if (ratio <= 0.8) totalScore += 100;      // well under budget
    else if (ratio <= 1.0) totalScore += 80;   // nearing budget
    else if (ratio <= 1.2) totalScore += 40;   // slightly over
    else totalScore += 10;                      // way over
  });

  return Math.round(totalScore / budgets.length);
}

export function calculateHealthScore(
  transactions: Transaction[],
  budgets: Budget[]
): HealthResult {
  const diversity = calcDiversity(transactions);
  const consistency = calcConsistency(transactions);
  const adherence = calcAdherence(transactions, budgets);

  let score: number;
  if (adherence < 0) {
    // No budgets — use only diversity and consistency
    score = Math.round(diversity * 0.5 + consistency * 0.5);
  } else {
    score = Math.round(diversity * 0.25 + consistency * 0.25 + adherence * 0.5);
  }

  score = clamp(score, 0, 100);

  let label: string;
  if (score >= 80) label = 'Excellent';
  else if (score >= 65) label = 'Good';
  else if (score >= 45) label = 'Fair';
  else label = 'Needs Work';

  return {
    score,
    breakdown: {
      diversity,
      consistency,
      adherence: adherence < 0 ? 50 : adherence,
    },
    label,
  };
}
