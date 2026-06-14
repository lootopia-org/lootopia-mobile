import React, { useState } from 'react';
import { ScrollView, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/state/AuthContext';
import { colors, glassCard, radii } from '@/src/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { t } = useTranslation(['auth', 'common']);
  const { signUp } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    if (!username.trim()) {
      setError(t('auth:register.errors.usernameRequired'));
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      setInfo(null);
      await signUp({
        username: username.trim(),
        email: email.trim(),
        password,
        bio: bio.trim() || undefined,
        avatar: avatar.trim() || undefined,
      });
      setInfo(t('auth:register.success.mobile'));
      router.replace('/(auth)/login');
    } catch {
      setError(t('auth:register.errors.createFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('auth:register.title')}</Text>
      <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder={t('auth:register.usernamePlaceholder')} placeholderTextColor={colors.textFaint} autoCapitalize="none" />
      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder={t('auth:register.emailPlaceholder')} placeholderTextColor={colors.textFaint} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder={t('auth:register.passwordPlaceholder')} placeholderTextColor={colors.textFaint} secureTextEntry />
      <TextInput
        style={[styles.input, styles.bioInput]}
        value={bio}
        onChangeText={setBio}
        placeholder={t('auth:register.bioPlaceholder')}
        placeholderTextColor={colors.textFaint}
        multiline
        numberOfLines={3}
      />
      <TextInput style={styles.input} value={avatar} onChangeText={setAvatar} placeholder={t('auth:register.avatarPlaceholder')} placeholderTextColor={colors.textFaint} autoCapitalize="none" />

      {error && <Text style={styles.error}>{error}</Text>}
      {info && <Text style={styles.info}>{info}</Text>}

      <Pressable style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleRegister} disabled={isLoading}>
        <Text style={styles.buttonText}>{t('auth:register.submit')}</Text>
      </Pressable>

      <Link href="/(auth)/login" style={styles.link}>
        {t('auth:register.hasAccount')}
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '900', color: colors.foreground, marginBottom: 18 },
  input: { ...glassCard, borderRadius: radii.md, padding: 16, marginBottom: 12, color: colors.foreground },
  bioInput: { minHeight: 84, textAlignVertical: 'top' },
  button: { backgroundColor: colors.gold, paddingVertical: 16, borderRadius: radii.md, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: colors.background, fontWeight: '900', fontSize: 16 },
  error: { color: colors.danger, marginBottom: 8 },
  info: { color: colors.teal, marginBottom: 8 },
  link: { textAlign: 'center', marginTop: 18, color: colors.teal, fontWeight: '600' },
});
