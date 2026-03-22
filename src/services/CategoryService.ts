import { CATEGORIES } from '../constants/categories';
import { searchGuidance } from './RAGService';

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

interface ParsedTx {
  amount: number;
  category: string;
  date: string; // e.g. "22/3/2026"
}

interface ParsedSpending {
  total: number;
  count: number;
  byCategory: { name: string; amount: number; pct: number }[];
}

function parseDateStr(d: string): Date | null {
  // Parse "DD/MM/YYYY" or "D/M/YYYY" format from toLocaleDateString('en-IN')
  const parts = d.split('/');
  if (parts.length !== 3) return null;
  return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
}

function filterByPeriod(txs: ParsedTx[], period: 'week' | 'today' | 'month'): ParsedTx[] {
  const now = new Date();
  if (period === 'month') return txs; // already filtered to current month

  return txs.filter((t) => {
    const d = parseDateStr(t.date);
    if (!d) return false;
    if (period === 'today') {
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    // week: last 7 days
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo && d <= now;
  });
}

function summarize(txs: ParsedTx[]): ParsedSpending | null {
  if (txs.length === 0) return null;
  const total = txs.reduce((sum, t) => sum + t.amount, 0);
  const byCat: Record<string, number> = {};
  txs.forEach((t) => {
    byCat[t.category] = (byCat[t.category] || 0) + t.amount;
  });
  const byCategory = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => ({
      name,
      amount,
      pct: Math.round((amount / total) * 100),
    }));
  return { total, count: txs.length, byCategory };
}

function parseTransactions(transactionsJson: string): ParsedSpending | null {
  try {
    const txs: ParsedTx[] = JSON.parse(transactionsJson);
    return summarize(txs);
  } catch {
    return null;
  }
}

function parseRaw(transactionsJson: string): ParsedTx[] {
  try {
    return JSON.parse(transactionsJson) as ParsedTx[];
  } catch {
    return [];
  }
}

function detectPeriod(q: string): 'week' | 'today' | 'month' {
  if (q.includes('today') || q.includes('todays')) return 'today';
  if (q.includes('week') || q.includes('past 7') || q.includes('last 7')) return 'week';
  return 'month';
}

function periodLabel(p: 'week' | 'today' | 'month'): string {
  if (p === 'today') return 'today';
  if (p === 'week') return 'this week';
  return 'this month';
}

function formatAmount(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/**
 * Try to answer data questions directly from JS (instant, accurate).
 * Returns null if it can't handle the question.
 */
export function tryDirectAnswer(
  transactionsJson: string,
  question: string,
  salary?: { amount: number; period: 'monthly' | 'yearly'; currency: string } | null
): string | null {
  const allTxs = parseRaw(transactionsJson);
  if (allTxs.length === 0) return null;

  const q = question.toLowerCase();
  const period = detectPeriod(q);
  const txs = filterByPeriod(allTxs, period);
  const label = periodLabel(period);

  const data = summarize(txs);
  if (!data) {
    if (period !== 'month') return `You have no transactions ${label}.`;
    return null;
  }

  const { total, count, byCategory } = data;
  const top = byCategory[0];

  // Category-specific: "how much on food", "food spending", "travel expenses", "what did I spend on bills"
  for (const cat of byCategory) {
    if (q.includes(cat.name)) {
      if (q.includes('how much') || q.includes('spend') || q.includes('total') || q.includes('expense') || q.includes('cost') || q.includes('what did')) {
        return `You spent ${formatAmount(cat.amount)} on ${cat.name} ${label}, which is ${cat.pct}% of your total spending of ${formatAmount(total)}.${cat.pct > 30 ? ' That\'s a significant portion of your budget.' : ''}`;
      }
    }
  }

  // Biggest / most / top / highest / where am I spending
  if (q.includes('biggest') || q.includes('most') || q.includes('top') || q.includes('highest') || q.includes('where') || q.includes('main')) {
    let response = `Your biggest spending category ${label} is ${top.name} at ${formatAmount(top.amount)} (${top.pct}% of total ${formatAmount(total)}).`;
    if (byCategory.length > 1) {
      response += ` Followed by ${byCategory[1].name} at ${formatAmount(byCategory[1].amount)} (${byCategory[1].pct}%).`;
    }
    return response;
  }

  // Total / how much overall / all spending
  const mentionsCategory = byCategory.some((c) => q.includes(c.name));
  if ((q.includes('total') || q.includes('how much') || q.includes('overall') || q.includes('all')) && !mentionsCategory) {
    const catList = byCategory.map((c) => `${c.name}: ${formatAmount(c.amount)} (${c.pct}%)`).join(', ');
    return `You spent ${formatAmount(total)} across ${count} transactions ${label}. Breakdown: ${catList}.`;
  }

  // Summary / overview / breakdown / report / purchases / expenses
  if (q.includes('summary') || q.includes('overview') || q.includes('breakdown') || q.includes('report') || q.includes('purchases') || q.includes('expenses') || q.includes('recap')) {
    const catList = byCategory.map((c) => `${c.name}: ${formatAmount(c.amount)} (${c.pct}%)`).join(', ');
    let response = `${label.charAt(0).toUpperCase() + label.slice(1)}: ${formatAmount(total)} across ${count} transactions. ${catList}.`;
    if (salary) {
      const monthly = salary.period === 'yearly' ? salary.amount / 12 : salary.amount;
      const savingsPct = Math.round(((monthly - total) / monthly) * 100);
      response += ` You're saving about ${savingsPct}% of your income.`;
    }
    return response;
  }

  // Smallest / least / lowest
  if (q.includes('smallest') || q.includes('least') || q.includes('lowest') || q.includes('minimum')) {
    const last = byCategory[byCategory.length - 1];
    return `Your smallest spending category ${label} is ${last.name} at ${formatAmount(last.amount)} (${last.pct}% of total).`;
  }

  // How many transactions / expenses / purchases
  if (q.includes('how many') && (q.includes('transaction') || q.includes('expense') || q.includes('purchase'))) {
    return `You have ${count} transactions ${label} totaling ${formatAmount(total)} across ${byCategory.length} categories.`;
  }

  // Average / daily / per day
  if (q.includes('average') || q.includes('per day')) {
    const now = new Date();
    const days = period === 'week' ? 7 : period === 'today' ? 1 : now.getDate();
    const dailyAvg = total / days;
    return `Your average daily spending ${label} is ${formatAmount(dailyAvg)}. Total: ${formatAmount(total)} over ${days} day${days > 1 ? 's' : ''}.`;
  }

  // Compare categories / difference
  if (q.includes('compare') || q.includes('difference') || q.includes('vs') || q.includes('versus')) {
    if (byCategory.length >= 2) {
      const catList = byCategory.map((c) => `${c.name}: ${formatAmount(c.amount)} (${c.pct}%)`).join(', ');
      return `Category comparison ${label}: ${catList}. The gap between ${byCategory[0].name} and ${byCategory[byCategory.length - 1].name} is ${formatAmount(byCategory[0].amount - byCategory[byCategory.length - 1].amount)}.`;
    }
  }

  // Budget / saving / afford / left
  if (q.includes('budget') || q.includes('saving') || q.includes('left') || q.includes('afford') || q.includes('remaining')) {
    if (salary) {
      const monthly = salary.period === 'yearly' ? salary.amount / 12 : salary.amount;
      const remaining = monthly - total;
      const savingsPct = Math.round((remaining / monthly) * 100);
      return `You've spent ${formatAmount(total)} of your ${formatAmount(monthly)} monthly income ${label}. ${remaining > 0 ? `You have ${formatAmount(remaining)} remaining (${savingsPct}% saved).` : `You've overspent by ${formatAmount(Math.abs(remaining))}.`}`;
    }
    return `You've spent ${formatAmount(total)} ${label}. Set your income in settings for savings analysis.`;
  }

  return null; // Can't answer directly — fall through to RAG + LLM
}

function buildSpendingSummary(transactionsJson: string): string {
  const data = parseTransactions(transactionsJson);
  if (!data) return 'No transactions recorded yet.';

  const breakdown = data.byCategory
    .map((c) => `${c.name}: ${formatAmount(c.amount)} (${c.pct}%)`)
    .join(', ');

  return `Total spending: ${formatAmount(data.total)} across ${data.count} transactions. Breakdown: ${breakdown}.`;
}

export function buildChatPrompt(
  transactionsJson: string,
  question: string,
  salary?: { amount: number; period: 'monthly' | 'yearly'; currency: string } | null
): string {
  const salaryContext = salary
    ? ` Income: ${salary.currency}${salary.amount.toLocaleString()}/${salary.period === 'monthly' ? 'mo' : 'yr'}.`
    : '';

  let summary = buildSpendingSummary(transactionsJson);

  // Search RAG for relevant financial guidance
  const ragChunks = searchGuidance(question, 2);
  const ragContext = ragChunks.length > 0
    ? `\n\nGUIDANCE:\n${ragChunks.join('\n')}`
    : '';

  // Cap prompt at ~1900 chars for fast inference
  const MAX_PROMPT_LEN = 1900;
  const header = `Finance assistant. Use ONLY data and guidance below. Be brief (2-3 sentences). Use ₹ only.${salaryContext}`;
  const footer = `\nQ: ${question}`;
  const available = MAX_PROMPT_LEN - header.length - footer.length - ragContext.length - 4;
  if (summary.length > available) {
    summary = summary.substring(0, Math.max(available - 3, 50)) + '...';
  }

  return `${header}\n\n${summary}${ragContext}${footer}`;
}
