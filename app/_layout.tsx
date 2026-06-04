import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/src/state/AuthContext';
import { DemoProvider } from '@/src/state/DemoContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DemoProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }} />
        </AuthProvider>
      </DemoProvider>
    </SafeAreaProvider>
  );
}