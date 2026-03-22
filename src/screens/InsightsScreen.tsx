import React, { useState, useCallback, useRef, useMemo } from 'react';
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
import { useColors } from '../theme/ThemeContext';
import { ColorScheme } from '../theme/colors';
import { useModel } from '../services/ModelService';
import { getTransactionsInRange, Transaction } from '../services/DatabaseService';
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
  text: "Hi! I'm your personal finance assistant \u2014 running entirely on your device.\n\nI can analyze your spending, spot patterns, and help you optimize. Try:\n\n\u2022 \"How much did I spend on food?\"\n\u2022 \"What's my biggest expense category?\"\n\u2022 \"How can I cut spending?\"\n\u2022 \"Any late-night spending habits?\"\n\nTap the income button to add your salary for deeper insights. Use the mic to speak your questions.",
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
  const { colors } = useColors();

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
  const [salaryCurrency, setSalaryCurrency] = useState('\u20b9');

  const flatListRef = useRef<FlatList>(null);
  const styles = useMemo(() => createStyles(colors), [colors]);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        // Only load current month's transactions to keep prompt small for on-device LLM
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const start = Math.floor(startOfMonth.getTime() / 1000);
        const end = Math.floor(now.getTime() / 1000);
        const txs = await getTransactionsInRange(start, end);
        setTransactions(txs);
      }
      load();
    }, [])
  );

  function buildTransactionsJson(): string {
    return JSON.stringify(
      transactions.map((t) => ({
        amount: t.amount,
        category: t.category,
        date: new Date(t.created_at * 1000).toLocaleDateString('en-IN'),
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
        responseText = (await generate(prompt, 150)).trim();
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

    if (autoRead && ttsReady && responseText) {
      setIsSpeaking(true);
      try {
        await speak(responseText);
      } catch {}
      setIsSpeaking(false);
    }
  }

  async function toggleVoice() {
    if (isListening) {
      await stopListening();
    } else {
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
              ? ` \u00b7 ${salary.currency}${salary.amount.toLocaleString()}/${salary.period === 'monthly' ? 'mo' : 'yr'}`
              : ''}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {isSpeaking && (
            <TouchableOpacity style={styles.stopSpeakBtn} onPress={toggleSpeaker}>
              <Text style={styles.stopSpeakText}>{'\u25a0'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.salaryBtn, salary && styles.salaryBtnActive]}
            onPress={() => setShowSalaryModal(true)}
          >
            <Text
              style={[styles.salaryBtnText, salary && styles.salaryBtnTextActive]}
            >
              {salary ? salary.currency : '+'}
            </Text>
            <Text
              style={[styles.salaryBtnLabel, salary && styles.salaryBtnLabelActive]}
            >
              {salary ? 'Income' : 'Income'}
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
            <Text style={styles.aiAvatarText}>{isListening ? '\u25cf' : 'AI'}</Text>
          </View>
          <View style={[styles.typingDots, isListening && styles.listeningDots]}>
            <ActivityIndicator
              size="small"
              color={isListening ? colors.error : colors.primary}
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
          placeholderTextColor={colors.outlineVariant}
          value={input}
          onChangeText={setInput}
          returnKeyType="send"
          onSubmitEditing={() => handleSend()}
          multiline
          maxLength={500}
          editable={!loading && !isListening}
        />

        {ttsReady && (
          <TouchableOpacity
            style={[styles.voiceBtn, autoRead && styles.voiceBtnActive]}
            onPress={() => setAutoRead(!autoRead)}
          >
            <Text style={[styles.voiceBtnIcon, autoRead && styles.voiceBtnIconActive]}>
              {autoRead ? '\ud83d\udd0a' : '\ud83d\udd07'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.voiceBtn,
            isListening && styles.voiceBtnListening,
            !sttReady && styles.voiceBtnDisabled,
          ]}
          onPress={toggleVoice}
          disabled={loading || !sttReady}
        >
            <Text
              style={[styles.voiceBtnIcon, isListening && styles.voiceBtnIconActive]}
            >
              {isListening ? '\u25a0' : '\ud83c\udf99'}
            </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => handleSend()}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendBtnText}>{'\u2191'}</Text>
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
              Optional \u2014 helps AI give better spending advice relative to your
              earnings.
            </Text>

            <Text style={styles.modalLabel}>CURRENCY</Text>
            <View style={styles.currencyRow}>
              {['\u20b9', '$', '\u20ac', '\u00a3'].map((cur) => (
                <TouchableOpacity
                  key={cur}
                  style={[
                    styles.currencyBtn,
                    salaryCurrency === cur && styles.currencyBtnActive,
                  ]}
                  onPress={() => setSalaryCurrency(cur)}
                >
                  <Text
                    style={[
                      styles.currencyBtnText,
                      salaryCurrency === cur && styles.currencyBtnTextActive,
                    ]}
                  >
                    {cur}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>AMOUNT</Text>
            <TextInput
              style={styles.salaryAmountInput}
              placeholder="e.g. 50000"
              placeholderTextColor={colors.outlineVariant}
              value={salaryInput}
              onChangeText={setSalaryInput}
              keyboardType="numeric"
              returnKeyType="done"
            />

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

function createStyles(c: ColorScheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.surfaceContainerHigh,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: c.primary,
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontSize: 12,
      color: c.onSurfaceVariant,
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
      backgroundColor: c.surfaceContainerLow,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stopSpeakText: {
      fontSize: 12,
      color: c.onSurface,
    },
    salaryBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: c.surfaceContainerLow,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    salaryBtnActive: {
      backgroundColor: c.primary,
    },
    salaryBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: c.onSurface,
    },
    salaryBtnTextActive: {
      color: c.onPrimary,
    },
    salaryBtnLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: c.onSurfaceVariant,
    },
    salaryBtnLabelActive: {
      color: c.onPrimary,
    },

    // Chat
    chatContent: {
      padding: 16,
      paddingBottom: 8,
    },
    userBubble: {
      alignSelf: 'flex-end',
      backgroundColor: c.primary,
      borderRadius: 20,
      borderBottomRightRadius: 4,
      paddingHorizontal: 16,
      paddingVertical: 10,
      marginBottom: 12,
      maxWidth: '80%',
    },
    userText: {
      fontSize: 15,
      color: c.onPrimary,
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
      backgroundColor: c.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
      marginTop: 2,
    },
    aiAvatarText: {
      fontSize: 10,
      fontWeight: '700',
      color: c.onPrimaryContainer,
    },
    aiContent: {
      flex: 1,
      backgroundColor: c.surfaceContainerLow,
      borderRadius: 20,
      borderBottomLeftRadius: 4,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    aiText: {
      fontSize: 15,
      color: c.onSurface,
      lineHeight: 21,
    },
    systemBubble: {
      alignSelf: 'center',
      backgroundColor: c.primaryContainer,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginBottom: 12,
    },
    systemText: {
      fontSize: 12,
      color: c.onPrimaryContainer,
      textAlign: 'center',
      fontWeight: '500',
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
      backgroundColor: c.surfaceContainerLow,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    listeningDots: {
      backgroundColor: c.errorContainer,
    },
    typingText: {
      fontSize: 13,
      color: c.onSurfaceVariant,
    },
    listeningText: {
      color: c.error,
    },

    // Input bar
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 12,
      paddingVertical: 10,
      paddingBottom: Platform.OS === 'ios' ? 28 : 14,
      borderTopWidth: 1,
      borderTopColor: c.surfaceContainerHigh,
      backgroundColor: c.background,
      gap: 8,
    },
    textInput: {
      flex: 1,
      backgroundColor: c.surfaceContainerLow,
      borderRadius: 24,
      paddingHorizontal: 16,
      paddingVertical: 10,
      paddingTop: 10,
      fontSize: 15,
      color: c.onSurface,
      maxHeight: 100,
      minHeight: 40,
    },
    voiceBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.surfaceContainerLow,
      alignItems: 'center',
      justifyContent: 'center',
    },
    voiceBtnActive: {
      backgroundColor: c.primaryContainer,
    },
    voiceBtnListening: {
      backgroundColor: c.error,
    },
    voiceBtnDisabled: {
      opacity: 0.35,
    },
    voiceBtnIcon: {
      fontSize: 16,
      color: c.onSurfaceVariant,
    },
    voiceBtnIconActive: {
      color: c.onPrimary,
      fontSize: 12,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: {
      opacity: 0.3,
    },
    sendBtnText: {
      fontSize: 18,
      fontWeight: '700',
      color: c.onPrimary,
      marginTop: -1,
    },

    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: c.background,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      padding: 24,
      paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: c.primary,
      marginBottom: 4,
    },
    modalSubtitle: {
      fontSize: 13,
      color: c.onSurfaceVariant,
      marginBottom: 24,
      lineHeight: 18,
    },
    modalLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.5,
      color: c.onSurfaceVariant,
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
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: c.surfaceContainerLow,
      alignItems: 'center',
      justifyContent: 'center',
    },
    currencyBtnActive: {
      backgroundColor: c.primary,
    },
    currencyBtnText: {
      fontSize: 18,
      fontWeight: '600',
      color: c.onSurface,
    },
    currencyBtnTextActive: {
      color: c.onPrimary,
    },
    salaryAmountInput: {
      backgroundColor: c.surfaceContainerLow,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 20,
      fontWeight: '600',
      color: c.onSurface,
      marginBottom: 20,
    },
    periodRow: {
      flexDirection: 'row',
      backgroundColor: c.surfaceContainerLow,
      borderRadius: 24,
      padding: 4,
      marginBottom: 24,
    },
    periodBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 20,
    },
    periodBtnActive: {
      backgroundColor: c.primary,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 2,
    },
    periodBtnText: {
      fontSize: 14,
      fontWeight: '500',
      color: c.onSurfaceVariant,
    },
    periodBtnTextActive: {
      color: c.onPrimary,
      fontWeight: '600',
    },
    modalActions: {
      flexDirection: 'row',
      gap: 10,
    },
    modalCancelBtn: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 24,
      backgroundColor: c.surfaceContainerLow,
      alignItems: 'center',
    },
    modalCancelText: {
      fontSize: 15,
      fontWeight: '600',
      color: c.onSurfaceVariant,
    },
    modalClearBtn: {
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 24,
      backgroundColor: c.errorContainer,
      alignItems: 'center',
    },
    modalClearText: {
      fontSize: 15,
      fontWeight: '600',
      color: c.onErrorContainer,
    },
    modalSaveBtn: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 24,
      backgroundColor: c.primary,
      alignItems: 'center',
    },
    modalSaveText: {
      fontSize: 15,
      fontWeight: '600',
      color: c.onPrimary,
    },
  });
}
