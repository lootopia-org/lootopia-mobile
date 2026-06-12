import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Statut TOTP du compte, observé côté client. L'API n'expose pas d'endpoint
 * de statut dédié, donc on le déduit des signaux fiables :
 *  - login avec mfaRequired incluant 'totp'  → activé
 *  - /auth/totp/enroll/verify réussi          → activé
 *  - /auth/totp/disable réussi                → désactivé
 * Tant qu'aucun signal n'a été observé : statut inconnu (null).
 */
const KEY = 'lootopia-mobile-totp-enabled';

export async function getTotpStatus(): Promise<boolean | null> {
  const stored = await AsyncStorage.getItem(KEY);
  if (stored === 'true') {
    return true;
  }
  if (stored === 'false') {
    return false;
  }
  return null;
}

export async function setTotpStatus(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, enabled ? 'true' : 'false');
}

export async function clearTotpStatus(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
