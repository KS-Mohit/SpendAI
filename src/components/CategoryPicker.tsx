import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CATEGORIES } from '../constants/categories';
import { useColors } from '../theme/ThemeContext';
import { ColorScheme } from '../theme/colors';
import CategoryIcon from './CategoryIcon';

interface CategoryPickerProps {
  selected: string | null;
  onSelect: (category: string) => void;
  suggestion?: string | null;
  confidence?: number | null;
}

export default function CategoryPicker({
  selected,
  onSelect,
}: CategoryPickerProps) {
  const { colors } = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.grid}>
      {CATEGORIES.map((cat) => {
        const isSelected = selected === cat.key;
        return (
          <TouchableOpacity
            key={cat.key}
            style={[styles.button, isSelected && styles.buttonSelected]}
            onPress={() => onSelect(cat.key)}
            activeOpacity={0.7}
          >
            <CategoryIcon
              name={cat.icon}
              size={56}
              iconSize={24}
              backgroundColor={isSelected ? colors.primaryContainer : colors.surfaceContainerLowest}
              iconColor={isSelected ? colors.primary : colors.onSurfaceVariant}
            />
            <Text style={[styles.label, isSelected && styles.labelSelected]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function createStyles(c: ColorScheme) {
  return StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 12,
    },
    button: {
      width: '30%',
      alignItems: 'center',
      paddingVertical: 12,
      gap: 8,
    },
    buttonSelected: {},
    label: {
      fontSize: 10,
      fontWeight: '500',
      color: c.onSurfaceVariant,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    labelSelected: {
      color: c.primary,
      fontWeight: '700',
    },
  });
}
