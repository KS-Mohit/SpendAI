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
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Total Spending</Text>
      <Text style={styles.amount}>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
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
    paddingTop: 4,
    paddingBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textMuted,
  },
  amount: {
    fontSize: 34,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 2,
    marginBottom: 16,
    letterSpacing: -1,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundMuted,
    borderRadius: 10,
    padding: 3,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleActive: {
    backgroundColor: Colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  toggleTextActive: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
});
