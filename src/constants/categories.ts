export interface Category {
  key: string;
  label: string;
  icon: string;
}

export const CATEGORIES: Category[] = [
  { key: 'food', label: 'Food', icon: '🍕' },
  { key: 'travel', label: 'Travel', icon: '✈️' },
  { key: 'bills', label: 'Bills', icon: '🏠' },
  { key: 'shopping', label: 'Shopping', icon: '🛍️' },
  { key: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { key: 'other', label: 'Other', icon: '➕' },
];

export function getCategoryByKey(key: string): Category | undefined {
  return CATEGORIES.find((c) => c.key === key);
}
