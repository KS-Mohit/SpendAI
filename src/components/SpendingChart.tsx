import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

interface ChartData {
  label: string;
  value: number;
}

interface SpendingChartProps {
  data: ChartData[];
}

const CHART_HEIGHT = 140;
const MIN_BAR_WIDTH = 12;

export default function SpendingChart({ data }: SpendingChartProps) {
  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No spending data yet</Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  // Y-axis labels
  const yLabels = [maxValue, Math.round(maxValue * 0.66), Math.round(maxValue * 0.33), 0];

  return (
    <View style={styles.container}>
      <View style={styles.chartRow}>
        {/* Y-axis */}
        <View style={styles.yAxis}>
          {yLabels.map((v, i) => (
            <Text key={i} style={styles.yLabel}>
              {v > 0 ? v : ''}
            </Text>
          ))}
        </View>

        {/* Chart area */}
        <View style={styles.chartArea}>
          {/* Grid lines */}
          <View style={styles.gridLines}>
            {yLabels.map((_, i) => (
              <View key={i} style={styles.gridLine} />
            ))}
          </View>

          {/* Bars — anchored to bottom baseline */}
          <View style={styles.barsContainer}>
            {data.map((item, i) => {
              const barHeight =
                item.value > 0
                  ? Math.max((item.value / maxValue) * CHART_HEIGHT, 4)
                  : 0;
              return (
                <View key={i} style={styles.barColumn}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        minWidth: MIN_BAR_WIDTH,
                      },
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

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 8,
  },
  chartRow: {
    flexDirection: 'row',
  },
  yAxis: {
    width: 32,
    height: CHART_HEIGHT,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 8,
  },
  yLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '400',
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
    backgroundColor: Colors.border,
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
    width: 16,
    backgroundColor: Colors.accent,
    borderRadius: 4,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 6,
  },
  labelColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '400',
  },
  empty: {
    height: CHART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
});
