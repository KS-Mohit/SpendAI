import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../theme/colors';
import CategoryPicker from '../components/CategoryPicker';
import {
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  Transaction,
} from '../services/DatabaseService';
import { getCategoryByKey } from '../constants/categories';
import { RootStackParamList } from '../types';

type ScreenRouteProp = RouteProp<RootStackParamList, 'TransactionDetail'>;
type ScreenNavProp = NativeStackNavigationProp<RootStackParamList, 'TransactionDetail'>;

export default function TransactionDetailScreen() {
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<ScreenNavProp>();
  const { id } = route.params;

  const [tx, setTx] = useState<Transaction | null>(null);
  const [editing, setEditing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const t = await getTransactionById(id);
      if (t) {
        setTx(t);
        setSelectedCategory(t.category);
        setNote(t.note ?? '');
      }
    }
    load();
  }, [id]);

  async function handleSave() {
    if (!selectedCategory || !tx) return;
    setSaving(true);
    await updateTransaction(tx.id, {
      category: selectedCategory,
      note: note.trim() || undefined,
    });
    setSaving(false);
    setEditing(false);
    // Reload
    const updated = await getTransactionById(id);
    if (updated) setTx(updated);
  }

  function handleDelete() {
    Alert.alert('Delete Transaction', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTransaction(id);
          navigation.goBack();
        },
      },
    ]);
  }

  if (!tx) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.textMuted} />
      </View>
    );
  }

  const cat = getCategoryByKey(tx.category);
  const date = new Date(tx.created_at * 1000);
  const dateStr = date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.amount}>₹{tx.amount.toLocaleString('en-IN')}</Text>
      <Text style={styles.dateTime}>
        {dateStr} at {timeStr}
      </Text>

      {!editing ? (
        <>
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Category</Text>
              <Text style={styles.detailValue}>
                {cat?.icon} {cat?.label ?? tx.category}
              </Text>
            </View>

            {tx.ai_suggestion && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>AI Suggested</Text>
                <Text style={styles.detailValue}>
                  {tx.ai_suggestion} ({tx.confidence}%)
                  {tx.user_overrode === 1 ? ' — overridden' : ''}
                </Text>
              </View>
            )}

            {tx.note && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Note</Text>
                <Text style={styles.detailValue}>{tx.note}</Text>
              </View>
            )}

            {tx.raw_sms && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>SMS</Text>
                <Text style={[styles.detailValue, styles.sms]}>
                  {tx.raw_sms}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => setEditing(true)}
            >
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={handleDelete}
            >
              <Text style={styles.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <View style={styles.pickerSection}>
            <Text style={styles.sectionLabel}>CATEGORY</Text>
            <CategoryPicker
              selected={selectedCategory}
              suggestion={tx.ai_suggestion}
              confidence={tx.confidence}
              onSelect={setSelectedCategory}
            />
          </View>

          <TextInput
            style={styles.noteInput}
            placeholder="add a note..."
            placeholderTextColor={Colors.textMuted}
            value={note}
            onChangeText={setNote}
            returnKeyType="done"
          />

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => {
                setEditing(false);
                setSelectedCategory(tx.category);
                setNote(tx.note ?? '');
              }}
            >
              <Text style={styles.editBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={Colors.background} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  amount: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  dateTime: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 28,
  },
  detailCard: {
    backgroundColor: Colors.backgroundMuted,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  sms: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  editBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  editBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  deleteBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.warning,
    alignItems: 'center',
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.warning,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.background,
  },
  pickerSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 1,
    color: Colors.textMuted,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  noteInput: {
    backgroundColor: Colors.backgroundMuted,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
});
