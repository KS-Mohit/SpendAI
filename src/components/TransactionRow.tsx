import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { getCategoryByKey } from '../constants/categories';
import { useColors } from '../theme/ThemeContext';
import { ColorScheme } from '../theme/colors';

interface TransactionRowProps {
  category: string;
  name: string;
  date: string;
  amount: number;
  onPress?: () => void;
}

function getCategoryColors(c: ColorScheme): Record<string, string> {
  return {
    food: c.primaryContainer,
    travel: c.secondaryContainer,
    bills: c.tertiaryContainer,
    shopping: c.primaryContainer,
    entertainment: c.secondaryContainer,
    other: c.surfaceContainerHigh,
  };
}

function getCategoryTextColors(c: ColorScheme): Record<string, string> {
  return {
    food: c.onPrimaryContainer,
    travel: c.onSecondaryContainer,
    bills: c.onTertiaryContainer,
    shopping: c.onPrimaryContainer,
    entertainment: c.onSecondaryContainer,
    other: c.onSurface,
  };
}

export default function TransactionRow({
  category,
  name,
  date,
  amount,
  onPress,
}: TransactionRowProps) {
  const { colors } = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const cat = getCategoryByKey(category);
  const icon = cat?.icon ?? '\u2795';
  const bgColor = getCategoryColors(colors)[category] ?? colors.surfaceContainerHigh;

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.date}>{cat?.label ? `${cat.label} \u2022 ${date}` : date}</Text>
      </View>
      <Text style={styles.amount}>
        - {'\u20b9'}{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </Text>
    </TouchableOpacity>
  );
}

function createStyles(c: ColorScheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: c.surfaceContainerLow,
      borderRadius: 16,
      marginBottom: 8,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    icon: {
      fontSize: 20,
    },
    info: {
      flex: 1,
    },
    name: {
      fontSize: 15,
      fontWeight: '600',
      color: c.onSurface,
      letterSpacing: -0.2,
    },
    date: {
      fontSize: 12,
      fontWeight: '400',
      color: c.onSurfaceVariant,
      marginTop: 3,
    },
    amount: {
      fontSize: 15,
      fontWeight: '700',
      color: c.onSurface,
      letterSpacing: -0.3,
      marginLeft: 12,
      flexShrink: 0,
    },
  });
}
