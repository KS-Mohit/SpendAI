import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useColors } from '../theme/ThemeContext';
import { ColorScheme } from '../theme/colors';
import { useModel } from '../services/ModelService';
import { getTransactionsInRange, Transaction } from '../services/DatabaseService';
import { buildChatPrompt, tryDirectAnswer } from '../services/CategoryService';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
  text: "Hi! I'm your personal finance assistant \u2014 running entirely on your device.\n\nI can analyze your spending, spot patterns, and help you optimize. Try:\n\n\u2022 \"How much did I spend on food?\"\n\u2022 \"What's my biggest expense category?\"\n\u2022 \"How can I cut spending?\"\n\u2022 \"Any late-night spending habits?\"\n\nTap the income button to add your salary for deeper insights.",
};

// Audio visualizer bar count
const BAR_COUNT = 24;

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

  // Salary state
  const [salary, setSalary] = useState<SalaryInfo | null>(null);
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryInput, setSalaryInput] = useState('');
  const [salaryPeriod, setSalaryPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [salaryCurrency, setSalaryCurrency] = useState('\u20b9');

  // Voice mode state
  const [showVoiceMode, setShowVoiceMode] = useState(false);
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');

  // Visualizer animation
  const barAnims = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.15))
  ).current;
  const animLoopRef = useRef<number | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const styles = useMemo(() => createStyles(colors), [colors]);

  useFocusEffect(
    useCallback(() => {
      async function load() {
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

  // ── Visualizer animation ──
  function startVisualizerAnim(intensity: 'low' | 'high') {
    stopVisualizerAnim();
    const animate = () => {
      const animations = barAnims.map((anim) => {
        const maxHeight = intensity === 'high' ? 0.5 + Math.random() * 0.5 : 0.1 + Math.random() * 0.35;
        return Animated.timing(anim, {
          toValue: maxHeight,
          duration: 80 + Math.random() * 120,
          useNativeDriver: false,
        });
      });
      Animated.parallel(animations).start(() => {
        animLoopRef.current = requestAnimationFrame(animate);
      });
    };
    animate();
  }

  function stopVisualizerAnim() {
    if (animLoopRef.current) {
      cancelAnimationFrame(animLoopRef.current);
      animLoopRef.current = null;
    }
    barAnims.forEach((anim) => {
      Animated.timing(anim, {
        toValue: 0.15,
        duration: 300,
        useNativeDriver: false,
      }).start();
    });
  }

  useEffect(() => {
    if (voiceState === 'listening') {
      startVisualizerAnim('high');
    } else if (voiceState === 'speaking') {
      startVisualizerAnim('low');
    } else {
      stopVisualizerAnim();
    }
    return () => stopVisualizerAnim();
  }, [voiceState]);

  // ── Text chat send ──
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

    const responseText = await getAIResponse(text);

    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      text: responseText,
    };
    setMessages((prev) => [...prev, assistantMsg]);
    setLoading(false);
    scrollToEnd();
  }

  // ── Shared AI response logic ──
  async function getAIResponse(text: string): Promise<string> {
    console.log('[AI] getAIResponse called with:', JSON.stringify(text));
    console.log('[AI] transactions count:', transactions.length);

    if (transactions.length === 0) {
      console.log('[AI] No transactions, returning early');
      return "You don't have any transactions recorded yet. Add some transactions first, then I can help analyze your spending.";
    }

    const txJson = buildTransactionsJson();
    console.log('[AI] txJson length:', txJson.length);

    // Tier 1: Pre-computed data answers (instant + accurate)
    const directAnswer = tryDirectAnswer(txJson, text, salary);
    console.log('[AI] Tier 1 directAnswer:', directAnswer ? 'MATCHED' : 'null');
    if (directAnswer) {
      console.log('[AI] Tier 1 response:', directAnswer.substring(0, 100));
      await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1500));
      return directAnswer;
    }

    // Tier 2: RAG + LLM for advice/complex questions
    console.log('[AI] Tier 2: falling through to RAG + LLM');
    console.log('[AI] Model status:', status);
    if (status !== 'ready') {
      return 'AI model is not loaded yet. Please wait for the model to finish loading and try again.';
    }
    try {
      const prompt = buildChatPrompt(txJson, text, salary);
      console.log('[AI] Prompt length:', prompt.length);
      console.log('[AI] Prompt:', prompt.substring(0, 300));
      const result = (await generate(prompt, 150)).trim();
      console.log('[AI] LLM raw result:', JSON.stringify(result));
      return result || "I couldn't generate a response. Try rephrasing your question.";
    } catch (e: any) {
      console.error('[AI] LLM error:', e?.message || e);
      return 'Something went wrong. Please try again.';
    }
  }

  // ── Voice mode ──
  const voiceActiveRef = useRef(false);
  const [voiceInput, setVoiceInput] = useState('');
  const [voiceMessages, setVoiceMessages] = useState<ChatMessage[]>([]);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const voiceFlatListRef = useRef<FlatList>(null);

  function scrollVoiceToEnd() {
    setTimeout(() => voiceFlatListRef.current?.scrollToEnd({ animated: true }), 100);
  }

  function beginListening() {
    setVoiceState('listening');
    console.log('[VOICE] Starting listening...');
    startListening((transcription: string) => {
      console.log('[VOICE] Transcription:', JSON.stringify(transcription));
      setVoiceState('idle');
      if (transcription) {
        setVoiceInput(transcription);
      }
    });
  }

  async function handleVoiceSend() {
    const text = voiceInput.trim();
    if (!text || voiceLoading) return;

    // Show user message
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text };
    setVoiceMessages((prev) => [...prev, userMsg]);
    setMessages((prev) => [...prev, userMsg]);
    setVoiceInput('');
    setVoiceLoading(true);
    scrollVoiceToEnd();

    // Get response using tier1/tier2
    const answer = await getAIResponse(text);

    const assistantMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', text: answer };
    setVoiceMessages((prev) => [...prev, assistantMsg]);
    setMessages((prev) => [...prev, assistantMsg]);
    setVoiceLoading(false);
    scrollVoiceToEnd();

    // Speak the answer
    setVoiceState('speaking');
    try {
      await speak(answer);
    } catch (e: any) {
      console.warn('[VOICE] TTS error:', e?.message || e);
    }
    setVoiceState('idle');
  }

  function openVoiceMode() {
    setShowVoiceMode(true);
    setVoiceState('idle');
    setVoiceInput('');
    setVoiceMessages([]);
    voiceActiveRef.current = true;
  }

  function closeVoiceMode() {
    setShowVoiceMode(false);
    voiceActiveRef.current = false;
    setVoiceState('idle');
    setVoiceLoading(false);
    stopListening();
  }

  function handleVoiceTap() {
    console.log('[VOICE] Tap, state:', voiceState);
    if (voiceState === 'listening') {
      // Stop recording → transcribes → shows in input for review
      setVoiceState('thinking');
      stopListening();
    } else if (voiceState === 'idle') {
      beginListening();
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

  const voiceStateLabel =
    voiceState === 'listening' ? 'Listening — tap to stop' :
    voiceState === 'thinking' ? 'Transcribing...' :
    voiceState === 'speaking' ? 'Speaking...' :
    'Tap mic to start';

  const voiceStateColor =
    voiceState === 'listening' ? colors.error :
    voiceState === 'speaking' ? colors.primary :
    colors.onSurfaceVariant;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
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
          <TouchableOpacity
            style={[styles.headerBtn, (!sttReady || !ttsReady) && styles.headerBtnDisabled]}
            onPress={openVoiceMode}
            disabled={!sttReady || !ttsReady}
          >
            <MaterialCommunityIcons name="microphone" size={16} color={colors.onSurfaceVariant} />
            <Text style={styles.headerBtnLabel}>Voice</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerBtn, salary && styles.headerBtnActive]}
            onPress={() => setShowSalaryModal(true)}
          >
            <Text style={[styles.headerBtnText, salary && styles.headerBtnTextActive]}>
              {salary ? salary.currency : '+'}
            </Text>
            <Text style={[styles.headerBtnLabel, salary && styles.headerBtnLabelActive]}>
              Income
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

      {/* Typing indicator */}
      {loading && (
        <View style={styles.typingRow}>
          <View style={styles.aiAvatar}>
            <Text style={styles.aiAvatarText}>AI</Text>
          </View>
          <View style={styles.typingDots}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.typingText}>Thinking...</Text>
          </View>
        </View>
      )}

      {/* Input bar — text only */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask about your spending..."
          placeholderTextColor={colors.outlineVariant}
          value={input}
          onChangeText={setInput}
          returnKeyType="send"
          onSubmitEditing={() => handleSend()}
          multiline
          maxLength={500}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => handleSend()}
          disabled={!input.trim() || loading}
        >
          <MaterialCommunityIcons name="arrow-up" size={20} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── Voice Mode Modal ── */}
      <Modal
        visible={showVoiceMode}
        animationType="slide"
        onRequestClose={closeVoiceMode}
      >
        <SafeAreaView style={[styles.voiceContainer, { backgroundColor: colors.background }]} edges={['top']}>
          {/* Voice header */}
          <View style={styles.voiceHeader}>
            <TouchableOpacity onPress={closeVoiceMode} style={styles.voiceCloseBtn}>
              <MaterialCommunityIcons name="chevron-down" size={28} color={colors.onSurface} />
            </TouchableOpacity>
            <Text style={styles.voiceTitle}>Voice Mode</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Visualizer */}
          <View style={styles.visualizerSection}>
            <Text style={[styles.voiceStateLabel, { color: voiceStateColor }]}>
              {voiceStateLabel}
            </Text>
            <View style={styles.visualizerContainer}>
              {barAnims.map((anim, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.visualizerBar,
                    {
                      backgroundColor: voiceState === 'listening' ? colors.error :
                        voiceState === 'speaking' ? colors.primary : colors.outlineVariant,
                      height: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [4, 60],
                      }),
                    },
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Conversation */}
          <View style={styles.voiceTranscriptSection}>
            {voiceMessages.length === 0 && voiceState !== 'thinking' ? (
              <View style={styles.voiceEmptyState}>
                <MaterialCommunityIcons name="microphone-outline" size={32} color={colors.outlineVariant} />
                <Text style={styles.voiceEmptyText}>
                  {voiceState === 'listening'
                    ? 'Speak your question, then tap stop'
                    : 'Tap mic and ask a question about your spending'}
                </Text>
              </View>
            ) : (
              <FlatList
                ref={voiceFlatListRef}
                data={voiceMessages}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  if (item.role === 'user') {
                    return (
                      <View style={styles.userBubble}>
                        <Text style={styles.userText}>{item.text}</Text>
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
                }}
                contentContainerStyle={styles.chatContent}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => voiceFlatListRef.current?.scrollToEnd({ animated: true })}
              />
            )}
            {voiceState === 'thinking' && (
              <View style={styles.voiceThinkingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.voiceThinkingText}>Transcribing...</Text>
              </View>
            )}
            {voiceLoading && (
              <View style={styles.voiceThinkingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.voiceThinkingText}>Thinking...</Text>
              </View>
            )}
          </View>

          {/* Voice input bar */}
          <View style={[styles.inputBar, { borderTopColor: colors.outlineVariant }]}>
            <TouchableOpacity
              style={[styles.voiceMicSmall, voiceState === 'listening' && { backgroundColor: colors.error }]}
              onPress={handleVoiceTap}
              disabled={voiceState === 'thinking'}
            >
              <MaterialCommunityIcons
                name={voiceState === 'listening' ? 'stop' : 'microphone'}
                size={20}
                color={colors.onPrimary}
              />
            </TouchableOpacity>
            <TextInput
              style={styles.textInput}
              value={voiceInput}
              onChangeText={setVoiceInput}
              placeholder="Edit or type your question..."
              placeholderTextColor={colors.onSurfaceVariant}
              editable={voiceState !== 'listening' && voiceState !== 'thinking'}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!voiceInput.trim() || voiceLoading) && { opacity: 0.4 }]}
              onPress={handleVoiceSend}
              disabled={!voiceInput.trim() || voiceLoading}
            >
              <MaterialCommunityIcons name="send" size={20} color={colors.onPrimary} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ── Salary Modal ── */}
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
    </SafeAreaView>
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
    headerBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: c.surfaceContainerLow,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    headerBtnActive: {
      backgroundColor: c.primary,
    },
    headerBtnDisabled: {
      opacity: 0.35,
    },
    headerBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: c.onSurface,
    },
    headerBtnTextActive: {
      color: c.onPrimary,
    },
    headerBtnLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: c.onSurfaceVariant,
    },
    headerBtnLabelActive: {
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

    // Typing
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
    typingText: {
      fontSize: 13,
      color: c.onSurfaceVariant,
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

    // ── Voice Mode ──
    voiceContainer: {
      flex: 1,
    },
    voiceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      paddingTop: Platform.OS === 'ios' ? 56 : 12,
      borderBottomWidth: 1,
      borderBottomColor: c.surfaceContainerHigh,
    },
    voiceCloseBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    voiceTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: c.onSurface,
    },

    visualizerSection: {
      alignItems: 'center',
      paddingVertical: 32,
      gap: 24,
    },
    voiceStateLabel: {
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    visualizerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 64,
      gap: 3,
      paddingHorizontal: 32,
    },
    visualizerBar: {
      width: 3,
      borderRadius: 2,
    },
    voiceMicBtn: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    voiceMicSmall: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Voice transcript
    voiceTranscriptSection: {
      flex: 1,
      borderTopWidth: 1,
      borderTopColor: c.surfaceContainerHigh,
    },
    voiceTranscriptTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: c.onSurfaceVariant,
      paddingHorizontal: 20,
      paddingVertical: 12,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    voiceTranscriptList: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    voiceMsgRow: {
      marginBottom: 16,
    },
    voiceMsgRowUser: {},
    voiceMsgLabel: {
      fontSize: 11,
      fontWeight: '700',
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    voiceMsgText: {
      fontSize: 15,
      color: c.onSurfaceVariant,
      lineHeight: 22,
    },
    voiceEmptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingBottom: 40,
    },
    voiceEmptyText: {
      fontSize: 14,
      color: c.outlineVariant,
      textAlign: 'center',
    },
    voiceThinkingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    voiceThinkingText: {
      fontSize: 13,
      color: c.onSurfaceVariant,
    },

    // Salary Modal
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
