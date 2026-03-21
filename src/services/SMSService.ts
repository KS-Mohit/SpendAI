import * as Notifications from 'expo-notifications';

export interface ParsedSMS {
  amount: number;
  rawText: string;
}

// Matches Rs., Rs, INR, ₹ followed by optional space and a number (with optional comma/decimal)
const AMOUNT_REGEX = /(?:Rs\.?|INR|₹)\s?([\d,]+(?:\.\d{1,2})?)/i;

export function extractAmount(sms: string): number | null {
  const match = sms.match(AMOUNT_REGEX);
  if (!match) return null;
  const cleaned = match[1].replace(/,/g, '');
  const amount = parseFloat(cleaned);
  return isNaN(amount) ? null : amount;
}

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
        const amount = extractAmount(message.body);
        if (amount !== null) {
          const parsed: ParsedSMS = { amount, rawText: message.body };
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
  const amount = extractAmount(rawText);
  if (amount !== null) {
    const parsed: ParsedSMS = { amount, rawText };
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
