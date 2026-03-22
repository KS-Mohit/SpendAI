import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColors } from '../theme/ThemeContext';
import { ColorScheme } from '../theme/colors';
import CategoryPicker from '../components/CategoryPicker';
import { insertTransaction } from '../services/DatabaseService';
import { RootStackParamList } from '../types';

type ScreenRouteProp = RouteProp<RootStackParamList, 'ConfirmTransaction'>;
type ScreenNavProp = NativeStackNavigationProp<RootStackParamList, 'ConfirmTransaction'>;

export default function ConfirmTransactionScreen() {
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<ScreenNavProp>();
  const { amount, rawSms } = route.params;
  const { colors } = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isManual = amount === 0 && !rawSms;
  const [manualAmount, setManualAmount] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const finalAmount = isManual ? parseFloat(manualAmount.replace(/,/g, '') || '0') : amount;

  async function handleSave() {
    if (!selected || finalAmount <= 0) return;
    setSaving(true);

    await insertTransaction({
      amount: finalAmount,
      category: selected,
      ai_suggestion: null,
      confidence: null,
      user_overrode: 0,
      note: note.trim() || null,
      raw_sms: rawSms,
    });

    navigation.navigate('Dashboard');
  }

  return (
    <View style={styles.overlay}>
      <TouchableWithoutFeedback onPress={() => navigation.goBack()}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={styles.card}>
        <View style={styles.handle} />

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.closeBtnText}>{'\u2715'}</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>New Expense</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Amount Hero */}
          <View style={styles.amountSection}>
            <Text style={styles.amountLabel}>AMOUNT TO LOG</Text>
            {isManual ? (
              <View style={styles.amountInputRow}>
                <Text style={styles.amountCurrency}>{'\u20b9'}</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor={colors.outlineVariant}
                  value={manualAmount}
                  onChangeText={(v) => {
                    const cleaned = v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                    setManualAmount(cleaned);
                  }}
                  keyboardType="numeric"
                  autoFocus
                />
              </View>
            ) : (
              <Text style={styles.amount}>
                <Text style={styles.amountCurrency}>{'\u20b9'}</Text>
                {amount.toLocaleString('en-IN')}
              </Text>
            )}
          </View>

          {rawSms ? (
            <Text style={styles.smsSnippet} numberOfLines={3}>
              {rawSms}
            </Text>
          ) : null}

          {/* Category Section */}
          <View style={styles.pickerSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>{'\u229e'}</Text>
              <Text style={styles.sectionLabel}>Category</Text>
            </View>
            <CategoryPicker
              selected={selected}
              onSelect={setSelected}
            />
          </View>

          {/* Notes Section */}
          <View style={styles.noteSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>{'\u2261'}</Text>
              <Text style={styles.sectionLabel}>Notes</Text>
            </View>
            <TextInput
              style={styles.noteInput}
              placeholder="What was it for?"
              placeholderTextColor={colors.outlineVariant}
              value={note}
              onChangeText={setNote}
              returnKeyType="done"
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, (!selected || finalAmount <= 0) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!selected || finalAmount <= 0 || saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.saveBtnText}>Save Expense</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

function createStyles(c: ColorScheme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    card: {
      backgroundColor: c.background,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      maxHeight: '90%',
      paddingBottom: 32,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 16,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.outlineVariant,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 4,
    },
    content: {
      padding: 24,
      paddingTop: 12,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
    },
    closeBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtnText: {
      fontSize: 18,
      color: c.onSurface,
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: c.primary,
      marginLeft: 8,
      letterSpacing: -0.3,
    },
    headerSpacer: {
      width: 40,
    },
    amountSection: {
      marginBottom: 16,
    },
    amountLabel: {
      fontSize: 10,
      fontWeight: '500',
      color: c.onSurfaceVariant,
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    amount: {
      fontSize: 56,
      fontWeight: '800',
      color: c.onSurface,
      letterSpacing: -2,
    },
    amountCurrency: {
      fontSize: 32,
      color: c.outlineVariant,
      fontWeight: '700',
    },
    amountInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    amountInput: {
      flex: 1,
      fontSize: 56,
      fontWeight: '800',
      color: c.onSurface,
      letterSpacing: -2,
      paddingVertical: 0,
    },
    smsSnippet: {
      fontSize: 13,
      color: c.onSurfaceVariant,
      marginBottom: 24,
      lineHeight: 18,
    },
    pickerSection: {
      backgroundColor: c.surfaceContainerLow,
      borderRadius: 24,
      padding: 20,
      marginBottom: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
    },
    sectionIcon: {
      fontSize: 16,
      color: c.primary,
    },
    sectionLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: c.onSurfaceVariant,
    },
    noteSection: {
      backgroundColor: c.surfaceContainerLow,
      borderRadius: 24,
      padding: 20,
      marginBottom: 24,
    },
    noteInput: {
      backgroundColor: c.surfaceContainerLowest,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 14,
      color: c.onSurface,
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
    saveBtnDisabled: {
      opacity: 0.3,
    },
    saveBtnText: {
      fontSize: 17,
      fontWeight: '700',
      color: c.onPrimary,
      letterSpacing: -0.3,
    },
  });
}
