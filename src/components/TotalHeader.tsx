import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

export type TimePeriod = 'week' | 'month' | 'year';

interface TotalHeaderProps {
  total: number;
  period: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
}

const PERIODS: TimePeriod[] = ['week', 'month', 'year'];

export default function TotalHeader({
  total,
  period,
  onPeriodChange,
}: TotalHeaderProps) {
  const formatted = total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [whole, decimal] = formatted.split('.');

  return (
    <View style={styles.container}>
      <Text style={styles.label}>TOTAL OUTFLOW</Text>
      <View style={styles.amountRow}>
        <Text style={styles.amount}>
          ₹{whole}
          <Text style={styles.amountDecimal}>.{decimal}</Text>
        </Text>
      </View>
      <View style={styles.toggleRow}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.toggleBtn, period === p && styles.toggleActive]}
            onPress={() => onPeriodChange(p)}
          >
            <Text
              style={[
                styles.toggleText,
                period === p && styles.toggleTextActive,
              ]}
            >
              {p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'Year'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.onSurfaceVariant,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  amount: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -2,
    marginBottom: 16,
  },
  amountDecimal: {
    color: Colors.surfaceContainerHighest,
    fontSize: 36,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 24,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
  },
  toggleActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
  },
  toggleTextActive: {
    color: Colors.onPrimary,
    fontWeight: '700',
  },
});
