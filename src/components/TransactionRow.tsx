import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { getCategoryByKey } from '../constants/categories';
import { Colors } from '../theme/colors';

interface TransactionRowProps {
  category: string;
  name: string;
  date: string;
  amount: number;
  onPress?: () => void;
}

export default function TransactionRow({
  category,
  name,
  date,
  amount,
  onPress,
}: TransactionRowProps) {
  const cat = getCategoryByKey(category);
  const icon = cat?.icon ?? '➕';

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.leftSide}
        onPress={onPress}
        activeOpacity={0.6}
        disabled={!onPress}
      >
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.date}>{date}</Text>
        </View>
      </TouchableOpacity>
      <Text style={styles.amount}>
        ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  leftSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 16,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  date: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textMuted,
    marginTop: 2,
  },
  amount: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginLeft: 12,
    flexShrink: 0,
  },
});
