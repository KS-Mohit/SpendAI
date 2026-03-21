import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../theme/colors';
import CategoryPicker from '../components/CategoryPicker';
import { useModel } from '../services/ModelService';
import { suggestCategory, CategorySuggestion } from '../services/CategoryService';
import { insertTransaction } from '../services/DatabaseService';
import { RootStackParamList } from '../types';

type ScreenRouteProp = RouteProp<RootStackParamList, 'ConfirmTransaction'>;
type ScreenNavProp = NativeStackNavigationProp<RootStackParamList, 'ConfirmTransaction'>;

export default function ConfirmTransactionScreen() {
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<ScreenNavProp>();
  const { amount, rawSms } = route.params;
  const { status, generate } = useModel();

  const [selected, setSelected] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<CategorySuggestion>({
    category: null,
    confidence: null,
  });
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchSuggestion() {
      if (status !== 'ready') {
        setLoading(false);
        return;
      }
      try {
        const result = await suggestCategory(rawSms, generate);
        if (cancelled) return;
        setSuggestion(result);
        // Pre-select if high confidence
        if (result.category && result.confidence && result.confidence > 70) {
          setSelected(result.category);
        }
      } catch {
        // silently fail — user picks manually
      }
      setLoading(false);
    }

    fetchSuggestion();
    return () => {
      cancelled = true;
    };
  }, [status, generate, rawSms]);

  async function handleSave() {
    if (!selected) return;
    setSaving(true);

    const userOverrode =
      suggestion.category !== null && selected !== suggestion.category ? 1 : 0;

    await insertTransaction({
      amount,
      category: selected,
      ai_suggestion: suggestion.category,
      confidence: suggestion.confidence,
      user_overrode: userOverrode,
      note: note.trim() || null,
      raw_sms: rawSms,
    });

    navigation.navigate('Dashboard');
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.amount}>₹{amount.toLocaleString('en-IN')}</Text>
      <Text style={styles.smsSnippet} numberOfLines={3}>
        {rawSms}
      </Text>

      {loading ? (
        <View style={styles.aiLoading}>
          <ActivityIndicator size="small" color={Colors.textMuted} />
          <Text style={styles.aiLoadingText}>AI analyzing...</Text>
        </View>
      ) : suggestion.category && suggestion.confidence ? (
        <View style={styles.suggestionBar}>
          <Text style={styles.suggestionText}>
            {suggestion.category.charAt(0).toUpperCase() +
              suggestion.category.slice(1)}
          </Text>
          <View style={styles.confidenceTrack}>
            <View
              style={[
                styles.confidenceFill,
                { width: `${suggestion.confidence}%` },
              ]}
            />
          </View>
          <Text style={styles.confidenceText}>{suggestion.confidence}%</Text>
        </View>
      ) : status !== 'ready' ? (
        <View style={styles.aiLoading}>
          <Text style={styles.aiLoadingText}>AI loading...</Text>
        </View>
      ) : null}

      <View style={styles.pickerSection}>
        <Text style={styles.sectionLabel}>SELECT CATEGORY</Text>
        <CategoryPicker
          selected={selected}
          suggestion={suggestion.category}
          confidence={suggestion.confidence}
          onSelect={setSelected}
        />
      </View>

      <View style={styles.noteSection}>
        <TextInput
          style={styles.noteInput}
          placeholder="add a note... (e.g. milk from corner shop)"
          placeholderTextColor={Colors.textMuted}
          value={note}
          onChangeText={setNote}
          returnKeyType="done"
        />
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, !selected && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={!selected || saving}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator color={Colors.background} />
        ) : (
          <Text style={styles.saveBtnText}>Save</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 24,
    paddingTop: 32,
  },
  amount: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  smsSnippet: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 18,
  },
  aiLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 8,
  },
  aiLoadingText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  suggestionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundMuted,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
    gap: 10,
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  confidenceTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },
  confidenceText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  pickerSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 1,
    color: Colors.textMuted,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  noteSection: {
    marginBottom: 32,
  },
  noteInput: {
    backgroundColor: Colors.backgroundMuted,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.3,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.background,
  },
});
