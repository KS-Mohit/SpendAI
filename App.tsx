import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { ModelProvider, useModel } from './src/services/ModelService';
import {
  onSMSReceived,
  sendTransactionNotification,
  ParsedSMS,
} from './src/services/SMSService';
import { Colors } from './src/theme/colors';
import DashboardScreen from './src/screens/DashboardScreen';
import ConfirmTransactionScreen from './src/screens/ConfirmTransactionScreen';
import TransactionDetailScreen from './src/screens/TransactionDetailScreen';
import InsightsScreen from './src/screens/InsightsScreen';
import DevScreen from './src/screens/DevScreen';

// Configure notifications to show when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

import { RootStackParamList } from './src/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { initializeModel } = useModel();
  const navigationRef = React.useRef<any>(null);

  // Initialize model on mount
  useEffect(() => {
    initializeModel();
  }, [initializeModel]);

  // Listen for SMS and navigate to confirm screen
  useEffect(() => {
    const unsubscribe = onSMSReceived((parsed: ParsedSMS) => {
      sendTransactionNotification(parsed.amount);

      // Navigate to confirm screen
      if (navigationRef.current) {
        navigationRef.current.navigate('ConfirmTransaction', {
          amount: parsed.amount,
          rawSms: parsed.rawText,
        });
      }
    });

    return unsubscribe;
  }, []);

  // Handle notification taps
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.amount && navigationRef.current) {
          navigationRef.current.navigate('ConfirmTransaction', {
            amount: data.amount,
            rawSms: '',
          });
        }
      }
    );
    return () => subscription.remove();
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.textPrimary,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ConfirmTransaction"
          component={ConfirmTransactionScreen}
          options={{ title: 'Categorize' }}
        />
        <Stack.Screen
          name="TransactionDetail"
          component={TransactionDetailScreen}
          options={{ title: 'Details' }}
        />
        <Stack.Screen
          name="Insights"
          component={InsightsScreen}
          options={{ title: '' }}
        />
        <Stack.Screen
          name="Dev"
          component={DevScreen}
          options={{ title: '' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ModelProvider>
        <AppNavigator />
      </ModelProvider>
    </SafeAreaProvider>
  );
}
