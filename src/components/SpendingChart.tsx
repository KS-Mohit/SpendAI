import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../theme/ThemeContext';
import { ColorScheme } from '../theme/colors';

interface ChartData {
  label: string;
  value: number;
}

interface SpendingChartProps {
  data: ChartData[];
}

const CHART_HEIGHT = 160;

export default function SpendingChart({ data }: SpendingChartProps) {
  const { colors } = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No spending data yet</Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={styles.container}>
      <View style={styles.chartCard}>
        <View style={styles.chartArea}>
          {/* Grid lines */}
          <View style={styles.gridLines}>
            <View style={styles.gridLine} />
            <View style={styles.gridLine} />
            <View style={styles.gridLine} />
          </View>

          {/* Bars */}
          <View style={styles.barsContainer}>
            {data.map((item, i) => {
              const barHeight =
                item.value > 0
                  ? Math.max((item.value / maxValue) * CHART_HEIGHT, 6)
                  : 0;
              const isMax = item.value === maxValue && item.value > 0;
              return (
                <View key={i} style={styles.barColumn}>
                  <View
                    style={[
                      styles.bar,
                      { height: barHeight },
                      isMax && styles.barHighlight,
                    ]}
                  />
                </View>
              );
            })}
          </View>

          {/* Labels row */}
          <View style={styles.labelsRow}>
            {data.map((item, i) => (
              <View key={i} style={styles.labelColumn}>
                <Text style={styles.barLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function createStyles(c: ColorScheme) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: 20,
      paddingVertical: 4,
    },
    chartCard: {
      backgroundColor: c.surfaceContainerLowest,
      borderRadius: 24,
      padding: 20,
      shadowColor: 'rgba(42, 52, 57, 0.04)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 20,
      elevation: 2,
    },
    chartArea: {
      flex: 1,
    },
    gridLines: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: CHART_HEIGHT,
      justifyContent: 'space-between',
    },
    gridLine: {
      height: 1,
      backgroundColor: c.surfaceContainerHigh,
      opacity: 0.5,
    },
    barsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'flex-end',
      height: CHART_HEIGHT,
    },
    barColumn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    bar: {
      width: 20,
      backgroundColor: c.primaryContainer,
      borderRadius: 10,
    },
    barHighlight: {
      backgroundColor: c.primary,
    },
    labelsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: 10,
    },
    labelColumn: {
      flex: 1,
      alignItems: 'center',
    },
    barLabel: {
      fontSize: 10,
      color: c.onSurfaceVariant,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    empty: {
      height: CHART_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceContainerLow,
      borderRadius: 24,
      marginHorizontal: 20,
    },
    emptyText: {
      fontSize: 13,
      color: c.onSurfaceVariant,
    },
  });
}
