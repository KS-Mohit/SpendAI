import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useColors } from '../theme/ThemeContext';
import { ColorScheme } from '../theme/colors';
import { HealthResult } from '../services/HealthScoreService';
import { useCardExpand } from '../context/CardExpandContext';

interface HealthScoreCardProps {
  result: HealthResult;
}

const SIZE = 120;
const STROKE_WIDTH = 10;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const MINI_SIZE = 36;
const MINI_STROKE = 4;
const MINI_RADIUS = (MINI_SIZE - MINI_STROKE) / 2;
const MINI_CIRC = 2 * Math.PI * MINI_RADIUS;

export default function HealthScoreCard({ result }: HealthScoreCardProps) {
  const { colors } = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { expanded, toggle } = useCardExpand();
  const isExpanded = expanded.healthScore;
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: result.score,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [result.score]);

  const filledLength = (result.score / 100) * CIRCUMFERENCE;
  const emptyLength = CIRCUMFERENCE - filledLength;

  const miniFilledLength = (result.score / 100) * MINI_CIRC;
  const miniEmptyLength = MINI_CIRC - miniFilledLength;

  const scoreColor =
    result.score >= 70 ? colors.primary :
    result.score >= 45 ? colors.secondary :
    colors.error;

  const { breakdown } = result;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => toggle('healthScore')}
      activeOpacity={0.7}
    >
      {!isExpanded ? (
        /* COLLAPSED: compact single row */
        <View style={styles.collapsedRow}>
          <View style={styles.miniRingWrapper}>
            <Svg width={MINI_SIZE} height={MINI_SIZE}>
              <Circle
                cx={MINI_SIZE / 2}
                cy={MINI_SIZE / 2}
                r={MINI_RADIUS}
                stroke={colors.surfaceContainerHigh}
                strokeWidth={MINI_STROKE}
                fill="transparent"
              />
              <Circle
                cx={MINI_SIZE / 2}
                cy={MINI_SIZE / 2}
                r={MINI_RADIUS}
                stroke={scoreColor}
                strokeWidth={MINI_STROKE}
                fill="transparent"
                strokeDasharray={`${miniFilledLength} ${miniEmptyLength}`}
                strokeDashoffset={MINI_CIRC / 4}
                strokeLinecap="round"
                rotation={-90}
                origin={`${MINI_SIZE / 2}, ${MINI_SIZE / 2}`}
              />
            </Svg>
            <Text style={[styles.miniScore, { color: scoreColor }]}>{result.score}</Text>
          </View>
          <View style={styles.collapsedInfo}>
            <Text style={styles.collapsedTitle}>Financial Health</Text>
            <Text style={[styles.collapsedLabel, { color: scoreColor }]}>{result.label}</Text>
          </View>
          <Text style={styles.chevron}>{'\u25bc'}</Text>
        </View>
      ) : (
        /* EXPANDED: full view */
        <>
          <View style={styles.topRow}>
            <View style={styles.ringWrapper}>
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
                  stroke={scoreColor}
                  strokeWidth={STROKE_WIDTH}
                  fill="transparent"
                  strokeDasharray={`${filledLength} ${emptyLength}`}
                  strokeDashoffset={CIRCUMFERENCE / 4}
                  strokeLinecap="round"
                  rotation={-90}
                  origin={`${SIZE / 2}, ${SIZE / 2}`}
                />
              </Svg>
              <View style={styles.ringCenter}>
                <Text style={[styles.scoreNumber, { color: scoreColor }]}>{result.score}</Text>
                <Text style={styles.scoreOutOf}>/100</Text>
              </View>
            </View>

            <View style={styles.infoColumn}>
              <View style={styles.expandedHeader}>
                <Text style={styles.title}>Financial Health</Text>
                <Text style={styles.chevronUp}>{'\u25b2'}</Text>
              </View>
              <Text style={[styles.label, { color: scoreColor }]}>{result.label}</Text>

              <View style={styles.breakdownList}>
                <BreakdownBar label="Diversity" value={breakdown.diversity} color={colors} />
                <BreakdownBar label="Consistency" value={breakdown.consistency} color={colors} />
                <BreakdownBar label="Budget" value={breakdown.adherence} color={colors} />
              </View>
            </View>
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

function BreakdownBar({ label, value, color }: { label: string; value: number; color: ColorScheme }) {
  const barColor = value >= 70 ? color.primary : value >= 45 ? color.secondary : color.error;
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 10, color: color.onSurfaceVariant, fontWeight: '500' }}>{label}</Text>
        <Text style={{ fontSize: 10, color: color.onSurfaceVariant, fontWeight: '700' }}>{value}</Text>
      </View>
      <View style={{ height: 4, backgroundColor: color.surfaceContainerHigh, borderRadius: 2 }}>
        <View style={{ height: 4, width: `${value}%`, backgroundColor: barColor, borderRadius: 2 }} />
      </View>
    </View>
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
    miniRingWrapper: {
      width: MINI_SIZE,
      height: MINI_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    miniScore: {
      position: 'absolute',
      fontSize: 11,
      fontWeight: '800',
    },
    collapsedInfo: {
      flex: 1,
    },
    collapsedTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: c.onSurface,
    },
    collapsedLabel: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 1,
    },
    chevron: {
      fontSize: 10,
      color: c.onSurfaceVariant,
    },
    chevronUp: {
      fontSize: 10,
      color: c.onSurfaceVariant,
    },

    // Expanded
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 20,
    },
    expandedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    ringWrapper: {
      width: SIZE,
      height: SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringCenter: {
      position: 'absolute',
      alignItems: 'center',
    },
    scoreNumber: {
      fontSize: 32,
      fontWeight: '800',
      letterSpacing: -1,
    },
    scoreOutOf: {
      fontSize: 11,
      fontWeight: '600',
      color: c.onSurfaceVariant,
      marginTop: -2,
    },
    infoColumn: {
      flex: 1,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: c.onSurface,
      marginBottom: 2,
    },
    label: {
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 12,
    },
    breakdownList: {
      gap: 6,
    },
  });
}
