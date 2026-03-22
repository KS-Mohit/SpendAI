export interface Category {
  key: string;
  label: string;
  icon: string;       // MaterialCommunityIcons name
  iconFallback: string; // simple text fallback
}

export const CATEGORIES: Category[] = [
  { key: 'food', label: 'Food', icon: 'silverware-fork-knife', iconFallback: 'F' },
  { key: 'travel', label: 'Travel', icon: 'train-car', iconFallback: 'T' },
  { key: 'bills', label: 'Bills', icon: 'receipt', iconFallback: 'B' },
  { key: 'shopping', label: 'Shopping', icon: 'shopping-outline', iconFallback: 'S' },
  { key: 'entertainment', label: 'Entertainment', icon: 'movie-open-outline', iconFallback: 'E' },
  { key: 'other', label: 'Other', icon: 'dots-horizontal', iconFallback: '+' },
];

export function getCategoryByKey(key: string): Category | undefined {
  return CATEGORIES.find((c) => c.key === key);
}
