import { insertTransactionAt, getAllTransactions, clearAllTransactions } from './DatabaseService';

let seeded = false;

export async function seedFakeData() {
  if (seeded) return;
  seeded = true;

  // If there are too many transactions (duplicates from reloads), clear and re-seed
  const existing = await getAllTransactions();
  if (existing.length > 11) {
    await clearAllTransactions();
  } else if (existing.length > 0) {
    return;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const fakeTransactions = [
    // Today
    { amount: 249, category: 'entertainment', ai_suggestion: 'entertainment', confidence: 88, note: null, raw_sms: 'Your a/c XX1234 debited Rs.249 for Spotify Premium subscription', daysAgo: 0 },
    { amount: 856.80, category: 'food', ai_suggestion: 'food', confidence: 92, note: 'Weekly groceries', raw_sms: 'Rs.856.80 debited from a/c XX1234 at BigBasket order #BG9912', daysAgo: 0 },

    // Yesterday
    { amount: 326.40, category: 'travel', ai_suggestion: 'travel', confidence: 95, note: null, raw_sms: 'Uber trip completed. Rs.326.40 charged to your card XX5678', daysAgo: 1 },
    { amount: 416.20, category: 'food', ai_suggestion: 'food', confidence: 85, note: 'Team lunch', raw_sms: 'Your a/c XX1234 debited Rs.416.20 for Swiggy order #SW8834', daysAgo: 1 },

    // 2 days ago
    { amount: 1200, category: 'bills', ai_suggestion: 'bills', confidence: 90, note: null, raw_sms: 'Rs.1200 debited from a/c XX1234 towards Electricity Bill', daysAgo: 2 },
    { amount: 599, category: 'shopping', ai_suggestion: 'shopping', confidence: 78, note: null, raw_sms: 'Your a/c XX1234 debited Rs.599 for Myntra order #MYN4421', daysAgo: 2 },

    // 3 days ago
    { amount: 180, category: 'travel', ai_suggestion: 'travel', confidence: 93, note: 'Office commute', raw_sms: 'Ola ride completed. Rs.180 charged to your card XX5678', daysAgo: 3 },

    // 4 days ago
    { amount: 345, category: 'food', ai_suggestion: 'food', confidence: 91, note: null, raw_sms: 'Your a/c XX1234 debited Rs.345 for Zomato order #ZM5567', daysAgo: 4 },
    { amount: 499, category: 'entertainment', ai_suggestion: 'entertainment', confidence: 82, note: null, raw_sms: 'Rs.499 debited from a/c XX1234 towards Netflix subscription', daysAgo: 4 },

    // 5 days ago
    { amount: 2150, category: 'shopping', ai_suggestion: 'shopping', confidence: 88, note: 'New headphones', raw_sms: 'Your a/c XX1234 debited Rs.2150 for Amazon order #AMZ7723', daysAgo: 5 },

    // 6 days ago
    { amount: 125, category: 'food', ai_suggestion: 'food', confidence: 70, note: 'Chai and snacks', raw_sms: 'You have done a UPI txn of Rs.125 to 9876543210@paytm', daysAgo: 6 },
  ];

  for (const tx of fakeTransactions) {
    const txDate = new Date(today);
    txDate.setDate(txDate.getDate() - tx.daysAgo);
    // Fixed times per transaction (deterministic — no random)
    const fixedHours = [10, 14, 11, 19, 9, 16, 12, 18, 20, 13, 15];
    const fixedMins  = [30, 15, 45, 0, 20, 50, 10, 35, 5, 40, 25];
    const idx = fakeTransactions.indexOf(tx);
    txDate.setHours(fixedHours[idx % fixedHours.length], fixedMins[idx % fixedMins.length]);
    const createdAt = Math.floor(txDate.getTime() / 1000);

    await insertTransactionAt(
      {
        amount: tx.amount,
        category: tx.category,
        ai_suggestion: tx.ai_suggestion,
        confidence: tx.confidence,
        user_overrode: 0,
        note: tx.note,
        raw_sms: tx.raw_sms,
      },
      createdAt
    );
  }
}
