import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/state/AuthContext';

export default function TabsLayout() {
  const { user } = useAuth();
  // Studio réservé aux partenaires et admins (comme sur le frontend web).
  const canAccessStudio = user?.role === 'partner' || user?.role === 'admin';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#ff6b35',
        tabBarInactiveTintColor: '#8b8b8b',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#f2ddd2',
          height: 72,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="chases" options={{ title: 'Chasses', tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="progress" options={{ title: 'Progression', tabBarIcon: ({ color, size }) => <Ionicons name="trophy-outline" color={color} size={size} /> }} />
      <Tabs.Screen
        name="partner-studio"
        options={{
          title: 'Studio',
          // href: null retire l'onglet de la barre pour les joueurs (route protégée en plus dans l'écran).
          href: canAccessStudio ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="briefcase-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="account" options={{ title: 'Compte', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} /> }} />
    </Tabs>
  );
}