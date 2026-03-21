/**
 * SMSParser.ts
 * Standalone SMS parser for Indian bank/UPI/wallet transaction messages.
 * Called by SMSService.ts — returns structured fields parsed from raw SMS.
 */

export interface ParsedTransaction {
  amount: number;
  type: 'debit' | 'credit';
  merchant: string | null;
  accountLast4: string | null;
  balance: string | null;
  refNumber: string | null;
  datetime: string | null;
  rawText: string;
}

// ─── Amount ────────────────────────────────────────────────────────────────
const AMOUNT_RE = /(?:Rs\.?|INR|₹)\s?([\d,]+(?:\.\d{1,2})?)/i;

export function extractAmount(sms: string): number | null {
  const match = sms.match(AMOUNT_RE);
  if (!match) return null;
  const amount = parseFloat(match[1].replace(/,/g, ''));
  return isNaN(amount) ? null : amount;
}

// ─── Transaction type ──────────────────────────────────────────────────────
const DEBIT_RE =
  /\b(debited|debit|spent|paid|payment|withdrawn|sent|transferred out|purchase|dr)\b/i;
const CREDIT_RE =
  /\b(credited|credit|received|deposited|refund|cashback|added|cr)\b/i;

function extractType(sms: string): 'debit' | 'credit' {
  if (CREDIT_RE.test(sms)) return 'credit';
  if (DEBIT_RE.test(sms)) return 'debit';
  return 'debit';
}

// ─── Merchant / Payee ──────────────────────────────────────────────────────
const MERCHANT_PATTERNS: RegExp[] = [
  /(?:paid\s+to|payment\s+to|sent\s+to|transferred\s+to)\s+([A-Za-z0-9 &'.\-]+?)(?:\s+(?:on|via|ref|utr|using|for|Rs|INR|₹)|[.,]|$)/i,
  /(?:to\s+VPA\s+)([a-zA-Z0-9.\-_@]+)/i,
  /(?:at|to|from)\s+([A-Z][A-Za-z0-9 &'.\-]{2,40})(?:\s+(?:on|via|ref|utr|for|Rs|INR|₹)|[.,]|$)/i,
  /(?:Info:\s*)([A-Za-z0-9 &'.\-]{3,50})/i,
];

function extractMerchant(sms: string): string | null {
  for (const re of MERCHANT_PATTERNS) {
    const m = sms.match(re);
    if (m) {
      const val = m[1].trim();
      if (/^(your|the|a|an|is|has|been|bank|account|card)$/i.test(val)) continue;
      return val;
    }
  }
  return null;
}

// ─── Account / Card last 4 ────────────────────────────────────────────────
const ACCOUNT_RE =
  /(?:a(?:ccount|\/c|c)[\s#]*(?:no\.?\s*)?(?:ending|ending in|no\.?|xx+)?[\s:]*(?:xx+)?(\d{4})|card\s+(?:ending\s+)?(?:no\.?\s*)?(?:xx+)?(\d{4})|xx(\d{4}))/i;

function extractAccount(sms: string): string | null {
  const m = sms.match(ACCOUNT_RE);
  if (!m) return null;
  return m[1] ?? m[2] ?? m[3] ?? null;
}

// ─── Available balance ────────────────────────────────────────────────────
const BALANCE_RE =
  /(?:avail(?:able)?\s+(?:bal(?:ance)?|limit)|bal(?:ance)?\s+(?:is|:))\s*(?:Rs\.?|INR|₹)?\s?([\d,]+(?:\.\d{1,2})?)/i;

function extractBalance(sms: string): string | null {
  const m = sms.match(BALANCE_RE);
  return m ? m[1].replace(/,/g, '') : null;
}

// ─── Reference / UTR number ───────────────────────────────────────────────
const REF_RE =
  /(?:ref(?:erence)?(?:\s*no\.?)?|utr(?:\s*no\.?)?|txn(?:\s*id)?|transaction\s+id|imps\s+ref)\s*[:\-]?\s*([A-Z0-9]{8,22})/i;

function extractRef(sms: string): string | null {
  const m = sms.match(REF_RE);
  return m ? m[1] : null;
}

// ─── Date & time ──────────────────────────────────────────────────────────
const DATE_RE =
  /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})/i;
const TIME_RE = /(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)/i;

function extractDatetime(sms: string): string | null {
  const dateMatch = sms.match(DATE_RE);
  const timeMatch = sms.match(TIME_RE);
  if (!dateMatch && !timeMatch) return null;
  return [dateMatch?.[1], timeMatch?.[1]].filter(Boolean).join(' ');
}

// ─── Main export ──────────────────────────────────────────────────────────

/**
 * Parse a raw SMS string into a structured transaction object.
 * Returns null if no valid amount could be extracted (not a transaction SMS).
 */
export function parseSMS(rawText: string): ParsedTransaction | null {
  const amount = extractAmount(rawText);
  if (amount === null) return null;

  return {
    amount,
    type: extractType(rawText),
    merchant: extractMerchant(rawText),
    accountLast4: extractAccount(rawText),
    balance: extractBalance(rawText),
    refNumber: extractRef(rawText),
    datetime: extractDatetime(rawText),
    rawText,
  };
}