import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors } from '../theme/ThemeContext';
import { ColorScheme } from '../theme/colors';
import { Budget } from '../services/DatabaseService';
import { getCategoryByKey } from '../constants/categories';
import { useCardExpand } from '../context/CardExpandContext';

interface CategorySpending {
  category: string;
  spent: number;
  budget: number;
}

interface BudgetProgressCardProps {
  budgets: Budget[];
  spending: Record<string, number>;
  onSetBudgets: () => void;
}

export default function BudgetProgressCard({
  budgets,
  spending,
  onSetBudgets,
}: BudgetProgressCardProps) {
  const { colors } = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { expanded, toggle } = useCardExpand();
  const isExpanded = expanded.budgetGoals;

  const items: CategorySpending[] = budgets.map((b) => ({
    category: b.category,
    spent: spending[b.category] || 0,
    budget: b.amount,
  }));

  const onTrackCount = items.filter((i) => i.budget > 0 && (i.spent / i.budget) < 1).length;
  const summaryText = items.length > 0
    ? `${onTrackCount}/${items.length} on track`
    : 'No budgets set';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => toggle('budgetGoals')}
      activeOpacity={0.7}
    >
      {!isExpanded ? (
        /* COLLAPSED */
        <View style={styles.collapsedRow}>
          <View style={styles.collapsedIcon}>
            <Text style={styles.collapsedIconText}>{'\u{1F3AF}'}</Text>
          </View>
          <View style={styles.collapsedInfo}>
            <Text style={styles.collapsedTitle}>Budget Goals</Text>
            <Text style={styles.collapsedSummary}>{summaryText}</Text>
          </View>
          <Text style={styles.chevron}>{'\u25bc'}</Text>
        </View>
      ) : (
        /* EXPANDED */
        <>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Budget Goals</Text>
            <View style={styles.headerRight}>
              <TouchableOpacity onPress={onSetBudgets}>
                <Text style={styles.editBtn}>{budgets.length > 0 ? 'Edit' : 'Set Budgets'}</Text>
              </TouchableOpacity>
              <Text style={styles.chevronUp}>{'\u25b2'}</Text>
            </View>
          </View>

          {items.length === 0 ? (
            <TouchableOpacity style={styles.emptyState} onPress={onSetBudgets}>
              <Text style={styles.emptyIcon}>+</Text>
              <Text style={styles.emptyText}>Set monthly budgets to track your spending goals</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.list}>
              {items.map((item) => {
                const cat = getCategoryByKey(item.category);
                const pct = item.budget > 0 ? (item.spent / item.budget) * 100 : 0;
                const isOver = pct >= 100;
                const isWarning = pct >= 80 && !isOver;
                const barColor = isOver
                  ? colors.error
                  : isWarning
                  ? colors.secondary
                  : colors.primary;

                return (
                  <View key={item.category} style={styles.item}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemIcon}>{cat?.icon ?? '+'}</Text>
                      <Text style={styles.itemLabel}>{cat?.label ?? item.category}</Text>
                      <Text style={[styles.itemAmount, isOver && { color: colors.error }]}>
                        {'\u20b9'}{Math.round(item.spent).toLocaleString('en-IN')}
                        <Text style={styles.itemBudget}> / {'\u20b9'}{item.budget.toLocaleString('en-IN')}</Text>
                      </Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.min(pct, 100)}%`,
                            backgroundColor: barColor,
                          },
                        ]}
                      />
                    </View>
                    {isOver && (
                      <Text style={styles.overText}>
                        Over by {'\u20b9'}{Math.round(item.spent - item.budget).toLocaleString('en-IN')}
                      </Text>
                    )}
                    {isWarning && (
                      <Text style={styles.warningText}>
                        {Math.round(100 - pct)}% remaining
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

function createStyles(c: ColorScheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surfaceContainerLowest,
      borderRadius: 24,
      padding: 20,
      marginHorizontal: 20,
      marginBottom: 16,
      shadowColor: 'rgba(0,0,0,0.06)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 16,
      elevation: 3,
    },

    // Collapsed
    collapsedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    collapsedIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    collapsedIconText: {
      fontSize: 16,
    },
    collapsedInfo: {
      flex: 1,
    },
    collapsedTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: c.onSurface,
    },
    collapsedSummary: {
      fontSize: 12,
      fontWeight: '600',
      color: c.onSurfaceVariant,
      marginTop: 1,
    },
    chevron: {
      fontSize: 10,
      color: c.onSurfaceVariant,
    },
    chevronUp: {
      fontSize: 10,
      color: c.onSurfaceVariant,
      marginLeft: 8,
    },

    // Expanded
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: c.onSurface,
    },
    editBtn: {
      fontSize: 13,
      fontWeight: '600',
      color: c.primary,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 16,
      gap: 8,
    },
    emptyIcon: {
      fontSize: 24,
      fontWeight: '300',
      color: c.primary,
      width: 40,
      height: 40,
      lineHeight: 40,
      textAlign: 'center',
      borderRadius: 20,
      backgroundColor: c.primaryContainer,
      overflow: 'hidden',
    },
    emptyText: {
      fontSize: 13,
      color: c.onSurfaceVariant,
      textAlign: 'center',
    },
    list: {
      gap: 14,
    },
    item: {
      gap: 6,
    },
    itemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    itemIcon: {
      fontSize: 16,
    },
    itemLabel: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: c.onSurface,
    },
    itemAmount: {
      fontSize: 13,
      fontWeight: '700',
      color: c.onSurface,
    },
    itemBudget: {
      fontWeight: '500',
      color: c.onSurfaceVariant,
    },
    barTrack: {
      height: 6,
      backgroundColor: c.surfaceContainerHigh,
      borderRadius: 3,
      overflow: 'hidden',
    },
    barFill: {
      height: 6,
      borderRadius: 3,
    },
    overText: {
      fontSize: 10,
      fontWeight: '600',
      color: c.error,
    },
    warningText: {
      fontSize: 10,
      fontWeight: '600',
      color: c.secondary,
    },
  });
}
