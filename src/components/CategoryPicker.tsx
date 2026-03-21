import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CATEGORIES } from '../constants/categories';
import { Colors } from '../theme/colors';

interface CategoryPickerProps {
  selected: string | null;
  suggestion: string | null;
  confidence: number | null;
  onSelect: (category: string) => void;
}

export default function CategoryPicker({
  selected,
  suggestion,
  confidence,
  onSelect,
}: CategoryPickerProps) {
  function getButtonStyle(key: string) {
    if (selected === key) {
      return [styles.button, styles.buttonSelected];
    }
    if (suggestion === key && confidence !== null) {
      if (confidence > 70) {
        return [styles.button, styles.buttonHighlight];
      }
      if (confidence >= 40) {
        return [styles.button, styles.buttonFaint];
      }
    }
    return [styles.button];
  }

  function getTextStyle(key: string) {
    if (selected === key) {
      return [styles.label, styles.labelSelected];
    }
    return [styles.label];
  }

  return (
    <View style={styles.grid}>
      {CATEGORIES.map((cat) => (
        <TouchableOpacity
          key={cat.key}
          style={getButtonStyle(cat.key)}
          onPress={() => onSelect(cat.key)}
          activeOpacity={0.7}
        >
          <Text style={styles.icon}>{cat.icon}</Text>
          <Text style={getTextStyle(cat.key)}>{cat.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    width: '30%',
    aspectRatio: 1.2,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  buttonSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  buttonHighlight: {
    borderColor: Colors.accent,
    borderWidth: 2,
  },
  buttonFaint: {
    borderColor: Colors.textMuted,
    borderStyle: 'dashed',
  },
  icon: {
    fontSize: 24,
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  labelSelected: {
    color: Colors.background,
  },
});
