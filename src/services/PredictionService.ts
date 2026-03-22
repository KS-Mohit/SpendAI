export interface SpendingPrediction {
  predicted: number;
  dailyAverage: number;
  daysRemaining: number;
  daysElapsed: number;
}

export function predictMonthEndSpending(
  totalSpentSoFar: number,
  currentDate?: Date
): SpendingPrediction {
  const now = currentDate ?? new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - dayOfMonth;

  const dailyAverage = dayOfMonth > 0 ? totalSpentSoFar / dayOfMonth : 0;
  const predicted = totalSpentSoFar + dailyAverage * daysRemaining;

  return {
    predicted,
    dailyAverage,
    daysRemaining,
    daysElapsed: dayOfMonth,
  };
}
