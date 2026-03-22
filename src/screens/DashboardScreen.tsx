import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColors } from '../theme/ThemeContext';
import { ColorScheme } from '../theme/colors';
import MonthlySpendingCard, { CardViewMode } from '../components/MonthlySpendingCard';
import TransactionRow from '../components/TransactionRow';
import HealthScoreCard from '../components/HealthScoreCard';
import BudgetProgressCard from '../components/BudgetProgressCard';
import {
  getTransactionsInRange,
  getAllBudgets,
  Transaction,
  Budget,
} from '../services/DatabaseService';
import { calculateHealthScore, HealthResult } from '../services/HealthScoreService';
import { predictMonthEndSpending, SpendingPrediction } from '../services/PredictionService';
import { seedFakeData } from '../services/seedData';
import { getCategoryByKey } from '../constants/categories';
import { RootStackParamList } from '../types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;
type TimePeriod = 'week' | 'month' | 'year';

function getCategoryChartColors(c: ColorScheme): Record<string, string> {
  return {
    food: c.primary,
    travel: c.secondary,
    bills: c.tertiary,
    shopping: c.primaryDim,
    entertainment: '#7B6BA8',
    other: c.outline,
  };
}

function getPeriodRange(period: TimePeriod): { start: number; end: number } {
  const now = new Date();
  const endTs = Math.floor(now.getTime() / 1000);
  let startDate: Date;

  switch (period) {
    case 'week': {
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      startDate = new Date(now);
      startDate.setDate(now.getDate() + mondayOffset);
      startDate.setHours(0, 0, 0, 0);
      break;
    }
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
  }

  return { start: Math.floor(startDate.getTime() / 1000), end: endTs };
}

function getPeriodLabel(period: TimePeriod): string {
  switch (period) {
    case 'week':
      return 'WEEKLY SPENDING';
    case 'month':
      return 'MONTHLY SPENDING';
    case 'year':
      return 'YEARLY SPENDING';
  }
}

function formatDateGroup(ts: number): string {
  const d = new Date(ts * 1000);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

  const month = d.toLocaleString('en', { month: 'short' });
  const day = d.getDate();
  return `${month} ${day}`;
}

function formatRowTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
}

function formatRowDateFull(ts: number): string {
  const d = new Date(ts * 1000);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) {
    return `Today, ${formatRowTime(ts)}`;
  }
  if (d.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${formatRowTime(ts)}`;
  }
  const month = d.toLocaleString('en', { month: 'short' });
  const day = d.getDate();
  return `${month} ${day}, ${formatRowTime(ts)}`;
}

function parseMerchantName(rawSms: string | null): string {
  if (!rawSms) return 'Transaction';
  const merchants = [
    'Swiggy', 'Zomato', 'Uber', 'Ola', 'Amazon', 'Flipkart',
    'Paytm', 'PhonePe', 'Netflix', 'Hotstar', 'Myntra',
    'BigBasket', 'Spotify', 'Electricity Bill',
  ];
  for (const m of merchants) {
    if (rawSms.toLowerCase().includes(m.toLowerCase())) return m;
  }
  const patterns = [
    /(?:for|at|to|towards)\s+([A-Za-z][A-Za-z0-9\s]{2,20})/i,
  ];
  for (const p of patterns) {
    const match = rawSms.match(p);
    if (match && match[1]) return match[1].trim();
  }
  return 'Transaction';
}

function buildChartData(
  transactions: Transaction[],
  period: TimePeriod
): { label: string; value: number }[] {
  const now = new Date();

  if (period === 'week') {
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const days: { label: string; value: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toDateString();
      const total = transactions
        .filter((t) => new Date(t.created_at * 1000).toDateString() === dateStr)
        .reduce((sum, t) => sum + t.amount, 0);
      days.push({ label: dayLabels[i], value: total });
    }
    return days;
  }

  if (period === 'month') {
    const weeks: { label: string; value: number }[] = [
      { label: 'W1', value: 0 },
      { label: 'W2', value: 0 },
      { label: 'W3', value: 0 },
      { label: 'W4', value: 0 },
    ];
    transactions.forEach((t) => {
      const d = new Date(t.created_at * 1000);
      const weekIdx = Math.min(Math.floor((d.getDate() - 1) / 7), 3);
      weeks[weekIdx].value += t.amount;
    });
    return weeks;
  }

  // year — all 12 months
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const months: { label: string; value: number }[] = [];
  for (let m = 0; m < 12; m++) {
    const total = transactions
      .filter((t) => new Date(t.created_at * 1000).getMonth() === m)
      .reduce((sum, t) => sum + t.amount, 0);
    months.push({ label: monthLabels[m], value: total });
  }
  return months;
}

function buildCategoryData(
  transactions: Transaction[],
  colors: ColorScheme
): { key: string; label: string; percentage: number; color: string }[] {
  if (transactions.length === 0) return [];

  const chartColors = getCategoryChartColors(colors);
  const totals: Record<string, number> = {};
  let grandTotal = 0;

  transactions.forEach((t) => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
    grandTotal += t.amount;
  });

  if (grandTotal === 0) return [];

  return Object.entries(totals)
    .map(([key, amount]) => ({
      key,
      label: getCategoryByKey(key)?.label ?? key,
      percentage: (amount / grandTotal) * 100,
      color: chartColors[key] ?? colors.outline,
    }))
    .sort((a, b) => b.percentage - a.percentage);
}

interface GroupedTransactions {
  title: string;
  data: Transaction[];
}

function groupByDate(transactions: Transaction[]): GroupedTransactions[] {
  const groups: { [key: string]: Transaction[] } = {};
  const order: string[] = [];
  transactions.forEach((t) => {
    const key = formatDateGroup(t.created_at);
    if (!groups[key]) {
      groups[key] = [];
      order.push(key);
    }
    groups[key].push(t);
  });
  return order.map((title) => ({ title, data: groups[title] }));
}

export default function DashboardScreen() {
  const navigation = useNavigation<NavProp>();
  const { colors, isDark, toggle } = useColors();
  const [period, setPeriod] = useState<TimePeriod>('month');
  const [viewMode, setViewMode] = useState<CardViewMode>('summary');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [monthTransactions, setMonthTransactions] = useState<Transaction[]>([]);
  const [monthTotal, setMonthTotal] = useState(0);
  const seededRef = useRef(false);

  const styles = useMemo(() => createStyles(colors), [colors]);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        if (!seededRef.current) {
          seededRef.current = true;
          await seedFakeData();
        }

        const { start, end } = getPeriodRange(period);
        const txs = await getTransactionsInRange(start, end);
        setTransactions(txs);
        setTotal(txs.reduce((sum, t) => sum + t.amount, 0));

        // Always load current month data for health score, budgets, predictions
        const { start: mStart, end: mEnd } = getPeriodRange('month');
        const mTxs = await getTransactionsInRange(mStart, mEnd);
        setMonthTransactions(mTxs);
        setMonthTotal(mTxs.reduce((sum, t) => sum + t.amount, 0));

        const b = await getAllBudgets();
        setBudgets(b);
      }
      load();
    }, [period])
  );

  const chartData = buildChartData(transactions, period);
  const categoryData = buildCategoryData(transactions, colors);
  const grouped = groupByDate(transactions);

  // Health score (always based on current month)
  const healthResult: HealthResult = useMemo(
    () => calculateHealthScore(monthTransactions, budgets),
    [monthTransactions, budgets]
  );

  // Spending by category for budget progress
  const categorySpending: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    monthTransactions.forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return map;
  }, [monthTransactions]);

  // Month-end prediction
  const prediction: SpendingPrediction | null = useMemo(
    () => (monthTotal > 0 ? predictMonthEndSpending(monthTotal) : null),
    [monthTotal]
  );

  const totalFormatted = total.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const [totalWhole, totalDecimal] = totalFormatted.split('.');

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>HX</Text>
          </View>
          <Text style={styles.headerTitle}>HackXtreme</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={toggle}
          >
            <Text style={styles.headerIcon}>{isDark ? '\u2600' : '\u263D'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('Dev')}
          >
            <Text style={styles.headerIcon}>&#9881;</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={grouped}
        keyExtractor={(item) => item.title}
        ListHeaderComponent={
          <>
            {/* Total Balance */}
            <View style={styles.balanceSection}>
              <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
              <Text style={styles.balanceAmount}>
                &#8377;{totalWhole}
                <Text style={styles.balanceDecimal}>.{totalDecimal}</Text>
              </Text>
            </View>

            {/* Period toggle: Week / Month / Year */}
            <View style={styles.periodToggleContainer}>
              <View style={styles.periodToggle}>
                {(['week', 'month', 'year'] as TimePeriod[]).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.periodBtn,
                      period === p && styles.periodBtnActive,
                    ]}
                    onPress={() => setPeriod(p)}
                  >
                    <Text
                      style={[
                        styles.periodText,
                        period === p && styles.periodTextActive,
                      ]}
                    >
                      {p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'Year'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Spending Card (hero) — 3 view modes */}
            <MonthlySpendingCard
              spendAmount={total}
              periodLabel={getPeriodLabel(period)}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              chartData={chartData}
              categoryData={categoryData}
              prediction={period === 'month' ? prediction : null}
            />

            {/* Health Score */}
            <HealthScoreCard result={healthResult} />

            {/* Budget Goals */}
            <BudgetProgressCard
              budgets={budgets}
              spending={categorySpending}
              onSetBudgets={() => navigation.navigate('Budget')}
            />

            {/* Recent Activity header */}
            <View style={styles.activityHeader}>
              <Text style={styles.activityTitle}>Recent Activity</Text>
              <TouchableOpacity>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
          </>
        }
        renderItem={({ item: group }) => (
          <View style={styles.group}>
            {group.data.map((tx) => (
              <TransactionRow
                key={tx.id}
                category={tx.category}
                name={parseMerchantName(tx.raw_sms)}
                date={formatRowDateFull(tx.created_at)}
                amount={tx.amount}
                onPress={() =>
                  navigation.navigate('TransactionDetail', { id: tx.id })
                }
              />
            ))}
          </View>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Bottom Navigation: Dashboard | + Add | Analysis */}
      <View style={styles.bottomBar}>
        {/* Dashboard tab */}
        <TouchableOpacity
          style={styles.navSlot}
          activeOpacity={0.7}
        >
          <View style={styles.navItemInner}>
            <Text style={styles.navIconActive}>&#9638;</Text>
            <Text style={styles.navLabelActive}>Dashboard</Text>
          </View>
        </TouchableOpacity>

        {/* Center FAB slot */}
        <View style={styles.navSlot}>
          <TouchableOpacity
            style={styles.fabWrapper}
            onPress={() =>
              navigation.navigate('ConfirmTransaction', {
                amount: 0,
                rawSms: '',
              })
            }
            activeOpacity={0.8}
          >
            <View style={styles.fabCircle}>
              <Text style={styles.fabIcon}>+</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Analysis tab */}
        <TouchableOpacity
          style={styles.navSlot}
          onPress={() => navigation.navigate('Insights')}
          activeOpacity={0.7}
        >
          <View style={styles.navItemInner}>
            <Text style={styles.navIconActive}>&#10022;</Text>
            <Text style={styles.navLabelActive}>Analysis</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createStyles(c: ColorScheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    avatarPlaceholder: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.surfaceContainerHighest,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 11,
      fontWeight: '700',
      color: c.onSurfaceVariant,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: c.primary,
      letterSpacing: -0.5,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    headerIconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerIcon: {
      fontSize: 18,
      color: c.onSurfaceVariant,
    },

    // Balance
    balanceSection: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 20,
    },
    balanceLabel: {
      fontSize: 10,
      fontWeight: '500',
      color: c.onSurfaceVariant,
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    balanceAmount: {
      fontSize: 52,
      fontWeight: '800',
      color: c.primary,
      letterSpacing: -2,
    },
    balanceDecimal: {
      fontSize: 36,
      color: c.primaryDim,
      opacity: 0.3,
    },

    // Period toggle
    periodToggleContainer: {
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    periodToggle: {
      flexDirection: 'row',
      backgroundColor: c.surfaceContainerLow,
      borderRadius: 24,
      padding: 4,
      alignSelf: 'flex-start',
    },
    periodBtn: {
      paddingVertical: 8,
      paddingHorizontal: 18,
      borderRadius: 20,
    },
    periodBtnActive: {
      backgroundColor: c.primary,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
    },
    periodText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.onSurfaceVariant,
    },
    periodTextActive: {
      color: c.onPrimary,
      fontWeight: '700',
    },

    // Activity
    activityHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      marginTop: 24,
      marginBottom: 12,
    },
    activityTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: c.onSurface,
      letterSpacing: -0.3,
    },
    viewAllText: {
      fontSize: 14,
      fontWeight: '600',
      color: c.primary,
    },

    // Transaction groups
    listContent: {
      paddingBottom: 120,
    },
    group: {
      paddingHorizontal: 20,
    },

    // Bottom nav — 3 equal slots
    bottomBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingBottom: 28,
      paddingTop: 12,
      backgroundColor: c.primary,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
    },
    navSlot: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navItemInner: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
    },
    navIconActive: {
      color: c.onPrimary,
    },
    navLabelActive: {
      fontSize: 10,
      fontWeight: '700',
      color: c.onPrimary,
      letterSpacing: 0,
    },

    // Center FAB — floats above the bar
    fabWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -32,
    },
    fabCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.onPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 8,
    },
    fabIcon: {
      fontSize: 28,
      fontWeight: '300',
      color: c.primary,
      marginTop: -2,
    },
  });
}
