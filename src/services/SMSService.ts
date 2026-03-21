import * as Notifications from 'expo-notifications';
import { parseSMS, ParsedTransaction } from './SMSParser';

// Backward-compatible: still has { amount, rawText } (from ParsedTransaction)
// plus all new fields. Nothing that imports ParsedSMS needs to change.
export interface ParsedSMS extends ParsedTransaction {}

type SMSCallback = (parsed: ParsedSMS) => void;

let listener: any = null;
let callbacks: SMSCallback[] = [];

export function onSMSReceived(callback: SMSCallback): () => void {
  callbacks.push(callback);

  // Start native listener if first subscriber
  if (!listener) {
    try {
      // react-native-sms-listener — only works on real Android device
      const SmsListener = require('react-native-sms-listener').default;
      listener = SmsListener.addListener((message: { body: string }) => {
        const parsed = parseSMS(message.body);
        if (parsed !== null) {
          callbacks.forEach((cb) => cb(parsed));
        }
      });
    } catch (e) {
      console.warn('SMS listener not available (emulator?) — use DevScreen to test');
    }
  }

  // Return unsubscribe
  return () => {
    callbacks = callbacks.filter((cb) => cb !== callback);
    if (callbacks.length === 0 && listener) {
      listener.remove();
      listener = null;
    }
  };
}

/**
 * Simulate an SMS being received — used by DevScreen.
 * Bypasses the native SMS listener, same pipeline runs.
 */
export function fireTestSMS(rawText: string): void {
  const parsed = parseSMS(rawText);
  if (parsed !== null) {
    callbacks.forEach((cb) => cb(parsed));
  }
}

/**
 * Send a local notification for a detected transaction.
 */
export async function sendTransactionNotification(amount: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Transaction Detected',
      body: `₹${amount.toLocaleString('en-IN')} detected — tap to categorize`,
      data: { amount },
    },
    trigger: null, // immediate
  });
}