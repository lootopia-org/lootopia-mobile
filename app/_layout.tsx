import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/src/state/AuthContext';
import { DemoProvider } from '@/src/state/DemoContext';
import { HuntsProvider } from '@/src/state/HuntsContext';
import { colors } from '@/src/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DemoProvider>
        <AuthProvider>
          <HuntsProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
              }}
            />
          </HuntsProvider>
        </AuthProvider>
      </DemoProvider>
    </SafeAreaProvider>
  );
}
