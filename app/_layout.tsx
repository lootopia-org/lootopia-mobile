import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import i18n, { initI18n } from '@/src/i18n';
import { AuthProvider } from '@/src/state/AuthContext';
import { HuntsProvider } from '@/src/state/HuntsContext';
import { LiveEventsProvider } from '@/src/state/LiveEventsContext';
import { LiveOpsProvider } from '@/src/state/LiveOpsContext';
import { PlayerProfileProvider } from '@/src/state/PlayerProfileContext';
import { colors } from '@/src/theme';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void initI18n().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <I18nextProvider i18n={i18n}>
      <SafeAreaProvider>
        <AuthProvider>
          <LiveEventsProvider>
            <PlayerProfileProvider>
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
            </PlayerProfileProvider>
          </LiveEventsProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </I18nextProvider>
  );
}
