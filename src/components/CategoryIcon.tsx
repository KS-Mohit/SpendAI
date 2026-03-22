import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '../theme/ThemeContext';

interface CategoryIconProps {
  name: string;
  size?: number;
  iconSize?: number;
  backgroundColor?: string;
  iconColor?: string;
}

export default function CategoryIcon({
  name,
  size = 48,
  iconSize = 22,
  backgroundColor,
  iconColor,
}: CategoryIconProps) {
  const { colors } = useColors();
  const bg = backgroundColor ?? colors.surfaceContainerHigh;
  const fg = iconColor ?? colors.onSurfaceVariant;

  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <MaterialCommunityIcons name={name as any} size={iconSize} color={fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
