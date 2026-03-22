import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColors } from '../theme/ThemeContext';
import { ColorScheme } from '../theme/colors';
import { fireTestSMS } from '../services/SMSService';
import { useModel } from '../services/ModelService';
import { RootStackParamList } from '../types';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Dev'>;

const TEMPLATES = [
  {
    label: 'Swiggy Order',
    sms: 'Your a/c XX1234 debited Rs.245 for Swiggy order #ABC123',
  },
  {
    label: 'Uber Trip',
    sms: 'Uber trip completed. Rs.180 charged to your card XX5678',
  },
  {
    label: 'UPI Payment',
    sms: 'You have done a UPI txn of Rs.500 to 9876543210@paytm',
  },
  {
    label: 'Electricity Bill',
    sms: 'Rs.1200 debited from a/c XX1234 towards Electricity Bill',
  },
];

export default function DevScreen() {
  const navigation = useNavigation<NavProp>();
  const { status, downloadProgress, error } = useModel();
  const { colors, isDark, mode, toggle, setMode } = useColors();
  const [customSms, setCustomSms] = useState('');

  const styles = useMemo(() => createStyles(colors), [colors]);

  function handleFire(smsText: string) {
    if (!smsText.trim()) return;
    fireTestSMS(smsText);
    Alert.alert('SMS Fired', 'Test SMS sent through the pipeline.');
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>Dev Tools</Text>

      {/* Theme Toggle */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>APPEARANCE</Text>
        <View style={styles.themeRow}>
          {(['system', 'light', 'dark'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.themeBtn, mode === m && styles.themeBtnActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.themeBtnText, mode === m && styles.themeBtnTextActive]}>
                {m === 'system' ? 'Auto' : m === 'light' ? 'Light' : 'Dark'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Model Status */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>MODEL STATUS</Text>
        <Text style={styles.statusText}>
          {status === 'ready'
            ? 'Model loaded and ready'
            : status === 'downloading'
            ? `Downloading... ${Math.round(downloadProgress * 100)}%`
            : status === 'loading'
            ? 'Loading model...'
            : status === 'initializing'
            ? 'Initializing SDK...'
            : status === 'error'
            ? `Error: ${error}`
            : 'Not initialized'}
        </Text>
        {status === 'downloading' && (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${downloadProgress * 100}%` },
              ]}
            />
          </View>
        )}
      </View>

      {/* SMS Templates */}
      <Text style={styles.sectionTitle}>TEST SMS TEMPLATES</Text>
      {TEMPLATES.map((t, i) => (
        <View key={i} style={styles.templateCard}>
          <Text style={styles.templateLabel}>{t.label}</Text>
          <Text style={styles.templateSms} numberOfLines={2}>
            {t.sms}
          </Text>
          <TouchableOpacity
            style={styles.fireBtn}
            onPress={() => handleFire(t.sms)}
            activeOpacity={0.7}
          >
            <Text style={styles.fireBtnText}>Fire SMS</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Custom SMS */}
      <Text style={styles.sectionTitle}>CUSTOM SMS</Text>
      <TextInput
        style={styles.customInput}
        placeholder="Enter custom SMS text..."
        placeholderTextColor={colors.outlineVariant}
        value={customSms}
        onChangeText={setCustomSms}
        multiline
        numberOfLines={3}
      />
      <TouchableOpacity
        style={[styles.fireBtn, styles.fireBtnFull]}
        onPress={() => handleFire(customSms)}
        activeOpacity={0.7}
      >
        <Text style={styles.fireBtnText}>Fire Custom SMS</Text>
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
      marginBottom: 24,
      letterSpacing: -0.5,
    },
    card: {
      backgroundColor: c.surfaceContainerLow,
      borderRadius: 24,
      padding: 20,
      marginBottom: 24,
    },
    cardLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.5,
      color: c.onSurfaceVariant,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    statusText: {
      fontSize: 15,
      fontWeight: '600',
      color: c.onSurface,
    },
    progressTrack: {
      height: 6,
      backgroundColor: c.surfaceContainerHighest,
      borderRadius: 3,
      marginTop: 12,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: c.primary,
      borderRadius: 3,
    },
    themeRow: {
      flexDirection: 'row',
      backgroundColor: c.surfaceContainer,
      borderRadius: 20,
      padding: 4,
    },
    themeBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 16,
    },
    themeBtnActive: {
      backgroundColor: c.primary,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 2,
    },
    themeBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: c.onSurfaceVariant,
    },
    themeBtnTextActive: {
      color: c.onPrimary,
      fontWeight: '700',
    },
    sectionTitle: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.5,
      color: c.onSurfaceVariant,
      textTransform: 'uppercase',
      marginBottom: 12,
    },
    templateCard: {
      backgroundColor: c.surfaceContainerLow,
      borderRadius: 20,
      padding: 16,
      marginBottom: 12,
    },
    templateLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: c.onSurface,
      marginBottom: 4,
    },
    templateSms: {
      fontSize: 13,
      color: c.onSurfaceVariant,
      lineHeight: 18,
      marginBottom: 12,
    },
    fireBtn: {
      backgroundColor: c.primary,
      borderRadius: 20,
      paddingVertical: 12,
      paddingHorizontal: 20,
      alignSelf: 'flex-start',
      alignItems: 'center',
    },
    fireBtnFull: {
      alignSelf: 'stretch',
      marginTop: 12,
    },
    fireBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: c.onPrimary,
    },
    customInput: {
      backgroundColor: c.surfaceContainerLow,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 14,
      color: c.onSurface,
      minHeight: 80,
      textAlignVertical: 'top',
    },
  });
}
