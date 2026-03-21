import React, { useState, useCallback, useRef } from 'react';
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
import { Colors } from '../theme/colors';
import TotalHeader, { TimePeriod } from '../components/TotalHeader';
import SpendingChart from '../components/SpendingChart';
import TransactionRow from '../components/TransactionRow';
import {
  getTransactionsInRange,
  Transaction,
} from '../services/DatabaseService';
import { seedFakeData } from '../services/seedData';
import { RootStackParamList } from '../types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

function getPeriodRange(period: TimePeriod): { start: number; end: number } {
  const now = new Date();
  const endTs = Math.floor(now.getTime() / 1000);
  let startDate: Date;

  switch (period) {
    case 'week': {
      const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
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

function formatDateGroup(ts: number): string {
  const d = new Date(ts * 1000);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Latest';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

  const day = d.getDate();
  const month = d.toLocaleString('en', { month: 'short' });
  const weekday = d.toLocaleString('en', { weekday: 'long' });
  return `${weekday}`;
}

function formatRowDate(ts: number): string {
  const d = new Date(ts * 1000);
  const day = d.getDate();
  const month = d.toLocaleString('en', { month: 'short' });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
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
    // Current week: Monday to Sunday
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
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

  // year
  const months: { label: string; value: number }[] = [];
  for (let m = 0; m <= now.getMonth(); m++) {
    const label = new Date(now.getFullYear(), m).toLocaleString('en', {
      month: 'short',
    });
    const total = transactions
      .filter((t) => new Date(t.created_at * 1000).getMonth() === m)
      .reduce((sum, t) => sum + t.amount, 0);
    months.push({ label, value: total });
  }
  return months;
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
  const [period, setPeriod] = useState<TimePeriod>('week');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const seededRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        // Seed fake data once
        if (!seededRef.current) {
          seededRef.current = true;
          await seedFakeData();
        }

        const { start, end } = getPeriodRange(period);
        const txs = await getTransactionsInRange(start, end);
        setTransactions(txs);
        setTotal(txs.reduce((sum, t) => sum + t.amount, 0));
      }
      load();
    }, [period])
  );

  const chartData = buildChartData(transactions, period);
  const grouped = groupByDate(transactions);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Personal</Text>
          <Text style={styles.headerChevron}> ↕</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Text style={styles.headerIcon}>⌕</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Text style={styles.headerIcon}>⇅</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('Dev')}
          >
            <Text style={styles.headerIcon}>⚙</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={grouped}
        keyExtractor={(item) => item.title}
        ListHeaderComponent={
          <>
            <TotalHeader
              total={total}
              period={period}
              onPeriodChange={setPeriod}
            />
            <SpendingChart data={chartData} />
          </>
        }
        renderItem={({ item: group }) => (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            {group.data.map((tx) => (
              <TransactionRow
                key={tx.id}
                category={tx.category}
                name={parseMerchantName(tx.raw_sms)}
                date={formatRowDate(tx.created_at)}
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

      {/* AI Chat tab */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.bottomBtn}
          onPress={() => navigation.navigate('Insights')}
        >
          <Text style={styles.bottomBtnIcon}>AI</Text>
        </TouchableOpacity>
      </View>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() =>
          navigation.navigate('ConfirmTransaction', {
            amount: 0,
            rawSms: '',
          })
        }
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerChevron: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.backgroundMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
  listContent: {
    paddingBottom: 100,
  },
  group: {
    paddingHorizontal: 20,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textMuted,
    marginBottom: 2,
    marginTop: 16,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 12,
    paddingBottom: 28,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  bottomBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.backgroundMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBtnIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 90,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    fontSize: 26,
    fontWeight: '300',
    color: Colors.background,
    marginTop: -1,
  },
});
