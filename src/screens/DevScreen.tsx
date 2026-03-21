import React, { useState } from 'react';
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
import { Colors } from '../theme/colors';
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
  const [customSms, setCustomSms] = useState('');

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
        placeholderTextColor={Colors.textMuted}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 24,
    paddingBottom: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 24,
  },
  card: {
    backgroundColor: Colors.backgroundMuted,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 1,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 1,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  templateCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
  },
  templateLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  templateSms: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  fireBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
    alignItems: 'center',
  },
  fireBtnFull: {
    alignSelf: 'stretch',
    marginTop: 8,
  },
  fireBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.background,
  },
  customInput: {
    backgroundColor: Colors.backgroundMuted,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: Colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
