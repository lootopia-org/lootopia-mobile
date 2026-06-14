import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/state/AuthContext';
import { useHunts, type AvatarModel } from '@/src/state/HuntsContext';
import { PlayerCharacter3D } from '@/src/components/PlayerCharacter3D';
import { SecuritySection } from '@/src/components/SecuritySection';
import { usePlayerProfile } from '@/src/hooks/usePlayerProfile';
import { profileApi } from '@/src/lib/profile-api';
import { setAppLocale, type AppLocale } from '@/src/i18n';
import { colors, glassCard, glassStrongCard, radii } from '@/src/theme';

const XP_TARGET = 2000;

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation(['common']);
  const { user, signOut, token } = useAuth();
  const { avatarModel, setAvatarModel, acceptedHunts } = useHunts();
  const { profile, points, level, completedHunts, refreshProfile } = usePlayerProfile();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const realToken = token;

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const handleDeleteProfile = async () => {
    if (!realToken) {
      return;
    }
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await profileApi.delete(realToken);
      await refreshProfile();
    } finally {
      setConfirmDelete(false);
    }
  };

  const handleLanguageChange = async (locale: AppLocale) => {
    await setAppLocale(locale);
  };

  const xpRatio = Math.min(points / XP_TARGET, 1);
  const currentLocale = i18n.language.startsWith('fr') ? 'fr' : 'en';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32, paddingHorizontal: 16 }}
    >
      <Text style={styles.header}>{t('common:account.profile')}</Text>

      <View style={[styles.avatarCard]}>
        <PlayerCharacter3D model={avatarModel} walking={false} headingDegrees={25} size={150} showBadge={false} />
        <View style={styles.toggleRow}>
          <ModelToggle
            current={avatarModel}
            value="male"
            label={t('common:avatar.male')}
            onSelect={setAvatarModel}
          />
          <ModelToggle
            current={avatarModel}
            value="female"
            label={t('common:avatar.female')}
            onSelect={setAvatarModel}
          />
        </View>
        <Text style={styles.username}>{user?.username ?? t('common:guest')}</Text>
        <Text style={styles.role}>
          {user?.role ? t(`common:roles.${user.role}`) : t('common:roles.player')} · {user?.email ?? '-'}
        </Text>
      </View>

      <View style={styles.levelCard}>
        <View style={styles.levelRow}>
          <Text style={styles.levelText}>{t('common:account.level', { level })}</Text>
          <Text style={styles.xpText}>
            {t('common:account.xpProgress', { points, target: XP_TARGET })}
            {profile ? '' : ` · ${t('common:offline')}`}
          </Text>
        </View>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${Math.round(xpRatio * 100)}%` }]} />
        </View>
      </View>

      <View style={styles.statsGrid}>
        <Stat value={String(points)} label={t('common:account.stats.points')} gold />
        <Stat value={String(completedHunts)} label={t('common:account.stats.completedHunts')} />
        <Stat value={String(Object.keys(acceptedHunts).length)} label={t('common:account.stats.inProgress')} teal />
      </View>

      <View style={styles.languageCard}>
        <Text style={styles.languageTitle}>{t('common:localeSwitcher.label')}</Text>
        <View style={styles.languageRow}>
          <LanguageToggle
            label={t('common:localeSwitcher.en')}
            active={currentLocale === 'en'}
            onPress={() => void handleLanguageChange('en')}
          />
          <LanguageToggle
            label={t('common:localeSwitcher.fr')}
            active={currentLocale === 'fr'}
            onPress={() => void handleLanguageChange('fr')}
          />
        </View>
      </View>

      <SecuritySection />

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>{t('common:account.logout')}</Text>
      </Pressable>

      {realToken && (
        <Pressable onPress={handleDeleteProfile}>
          <Text style={styles.deleteProfile}>
            {confirmDelete ? t('common:account.deleteProfileConfirm') : t('common:account.deleteProfile')}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function ModelToggle({
  current,
  value,
  label,
  onSelect,
}: {
  current: AvatarModel;
  value: AvatarModel;
  label: string;
  onSelect: (model: AvatarModel) => void;
}) {
  const active = current === value;
  return (
    <Pressable style={[styles.toggle, active && styles.toggleActive]} onPress={() => onSelect(value)}>
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{label}</Text>
    </Pressable>
  );
}

function LanguageToggle({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.toggle, active && styles.toggleActive]} onPress={onPress}>
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Stat({ value, label, gold, teal }: { value: string; label: string; gold?: boolean; teal?: boolean }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, gold && { color: colors.gold }, teal && { color: colors.teal }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { fontSize: 28, fontWeight: '900', color: colors.foreground, marginBottom: 16 },
  avatarCard: { ...glassStrongCard, alignItems: 'center', padding: 20 },
  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  toggle: { borderColor: colors.glassBorderStrong, borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 18, paddingVertical: 7, backgroundColor: colors.glass },
  toggleActive: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  toggleText: { color: colors.textMuted, fontWeight: '800', fontSize: 13 },
  toggleTextActive: { color: colors.gold },
  username: { color: colors.foreground, fontSize: 20, fontWeight: '900', marginTop: 14 },
  role: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  levelCard: { ...glassCard, padding: 16, marginTop: 12 },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  levelText: { color: colors.gold, fontWeight: '900', fontSize: 15 },
  xpText: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
  xpTrack: { height: 10, borderRadius: radii.pill, backgroundColor: colors.glass, borderColor: colors.glassBorder, borderWidth: 1, overflow: 'hidden' },
  xpFill: { height: '100%', backgroundColor: colors.gold },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  statCard: { ...glassCard, flexBasis: '47%', flexGrow: 1, paddingVertical: 16, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '900', color: colors.foreground },
  statLabel: { color: colors.textMuted, marginTop: 4, fontSize: 11, fontWeight: '700' },
  languageCard: { ...glassCard, padding: 16, marginTop: 12 },
  languageTitle: { color: colors.foreground, fontWeight: '800', fontSize: 14, marginBottom: 10 },
  languageRow: { flexDirection: 'row', gap: 8 },
  logoutButton: { marginTop: 20, borderColor: colors.danger, borderWidth: 1, paddingVertical: 15, borderRadius: radii.md, alignItems: 'center', backgroundColor: 'rgba(248,113,113,0.08)' },
  logoutText: { color: colors.danger, fontWeight: '800' },
  deleteProfile: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 14, textDecorationLine: 'underline' },
});
