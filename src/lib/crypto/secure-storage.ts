import type { KeyStorage } from 'lootopia-crypto';
import * as SecureStore from 'expo-secure-store';

const PREFIX = 'lootopia-crypto:';

export function createSecureKeyStorage(): KeyStorage {
  return {
    async getItem(key: string) {
      return SecureStore.getItemAsync(`${PREFIX}${key}`);
    },
    async setItem(key: string, value: string) {
      await SecureStore.setItemAsync(`${PREFIX}${key}`, value);
    },
    async removeItem(key: string) {
      await SecureStore.deleteItemAsync(`${PREFIX}${key}`);
    },
  };
}
