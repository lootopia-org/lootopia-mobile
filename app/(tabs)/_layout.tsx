import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/state/AuthContext';
import { colors } from '@/src/theme';

export default function TabsLayout() {
  const { user } = useAuth();
  // Mode Terrain réservé aux partenaires/admins (mêmes rôles que le web).
  const canAccessField = user?.role === 'partner' || user?.role === 'admin';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: 'rgba(248, 250, 252, 0.45)',
        tabBarStyle: {
          backgroundColor: 'rgba(11, 15, 26, 0.98)',
          borderTopColor: colors.glassBorder,
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
      <Tabs.Screen
        name="index"
        options={{ title: 'Carte', tabBarIcon: ({ color, size }) => <Ionicons name="navigate-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="chases"
        options={{ title: 'Disponibles', tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="in-progress"
        options={{ title: 'En cours', tabBarIcon: ({ color, size }) => <Ionicons name="flag-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="field"
        options={{
          title: 'Terrain',
          // href: null masque l'onglet pour les joueurs (l'écran re-vérifie le rôle).
          href: canAccessField ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="construct-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'Profil', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
