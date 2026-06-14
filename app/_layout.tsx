import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/src/state/AuthContext';
import { HuntsProvider } from '@/src/state/HuntsContext';
import { LiveEventsProvider } from '@/src/state/LiveEventsContext';
import { LiveOpsProvider } from '@/src/state/LiveOpsContext';
import { colors } from '@/src/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LiveEventsProvider>
          <HuntsProvider>
            <LiveOpsProvider>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.background },
                }}
              />
            </LiveOpsProvider>
          </HuntsProvider>
        </LiveEventsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
