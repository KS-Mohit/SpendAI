import { insertTransactionAt, getAllTransactions, clearAllTransactions } from './DatabaseService';

let seeded = false;

export async function seedFakeData() {
  if (seeded) return;
  seeded = true;

  // Always clear and re-seed so relative dates (daysAgo) stay current
  const existing = await getAllTransactions();
  if (existing.length > 0) {
    await clearAllTransactions();
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const fakeTransactions = [
    // ── This week (recent) ──
    // Today
    { amount: 249, category: 'entertainment', ai_suggestion: 'entertainment', confidence: 88, note: null, raw_sms: 'Your a/c XX1234 debited Rs.249 for Spotify Premium subscription', daysAgo: 0, hour: 10, min: 30 },
    { amount: 856.80, category: 'food', ai_suggestion: 'food', confidence: 92, note: 'Weekly groceries', raw_sms: 'Rs.856.80 debited from a/c XX1234 at BigBasket order #BG9912', daysAgo: 0, hour: 14, min: 15 },

    // Yesterday
    { amount: 326.40, category: 'travel', ai_suggestion: 'travel', confidence: 95, note: null, raw_sms: 'Uber trip completed. Rs.326.40 charged to your card XX5678', daysAgo: 1, hour: 11, min: 45 },
    { amount: 416.20, category: 'food', ai_suggestion: 'food', confidence: 85, note: 'Team lunch', raw_sms: 'Your a/c XX1234 debited Rs.416.20 for Swiggy order #SW8834', daysAgo: 1, hour: 19, min: 0 },

    // 2 days ago
    { amount: 1200, category: 'bills', ai_suggestion: 'bills', confidence: 90, note: null, raw_sms: 'Rs.1200 debited from a/c XX1234 towards Electricity Bill', daysAgo: 2, hour: 9, min: 20 },
    { amount: 599, category: 'shopping', ai_suggestion: 'shopping', confidence: 78, note: null, raw_sms: 'Your a/c XX1234 debited Rs.599 for Myntra order #MYN4421', daysAgo: 2, hour: 16, min: 50 },

    // 3 days ago
    { amount: 180, category: 'travel', ai_suggestion: 'travel', confidence: 93, note: 'Office commute', raw_sms: 'Ola ride completed. Rs.180 charged to your card XX5678', daysAgo: 3, hour: 12, min: 10 },

    // 4 days ago
    { amount: 345, category: 'food', ai_suggestion: 'food', confidence: 91, note: null, raw_sms: 'Your a/c XX1234 debited Rs.345 for Zomato order #ZM5567', daysAgo: 4, hour: 18, min: 35 },
    { amount: 499, category: 'entertainment', ai_suggestion: 'entertainment', confidence: 82, note: null, raw_sms: 'Rs.499 debited from a/c XX1234 towards Netflix subscription', daysAgo: 4, hour: 20, min: 5 },

    // 5 days ago
    { amount: 2150, category: 'shopping', ai_suggestion: 'shopping', confidence: 88, note: 'New headphones', raw_sms: 'Your a/c XX1234 debited Rs.2150 for Amazon order #AMZ7723', daysAgo: 5, hour: 13, min: 40 },

    // 6 days ago
    { amount: 125, category: 'food', ai_suggestion: 'food', confidence: 70, note: 'Chai and snacks', raw_sms: 'You have done a UPI txn of Rs.125 to 9876543210@paytm', daysAgo: 6, hour: 15, min: 25 },

    // ── Earlier this month (week 2-3 range) ──
    // 10 days ago
    { amount: 780, category: 'food', ai_suggestion: 'food', confidence: 89, note: 'Dinner with friends', raw_sms: 'Your a/c XX1234 debited Rs.780 for Swiggy order #SW7210', daysAgo: 10, hour: 21, min: 0 },
    { amount: 150, category: 'travel', ai_suggestion: 'travel', confidence: 94, note: null, raw_sms: 'Ola ride completed. Rs.150 charged to your card XX5678', daysAgo: 10, hour: 8, min: 45 },

    // 14 days ago
    { amount: 1899, category: 'shopping', ai_suggestion: 'shopping', confidence: 86, note: 'Running shoes', raw_sms: 'Your a/c XX1234 debited Rs.1899 for Flipkart order #FK3319', daysAgo: 14, hour: 17, min: 20 },
    { amount: 290, category: 'food', ai_suggestion: 'food', confidence: 90, note: null, raw_sms: 'Your a/c XX1234 debited Rs.290 for Zomato order #ZM4412', daysAgo: 14, hour: 13, min: 10 },

    // 18 days ago
    { amount: 950, category: 'bills', ai_suggestion: 'bills', confidence: 87, note: 'Internet bill', raw_sms: 'Rs.950 debited from a/c XX1234 towards Airtel Broadband', daysAgo: 18, hour: 10, min: 0 },

    // ── Last month ──
    // 32 days ago
    { amount: 1450, category: 'food', ai_suggestion: 'food', confidence: 88, note: 'House party groceries', raw_sms: 'Rs.1450 debited from a/c XX1234 at BigBasket order #BG8801', daysAgo: 32, hour: 11, min: 30 },
    { amount: 3200, category: 'shopping', ai_suggestion: 'shopping', confidence: 91, note: 'Birthday gift', raw_sms: 'Your a/c XX1234 debited Rs.3200 for Amazon order #AMZ6610', daysAgo: 32, hour: 15, min: 45 },

    // 35 days ago
    { amount: 210, category: 'travel', ai_suggestion: 'travel', confidence: 96, note: null, raw_sms: 'Uber trip completed. Rs.210 charged to your card XX5678', daysAgo: 35, hour: 9, min: 15 },
    { amount: 375, category: 'food', ai_suggestion: 'food', confidence: 83, note: 'Late night order', raw_sms: 'Your a/c XX1234 debited Rs.375 for Swiggy order #SW6698', daysAgo: 35, hour: 23, min: 10 },

    // 40 days ago
    { amount: 1500, category: 'bills', ai_suggestion: 'bills', confidence: 92, note: null, raw_sms: 'Rs.1500 debited from a/c XX1234 towards Electricity Bill', daysAgo: 40, hour: 10, min: 20 },
    { amount: 699, category: 'entertainment', ai_suggestion: 'entertainment', confidence: 85, note: null, raw_sms: 'Rs.699 debited from a/c XX1234 towards Hotstar Premium', daysAgo: 40, hour: 19, min: 30 },

    // 45 days ago
    { amount: 520, category: 'food', ai_suggestion: 'food', confidence: 79, note: 'Weekend brunch', raw_sms: 'Your a/c XX1234 debited Rs.520 for Zomato order #ZM3356', daysAgo: 45, hour: 12, min: 0 },
    { amount: 430, category: 'travel', ai_suggestion: 'travel', confidence: 90, note: 'Airport cab', raw_sms: 'Ola ride completed. Rs.430 charged to your card XX5678', daysAgo: 45, hour: 6, min: 30 },
    { amount: 1100, category: 'other', ai_suggestion: null, confidence: null, note: 'Medical checkup', raw_sms: 'You have done a UPI txn of Rs.1100 to 9988776655@paytm', daysAgo: 45, hour: 14, min: 50 },
  ];

  for (const tx of fakeTransactions) {
    const txDate = new Date(today);
    txDate.setDate(txDate.getDate() - tx.daysAgo);
    txDate.setHours(tx.hour, tx.min);
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
