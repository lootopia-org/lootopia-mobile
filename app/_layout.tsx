import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/src/state/AuthContext';
import { HuntsProvider } from '@/src/state/HuntsContext';
import { LiveOpsProvider } from '@/src/state/LiveOpsContext';
import { FieldProvider } from '@/src/state/FieldContext';
import { colors } from '@/src/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <HuntsProvider>
          <LiveOpsProvider>
            <FieldProvider>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.background },
                }}
              />
            </FieldProvider>
          </LiveOpsProvider>
        </HuntsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
