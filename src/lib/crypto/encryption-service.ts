import {
  derivePersonalKey,
  exportPrivateKey,
  exportPublicKey,
  generateIdentityKeyPair,
  importPrivateKey,
  importPublicKey,
  loadPrivateKey,
  savePrivateKey,
  unwrapHuntKey,
  type IdentityKeyPair,
} from 'lootopia-crypto';
import { x25519 } from '@noble/curves/ed25519';

import { encryptionApi } from '@/src/lib/encryption-api';
import { createSecureKeyStorage } from '@/src/lib/crypto/secure-storage';

const storage = createSecureKeyStorage();
const huntKeyCache = new Map<string, Uint8Array>();

let identityPair: IdentityKeyPair | null = null;

async function getIdentityPair(): Promise<IdentityKeyPair> {
  if (identityPair) {
    return identityPair;
  }

  const stored = await loadPrivateKey(storage);
  if (stored) {
    const privateKey = importPrivateKey(stored);
    identityPair = {
      privateKey,
      publicKey: x25519.getPublicKey(privateKey),
    };
    return identityPair;
  }

  identityPair = generateIdentityKeyPair();
  await savePrivateKey(storage, exportPrivateKey(identityPair.privateKey));
  return identityPair;
}

export async function ensureEncryptionKeysUploaded(token: string): Promise<void> {
  const pair = await getIdentityPair();
  await encryptionApi.putPublicKey(token, exportPublicKey(pair.publicKey));
}

export async function getPersonalKey(): Promise<Uint8Array> {
  const pair = await getIdentityPair();
  return derivePersonalKey(pair.privateKey);
}

export async function getIdentityPrivateKey(): Promise<Uint8Array> {
  const pair = await getIdentityPair();
  return pair.privateKey;
}

export async function fetchUserPublicKey(
  token: string,
  userId: string
): Promise<Uint8Array> {
  const response = await encryptionApi.getPublicKey(token, userId);
  return importPublicKey(response.publicKey);
}

export async function getHuntKey(
  token: string,
  huntId: string,
  partnerId: string
): Promise<Uint8Array> {
  const cached = huntKeyCache.get(huntId);
  if (cached) {
    return cached;
  }

  const response = await encryptionApi.getHuntKey(token, huntId);
  const pair = await getIdentityPair();
  const partnerPublicKey = await fetchUserPublicKey(token, partnerId);
  const huntKey = unwrapHuntKey(response.wrappedKey, pair.privateKey, partnerPublicKey);
  huntKeyCache.set(huntId, huntKey);
  return huntKey;
}

export function cacheHuntKey(huntId: string, huntKey: Uint8Array): void {
  huntKeyCache.set(huntId, huntKey);
}

export function clearHuntKeyCache(): void {
  huntKeyCache.clear();
}
