import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '@/src/state/AuthContext';

export default function Index() {
  const router = useRouter();
  const { isReady, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    router.replace(isAuthenticated ? '/(tabs)/chases' : '/(auth)/login');
  }, [isReady, isAuthenticated, router]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#ff6b35" />
      </View>
    );
  }

  return <Redirect href={isAuthenticated ? '/(tabs)/chases' : '/(auth)/login'} />;
}