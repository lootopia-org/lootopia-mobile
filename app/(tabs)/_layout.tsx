import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/state/AuthContext';
import { colors } from '@/src/theme';

export default function TabsLayout() {
  const { t } = useTranslation('common');
  const { user } = useAuth();
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
        options={{ title: t('tabs.map'), tabBarIcon: ({ color, size }) => <Ionicons name="navigate-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="chases"
        options={{ title: t('tabs.available'), tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="in-progress"
        options={{ title: t('tabs.inProgress'), tabBarIcon: ({ color, size }) => <Ionicons name="flag-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="completed"
        options={{ title: t('tabs.completed'), tabBarIcon: ({ color, size }) => <Ionicons name="trophy-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="field"
        options={{
          title: t('tabs.field'),
          href: canAccessField ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="construct-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: t('tabs.profile'), tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
