import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useColors } from '../theme/ThemeContext';
import { ColorScheme } from '../theme/colors';

interface CategoryData {
  key: string;
  label: string;
  percentage: number;
  color: string;
}

interface CategoryDonutChartProps {
  categories: CategoryData[];
}

const SIZE = 160;
const STROKE_WIDTH = 14;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function CategoryDonutChart({
  categories,
}: CategoryDonutChartProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const { colors } = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (categories.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No category data</Text>
      </View>
    );
  }

  const selected = categories[selectedIdx % categories.length];
  const percentage = selected.percentage;
  const filledLength = (percentage / 100) * CIRCUMFERENCE;
  const emptyLength = CIRCUMFERENCE - filledLength;

  function nextCategory() {
    setSelectedIdx((prev) => (prev + 1) % categories.length);
  }

  function prevCategory() {
    setSelectedIdx((prev) => (prev - 1 + categories.length) % categories.length);
  }

  return (
    <View style={styles.container}>
      {/* Category switcher */}
      <View style={styles.switcherRow}>
        <TouchableOpacity style={styles.switcherBtn} onPress={prevCategory}>
          <Text style={styles.switcherArrow}>{'\u2039'}</Text>
        </TouchableOpacity>
        <Text style={styles.switcherLabel}>{selected.label}</Text>
        <TouchableOpacity style={styles.switcherBtn} onPress={nextCategory}>
          <Text style={styles.switcherArrow}>{'\u203a'}</Text>
        </TouchableOpacity>
      </View>

      {/* Donut chart */}
      <View style={styles.chartWrapper}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={colors.surfaceContainerHigh}
            strokeWidth={STROKE_WIDTH}
            fill="transparent"
          />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={selected.color}
            strokeWidth={STROKE_WIDTH}
            fill="transparent"
            strokeDasharray={`${filledLength} ${emptyLength}`}
            strokeDashoffset={CIRCUMFERENCE / 4}
            strokeLinecap="round"
            rotation={-90}
            origin={`${SIZE / 2}, ${SIZE / 2}`}
          />
        </Svg>
        <View style={styles.centerLabel}>
          <Text style={styles.percentageText}>{Math.round(percentage)}%</Text>
          <Text style={styles.percentageSubLabel}>
            {selected.label.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={styles.title}>Category Health</Text>
      <Text style={styles.subtitle}>
        {selected.label} makes up {Math.round(percentage)}% of your spending.
      </Text>

      {/* Category dots / page indicator */}
      <View style={styles.dotsRow}>
        {categories.map((cat, i) => (
          <TouchableOpacity
            key={cat.key}
            onPress={() => setSelectedIdx(i)}
            style={[
              styles.dot,
              { backgroundColor: cat.color },
              i === selectedIdx % categories.length && styles.dotActive,
            ]}
          />
        ))}
      </View>

      {/* Full breakdown list */}
      <View style={styles.breakdownList}>
        {categories.map((cat) => (
          <View key={cat.key} style={styles.breakdownItem}>
            <View
              style={[styles.breakdownDot, { backgroundColor: cat.color }]}
            />
            <Text style={styles.breakdownLabel}>{cat.label}</Text>
            <Text style={styles.breakdownPercent}>
              {Math.round(cat.percentage)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function createStyles(c: ColorScheme) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingVertical: 24,
      paddingHorizontal: 20,
    },
    emptyText: {
      fontSize: 14,
      color: c.onSurfaceVariant,
      paddingVertical: 40,
    },

    // Switcher
    switcherRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginBottom: 20,
    },
    switcherBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.surfaceContainerLow,
      alignItems: 'center',
      justifyContent: 'center',
    },
    switcherArrow: {
      fontSize: 20,
      fontWeight: '600',
      color: c.primary,
      marginTop: -2,
    },
    switcherLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: c.onSurface,
      minWidth: 100,
      textAlign: 'center',
    },

    // Chart
    chartWrapper: {
      width: SIZE,
      height: SIZE,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    centerLabel: {
      position: 'absolute',
      alignItems: 'center',
    },
    percentageText: {
      fontSize: 36,
      fontWeight: '800',
      color: c.onSurface,
      letterSpacing: -1,
    },
    percentageSubLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: c.onSurfaceVariant,
      letterSpacing: 2,
      marginTop: 2,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: c.onSurface,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 13,
      color: c.onSurfaceVariant,
      textAlign: 'center',
      paddingHorizontal: 20,
      lineHeight: 18,
      marginBottom: 16,
    },

    // Page dots
    dotsRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 20,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      opacity: 0.35,
    },
    dotActive: {
      opacity: 1,
      width: 20,
      borderRadius: 4,
    },

    // Breakdown
    breakdownList: {
      width: '100%',
      gap: 10,
    },
    breakdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    breakdownDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    breakdownLabel: {
      flex: 1,
      fontSize: 13,
      fontWeight: '500',
      color: c.onSurface,
    },
    breakdownPercent: {
      fontSize: 13,
      fontWeight: '700',
      color: c.onSurface,
    },
  });
}
