import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '../theme/ThemeContext';
import { ColorScheme } from '../theme/colors';
import { CATEGORIES } from '../constants/categories';
import { getAllBudgets, setBudget, deleteBudget } from '../services/DatabaseService';

export default function BudgetScreen() {
  const navigation = useNavigation();
  const { colors } = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const budgets = await getAllBudgets();
      const map: Record<string, string> = {};
      budgets.forEach((b) => {
        map[b.category] = b.amount.toString();
      });
      setAmounts(map);
    }
    load();
  }, []);

  function updateAmount(category: string, value: string) {
    setAmounts((prev) => ({ ...prev, [category]: value }));
    setSaved(false);
  }

  async function handleSave() {
    for (const cat of CATEGORIES) {
      const val = amounts[cat.key]?.trim();
      const num = parseFloat(val?.replace(/,/g, '') || '');

      if (!isNaN(num) && num > 0) {
        await setBudget(cat.key, num);
      } else if (val === '' || val === undefined) {
        await deleteBudget(cat.key);
      }
    }
    setSaved(true);
    setTimeout(() => navigation.goBack(), 600);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Monthly Budgets</Text>
      <Text style={styles.subtitle}>
        Set spending limits for each category. Leave empty to skip.
      </Text>

      <View style={styles.list}>
        {CATEGORIES.map((cat) => (
          <View key={cat.key} style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowIcon}>{cat.icon}</Text>
              <Text style={styles.rowLabel}>{cat.label}</Text>
            </View>
            <View style={styles.inputWrapper}>
              <Text style={styles.currencyPrefix}>{'\u20b9'}</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={colors.outlineVariant}
                value={amounts[cat.key] || ''}
                onChangeText={(v) => updateAmount(cat.key, v)}
                keyboardType="numeric"
                returnKeyType="done"
              />
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, saved && styles.saveBtnSaved]}
        onPress={handleSave}
        activeOpacity={0.8}
      >
        <Text style={styles.saveBtnText}>
          {saved ? 'Saved!' : 'Save Budgets'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function createStyles(c: ColorScheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    content: {
      padding: 24,
      paddingBottom: 60,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: c.primary,
      marginBottom: 4,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 14,
      color: c.onSurfaceVariant,
      marginBottom: 28,
      lineHeight: 20,
    },
    list: {
      gap: 12,
      marginBottom: 32,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: c.surfaceContainerLow,
      borderRadius: 20,
      padding: 16,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    rowIcon: {
      fontSize: 22,
    },
    rowLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: c.onSurface,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surfaceContainerLowest,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 8,
      minWidth: 110,
    },
    currencyPrefix: {
      fontSize: 16,
      fontWeight: '600',
      color: c.onSurfaceVariant,
      marginRight: 4,
    },
    input: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: c.onSurface,
      paddingVertical: 0,
    },
    saveBtn: {
      backgroundColor: c.primary,
      borderRadius: 28,
      paddingVertical: 18,
      alignItems: 'center',
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 6,
    },
    saveBtnSaved: {
      backgroundColor: c.primaryContainer,
    },
    saveBtnText: {
      fontSize: 17,
      fontWeight: '700',
      color: c.onPrimary,
      letterSpacing: -0.3,
    },
  });
}
