import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors } from '../theme/ThemeContext';
import { ColorScheme } from '../theme/colors';
import SpendingChart from './SpendingChart';
import CategoryDonutChart from './CategoryDonutChart';

export type CardViewMode = 'summary' | 'chart' | 'category';

interface ChartData {
  label: string;
  value: number;
}

interface CategoryData {
  key: string;
  label: string;
  percentage: number;
  color: string;
}

interface MonthlySpendingCardProps {
  spendAmount: number;
  periodLabel: string;
  viewMode: CardViewMode;
  onViewModeChange: (mode: CardViewMode) => void;
  chartData: ChartData[];
  categoryData: CategoryData[];
}

export default function MonthlySpendingCard({
  spendAmount,
  periodLabel,
  viewMode,
  onViewModeChange,
  chartData,
  categoryData,
}: MonthlySpendingCardProps) {
  const { colors } = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {/* View mode toggle buttons */}
      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === 'summary' && styles.toggleBtnActive]}
          onPress={() => onViewModeChange('summary')}
        >
          <Text
            style={[
              styles.toggleIcon,
              viewMode === 'summary' && styles.toggleIconActive,
            ]}
          >
            {'\u25eb'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === 'chart' && styles.toggleBtnActive]}
          onPress={() => onViewModeChange('chart')}
        >
          <Text
            style={[
              styles.toggleIcon,
              viewMode === 'chart' && styles.toggleIconActive,
            ]}
          >
            {'\u25a5'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === 'category' && styles.toggleBtnActive]}
          onPress={() => onViewModeChange('category')}
        >
          <Text
            style={[
              styles.toggleIcon,
              viewMode === 'category' && styles.toggleIconActive,
            ]}
          >
            {'\u25d4'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* SUMMARY VIEW */}
      {viewMode === 'summary' && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{periodLabel}</Text>
          <Text style={styles.summaryAmount}>
            {'\u20b9'}{spendAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
      )}

      {/* BAR CHART VIEW */}
      {viewMode === 'chart' && (
        <View style={styles.chartViewContainer}>
          <SpendingChart data={chartData} />
        </View>
      )}

      {/* CATEGORY DONUT VIEW */}
      {viewMode === 'category' && (
        <View style={styles.categoryCard}>
          <CategoryDonutChart categories={categoryData} />
        </View>
      )}
    </View>
  );
}

function createStyles(c: ColorScheme) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: 20,
      marginBottom: 8,
    },
    viewToggle: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 6,
      marginBottom: 12,
    },
    toggleBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: c.surfaceContainerLow,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toggleBtnActive: {
      backgroundColor: c.primary,
    },
    toggleIcon: {
      fontSize: 16,
      color: c.onSurfaceVariant,
    },
    toggleIconActive: {
      color: c.onPrimary,
    },

    // Summary card
    summaryCard: {
      backgroundColor: c.primary,
      borderRadius: 24,
      paddingVertical: 28,
      paddingHorizontal: 24,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.2,
      shadowRadius: 20,
      elevation: 8,
    },
    summaryLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: 'rgba(255, 255, 255, 0.6)',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    summaryAmount: {
      fontSize: 34,
      fontWeight: '800',
      color: c.onPrimary,
      letterSpacing: -1,
    },

    // Chart view
    chartViewContainer: {
      marginHorizontal: -20,
    },

    // Category card
    categoryCard: {
      backgroundColor: c.surfaceContainerLowest,
      borderRadius: 24,
      shadowColor: 'rgba(42, 52, 57, 0.06)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 20,
      elevation: 3,
    },
  });
}
