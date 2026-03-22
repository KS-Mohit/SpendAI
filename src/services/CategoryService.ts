import { CATEGORIES } from '../constants/categories';

export interface CategorySuggestion {
  category: string | null;
  confidence: number | null;
}

const VALID_CATEGORIES = CATEGORIES.map((c) => c.key);

const SYSTEM_PROMPT = `You categorize bank transactions from SMS text.
Only use merchant, app, or service names as signals.
Never guess from amounts alone.
If no merchant info exists, return null for category.
Respond ONLY with JSON, no explanation, no markdown.`;

export async function suggestCategory(
  rawSms: string,
  generate: (prompt: string, maxTokens?: number) => Promise<string>
): Promise<CategorySuggestion> {
  const prompt = `${SYSTEM_PROMPT}\n\nSMS: "${rawSms}"`;

  try {
    const raw = await generate(prompt, 64);

    // Try to extract JSON from the response
    const jsonMatch = raw.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      return { category: null, confidence: null };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const category =
      typeof parsed.category === 'string' &&
      VALID_CATEGORIES.includes(parsed.category.toLowerCase())
        ? parsed.category.toLowerCase()
        : null;

    const confidence =
      typeof parsed.confidence === 'number' &&
      parsed.confidence >= 0 &&
      parsed.confidence <= 100
        ? Math.round(parsed.confidence)
        : null;

    return { category, confidence };
  } catch (err) {
    console.warn('Category suggestion failed:', err);
    return { category: null, confidence: null };
  }
}

export function buildInsightPrompt(transactionsJson: string): string {
  return `You are a personal finance assistant. Be concise, max 3 sentences.\n\nHere are this month's transactions: ${transactionsJson}. Give me a brief spending summary.`;
}

export function buildAnomalyPrompt(
  avg: number,
  amount: number,
  category: string
): string {
  return `You flag unusual transactions. One sentence only.\n\nAverage spend last 30 days: ₹${avg}. New transaction: ₹${amount} — ${category}. Unusual?`;
}

export function buildQueryPrompt(
  transactionsJson: string,
  question: string
): string {
  return `Answer questions about spending from the data provided. Be direct and brief.\n\nTransactions: ${transactionsJson}. Question: "${question}"`;
}

function buildSpendingSummary(transactionsJson: string): string {
  try {
    const txs: { amount: number; category: string; date: string; note: string | null }[] =
      JSON.parse(transactionsJson);

    if (txs.length === 0) return 'No transactions recorded yet.';

    const totalSpend = txs.reduce((sum, t) => sum + t.amount, 0);
    const byCategory: Record<string, number> = {};
    txs.forEach((t) => {
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    });

    const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    const breakdown = sorted
      .map(([cat, amt]) => `${cat}: ₹${amt.toLocaleString('en-IN')} (${Math.round((amt / totalSpend) * 100)}%)`)
      .join(', ');

    return `Total spending: ₹${totalSpend.toLocaleString('en-IN')} across ${txs.length} transactions. Breakdown: ${breakdown}.`;
  } catch {
    return transactionsJson;
  }
}

export function buildChatPrompt(
  transactionsJson: string,
  question: string,
  salary?: { amount: number; period: 'monthly' | 'yearly'; currency: string } | null
): string {
  const salaryContext = salary
    ? ` Income: ${salary.currency}${salary.amount.toLocaleString()}/${salary.period === 'monthly' ? 'mo' : 'yr'}.`
    : '';

  const summary = buildSpendingSummary(transactionsJson);

  return `Finance assistant. Use ONLY data below. Be brief (2-3 sentences). Use ₹ only.${salaryContext}

${summary}

Q: ${question}`;
}
