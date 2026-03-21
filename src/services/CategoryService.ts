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

export function buildChatPrompt(
  transactionsJson: string,
  question: string,
  salary?: { amount: number; period: 'monthly' | 'yearly'; currency: string } | null
): string {
  const salaryContext = salary
    ? `\nUser's ${salary.period} salary: ${salary.currency}${salary.amount.toLocaleString()}.`
    : '';

  return `You are a personal finance assistant analyzing the user's spending data. Be helpful, specific, and actionable. Keep responses concise (3-5 sentences max). Use numbers from the data when possible.${salaryContext}

Transactions: ${transactionsJson}

User: ${question}`;
}
