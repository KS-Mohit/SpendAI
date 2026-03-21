import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Keyboard,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import { useModel } from '../services/ModelService';
import { getAllTransactions, Transaction } from '../services/DatabaseService';
import { buildChatPrompt } from '../services/CategoryService';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
}

interface SalaryInfo {
  amount: number;
  period: 'monthly' | 'yearly';
  currency: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: "Hi! I'm your personal finance assistant — running entirely on your device.\n\nI can analyze your spending, spot patterns, and help you optimize. Try:\n\n• \"How much did I spend on food?\"\n• \"What's my biggest expense category?\"\n• \"How can I cut spending?\"\n• \"Any late-night spending habits?\"\n\nTap the currency button to add your income for deeper insights. Use the mic to speak your questions.",
};

export default function InsightsScreen() {
  const {
    status,
    generate,
    sttReady,
    ttsReady,
    speak,
    stopSpeaking,
    startListening,
    stopListening,
    isListening,
  } = useModel();

  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoRead, setAutoRead] = useState(false);

  // Salary state
  const [salary, setSalary] = useState<SalaryInfo | null>(null);
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryInput, setSalaryInput] = useState('');
  const [salaryPeriod, setSalaryPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [salaryCurrency, setSalaryCurrency] = useState('₹');

  const flatListRef = useRef<FlatList>(null);

  // Load all transactions
  useFocusEffect(
    useCallback(() => {
      async function load() {
        const txs = await getAllTransactions();
        setTransactions(txs);
      }
      load();
    }, [])
  );

  function buildTransactionsJson(): string {
    // Limit to last 20 transactions to keep prompt short for on-device LLM
    const recent = transactions.slice(0, 20);
    return JSON.stringify(
      recent.map((t) => ({
        amount: t.amount,
        category: t.category,
        date: new Date(t.created_at * 1000).toLocaleDateString('en-IN'),
        note: t.note,
      }))
    );
  }

  function scrollToEnd() {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }

  async function handleSend(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;

    Keyboard.dismiss();
    setInput('');

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    scrollToEnd();

    let responseText = '';

    if (status !== 'ready') {
      responseText =
        'AI model is not loaded yet. Please wait for the model to finish loading and try again.';
    } else if (transactions.length === 0) {
      responseText =
        "You don't have any transactions recorded yet. Add some transactions first, then I can help analyze your spending.";
    } else {
      try {
        const prompt = buildChatPrompt(buildTransactionsJson(), text, salary);
        responseText = (await generate(prompt, 300)).trim();
        if (!responseText) {
          responseText = "I couldn't generate a response. Try rephrasing your question.";
        }
      } catch {
        responseText = 'Something went wrong. Please try again.';
      }
    }

    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      text: responseText,
    };
    setMessages((prev) => [...prev, assistantMsg]);
    setLoading(false);
    scrollToEnd();

    // Speak response only if auto-read is enabled
    if (autoRead && ttsReady && responseText) {
      setIsSpeaking(true);
      try {
        await speak(responseText);
      } catch {}
      setIsSpeaking(false);
    }
  }

  // ── Voice input: tap to start recording, tap again to stop + transcribe ──
  async function toggleVoice() {
    if (isListening) {
      // Stop recording → transcribe → show in input → auto-send
      await stopListening();
    } else {
      // Start recording
      await startListening((transcribedText: string) => {
        if (transcribedText) {
          setInput(transcribedText);
        }
      });
    }
  }

  async function toggleSpeaker() {
    if (isSpeaking) {
      await stopSpeaking();
      setIsSpeaking(false);
    }
  }

  function handleSaveSalary() {
    const amount = parseFloat(salaryInput.replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) return;

    setSalary({ amount, period: salaryPeriod, currency: salaryCurrency });
    setShowSalaryModal(false);

    const sysMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'system',
      text: `Income set: ${salaryCurrency}${amount.toLocaleString()} ${salaryPeriod}. I'll factor this into my analysis.`,
    };
    setMessages((prev) => [...prev, sysMsg]);
    scrollToEnd();
  }

  function renderMessage({ item }: { item: ChatMessage }) {
    if (item.role === 'user') {
      return (
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{item.text}</Text>
        </View>
      );
    }
    if (item.role === 'system') {
      return (
        <View style={styles.systemBubble}>
          <Text style={styles.systemText}>{item.text}</Text>
        </View>
      );
    }
    return (
      <View style={styles.aiBubble}>
        <View style={styles.aiAvatar}>
          <Text style={styles.aiAvatarText}>AI</Text>
        </View>
        <View style={styles.aiContent}>
          <Text style={styles.aiText}>{item.text}</Text>
        </View>
      </View>
    );
  }

  const voiceLabel = isListening ? 'Listening...' : sttReady ? 'Tap mic' : '';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Finance AI</Text>
          <Text style={styles.headerSubtitle}>
            {transactions.length} transactions
            {salary
              ? ` · ${salary.currency}${salary.amount.toLocaleString()}/${salary.period === 'monthly' ? 'mo' : 'yr'}`
              : ''}
            {sttReady ? ' · Voice' : ''}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {isSpeaking && (
            <TouchableOpacity style={styles.stopSpeakBtn} onPress={toggleSpeaker}>
              <Text style={styles.stopSpeakText}>■</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.salaryBtn, salary && styles.salaryBtnActive]}
            onPress={() => setShowSalaryModal(true)}
          >
            <Text
              style={[styles.salaryBtnText, salary && styles.salaryBtnTextActive]}
            >
              {salary ? salaryCurrency : '₹'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: false })
        }
      />

      {/* Typing / Listening indicator */}
      {(loading || isListening) && (
        <View style={styles.typingRow}>
          <View style={styles.aiAvatar}>
            <Text style={styles.aiAvatarText}>{isListening ? '●' : 'AI'}</Text>
          </View>
          <View style={[styles.typingDots, isListening && styles.listeningDots]}>
            <ActivityIndicator
              size="small"
              color={isListening ? '#FF3B30' : Colors.textMuted}
            />
            <Text style={[styles.typingText, isListening && styles.listeningText]}>
              {isListening ? 'Listening...' : 'Thinking...'}
            </Text>
          </View>
        </View>
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder={isListening ? 'Recording... tap mic to stop' : 'Ask about your spending...'}
          placeholderTextColor={Colors.textMuted}
          value={input}
          onChangeText={setInput}
          returnKeyType="send"
          onSubmitEditing={() => handleSend()}
          multiline
          maxLength={500}
          editable={!loading && !isListening}
        />

        {/* Auto-read toggle */}
        {ttsReady && (
          <TouchableOpacity
            style={[styles.voiceBtn, autoRead && styles.voiceBtnActive]}
            onPress={() => setAutoRead(!autoRead)}
          >
            <Text style={[styles.voiceBtnIcon, autoRead && styles.voiceBtnIconActive]}>
              {autoRead ? '🔊' : '🔇'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Mic button — tap to record, tap again to stop */}
        <TouchableOpacity
          style={[
            styles.voiceBtn,
            isListening && styles.voiceBtnActive,
            !sttReady && styles.voiceBtnDisabled,
          ]}
          onPress={toggleVoice}
          disabled={loading || !sttReady}
        >
            <Text
              style={[styles.voiceBtnIcon, isListening && styles.voiceBtnIconActive]}
            >
              {isListening ? '■' : '🎙'}
            </Text>
        </TouchableOpacity>

        {/* Send button */}
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => handleSend()}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>

      {/* Salary Modal */}
      <Modal
        visible={showSalaryModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSalaryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Your Income</Text>
            <Text style={styles.modalSubtitle}>
              Optional — helps AI give better spending advice relative to your
              earnings.
            </Text>

            {/* Currency selector */}
            <Text style={styles.modalLabel}>CURRENCY</Text>
            <View style={styles.currencyRow}>
              {['₹', '$', '€', '£'].map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.currencyBtn,
                    salaryCurrency === c && styles.currencyBtnActive,
                  ]}
                  onPress={() => setSalaryCurrency(c)}
                >
                  <Text
                    style={[
                      styles.currencyBtnText,
                      salaryCurrency === c && styles.currencyBtnTextActive,
                    ]}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Amount input */}
            <Text style={styles.modalLabel}>AMOUNT</Text>
            <TextInput
              style={styles.salaryAmountInput}
              placeholder="e.g. 50000"
              placeholderTextColor={Colors.textMuted}
              value={salaryInput}
              onChangeText={setSalaryInput}
              keyboardType="numeric"
              returnKeyType="done"
            />

            {/* Period toggle */}
            <Text style={styles.modalLabel}>PERIOD</Text>
            <View style={styles.periodRow}>
              <TouchableOpacity
                style={[
                  styles.periodBtn,
                  salaryPeriod === 'monthly' && styles.periodBtnActive,
                ]}
                onPress={() => setSalaryPeriod('monthly')}
              >
                <Text
                  style={[
                    styles.periodBtnText,
                    salaryPeriod === 'monthly' && styles.periodBtnTextActive,
                  ]}
                >
                  Monthly
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.periodBtn,
                  salaryPeriod === 'yearly' && styles.periodBtnActive,
                ]}
                onPress={() => setSalaryPeriod('yearly')}
              >
                <Text
                  style={[
                    styles.periodBtnText,
                    salaryPeriod === 'yearly' && styles.periodBtnTextActive,
                  ]}
                >
                  Yearly
                </Text>
              </TouchableOpacity>
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowSalaryModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              {salary && (
                <TouchableOpacity
                  style={styles.modalClearBtn}
                  onPress={() => {
                    setSalary(null);
                    setSalaryInput('');
                    setShowSalaryModal(false);
                    const sysMsg: ChatMessage = {
                      id: Date.now().toString(),
                      role: 'system',
                      text: 'Income info cleared.',
                    };
                    setMessages((prev) => [...prev, sysMsg]);
                  }}
                >
                  <Text style={styles.modalClearText}>Clear</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.modalSaveBtn,
                  !salaryInput.trim() && styles.sendBtnDisabled,
                ]}
                onPress={handleSaveSalary}
                disabled={!salaryInput.trim()}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stopSpeakBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.backgroundMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  stopSpeakText: {
    fontSize: 12,
    color: Colors.textPrimary,
  },
  salaryBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.backgroundMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  salaryBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  salaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  salaryBtnTextActive: {
    color: Colors.background,
  },

  // Chat
  chatContent: {
    padding: 16,
    paddingBottom: 8,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.accent,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
    maxWidth: '80%',
  },
  userText: {
    fontSize: 15,
    color: Colors.background,
    lineHeight: 21,
  },
  aiBubble: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    maxWidth: '90%',
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.backgroundMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  aiAvatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  aiContent: {
    flex: 1,
    backgroundColor: Colors.backgroundMuted,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  aiText: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 21,
  },
  systemBubble: {
    alignSelf: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  systemText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Typing / Listening
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.backgroundMuted,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  listeningDots: {
    backgroundColor: '#FFF0F0',
  },
  typingText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  listeningText: {
    color: '#FF3B30',
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.backgroundMuted,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    fontSize: 15,
    color: Colors.textPrimary,
    maxHeight: 100,
    minHeight: 40,
  },
  voiceBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  voiceBtnActive: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
  },
  voiceBtnDisabled: {
    opacity: 0.35,
  },
  voiceBtnIcon: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  voiceBtnIconActive: {
    color: Colors.background,
    fontSize: 12,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.3,
  },
  sendBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.background,
    marginTop: -1,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 24,
    lineHeight: 18,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },
  currencyRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  currencyBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.backgroundMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  currencyBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  currencyBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  currencyBtnTextActive: {
    color: Colors.background,
  },
  salaryAmountInput: {
    backgroundColor: Colors.backgroundMuted,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 20,
  },
  periodRow: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundMuted,
    borderRadius: 10,
    padding: 3,
    marginBottom: 24,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodBtnActive: {
    backgroundColor: Colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  periodBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  periodBtnTextActive: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modalClearBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.warning,
    alignItems: 'center',
  },
  modalClearText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.warning,
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.background,
  },
});
