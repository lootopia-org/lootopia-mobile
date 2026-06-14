import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '@/src/state/AuthContext';
import { isPlayerUser } from '@/src/lib/player-access';

export default function Index() {
  const router = useRouter();
  const { isReady, isAuthenticated, user } = useAuth();

  const destination = !isAuthenticated
    ? '/(auth)/login'
    : isPlayerUser(user)
      ? '/(tabs)/chases'
      : '/(tabs)/field';

  useEffect(() => {
    if (!isReady) return;
    router.replace(destination);
  }, [isReady, destination, router]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#d4af37" />
      </View>
    );
  }

  return <Redirect href={destination} />;
}