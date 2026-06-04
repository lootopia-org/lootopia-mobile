import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { authApi, type User } from '@/src/lib/auth-api';

type LoginStage = 'credentials' | 'mfa';

type AuthContextValue = {
  user: User | null;
  isReady: boolean;
  isAuthenticated: boolean;
  loginStage: LoginStage;
  pendingToken: string | null;
  pendingMethods: Array<'totp' | 'webauthn'>;
  emailNotVerified: boolean;
  signIn: (email: string, password: string) => Promise<{ mfaRequired: boolean }>;
  signInDemo: () => Promise<void>;
  verifyTotp: (code: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  signUp: (payload: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  clearMfaState: () => void;
};

const STORAGE_KEY = 'lootopia-mobile-user';
const TOKEN_KEY = 'lootopia-mobile-token';
const PENDING_TOKEN_KEY = 'lootopia-mobile-pending-token';
const DEMO_TOKEN = 'demo-token';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingMethods, setPendingMethods] = useState<Array<'totp' | 'webauthn'>>([]);
  const [loginStage, setLoginStage] = useState<LoginStage>('credentials');
  const [emailNotVerified, setEmailNotVerified] = useState(false);

  useEffect(() => {
    (async () => {
      const [storedUser, storedToken, storedPendingToken] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(PENDING_TOKEN_KEY),
      ]);

      if (storedUser && storedToken) {
        try {
          const parsedUser = JSON.parse(storedUser) as User;
          if (storedToken === DEMO_TOKEN) {
            // Session démo (mock) : on restaure sans appel réseau.
            setUser(parsedUser);
            setToken(storedToken);
          } else {
            const refreshedUser = await authApi.me(storedToken);
            setUser(refreshedUser);
            setToken(storedToken);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(refreshedUser));
          }
        } catch {
          await Promise.all([
            AsyncStorage.removeItem(STORAGE_KEY),
            SecureStore.deleteItemAsync(TOKEN_KEY),
          ]);
        }
      }

      if (storedPendingToken) {
        setPendingToken(storedPendingToken);
      }
      setIsReady(true);
    })();
  }, []);

  const persist = async (nextUser: User | null) => {
    setUser(nextUser);
    if (nextUser) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  };

  const persistToken = async (nextToken: string | null) => {
    setToken(nextToken);
    if (nextToken) {
      await SecureStore.setItemAsync(TOKEN_KEY, nextToken);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  };

  const persistPendingToken = async (nextPendingToken: string | null) => {
    setPendingToken(nextPendingToken);
    if (nextPendingToken) {
      await SecureStore.setItemAsync(PENDING_TOKEN_KEY, nextPendingToken);
    } else {
      await SecureStore.deleteItemAsync(PENDING_TOKEN_KEY);
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isReady,
      isAuthenticated: Boolean(user && token),
      loginStage,
      pendingToken,
      pendingMethods,
      emailNotVerified,
      signIn: async (email: string, password: string) => {
        setEmailNotVerified(false);
        const response = await authApi.login(email, password);

        if (response.mfaRequired) {
          await persistPendingToken(response.token);
          setPendingMethods(response.mfaMethods);
          setLoginStage('mfa');
          return { mfaRequired: true };
        }

        await persistToken(response.token);
        const refreshedUser = await authApi.me(response.token);
        await persist(refreshedUser);
        setLoginStage('credentials');
        setPendingMethods([]);
        await persistPendingToken(null);

        return { mfaRequired: false };
      },
      signInDemo: async () => {
        const demoUser: User = {
          id: 'demo-player',
          username: 'Joueur démo',
          email: 'demo@lootopia.app',
        };

        await persistToken(DEMO_TOKEN);
        await persist(demoUser);
        setLoginStage('credentials');
        setPendingMethods([]);
        await persistPendingToken(null);
      },
      verifyTotp: async (code: string) => {
        if (!pendingToken) {
          throw new Error('Missing pending token');
        }

        const response = await authApi.verifyTotp(pendingToken, code);
        await persistToken(response.token);
        const refreshedUser = await authApi.me(response.token);
        await persist(refreshedUser);
        setLoginStage('credentials');
        setPendingMethods([]);
        await persistPendingToken(null);
      },
      resendVerification: async (email: string) => {
        await authApi.resendVerification(email);
      },
      signUp: async ({ email, password }) => {
        await authApi.register(email, password);
      },
      signOut: async () => {
        if (token) {
          try {
            await authApi.logout(token);
          } catch {
            // Ignore logout errors and clear local session anyway.
          }
        }

        await Promise.all([
          persist(null),
          persistToken(null),
          persistPendingToken(null),
        ]);
        setPendingMethods([]);
        setLoginStage('credentials');
        setEmailNotVerified(false);
      },
      clearMfaState: async () => {
        setLoginStage('credentials');
        setPendingMethods([]);
        setEmailNotVerified(false);
        await persistPendingToken(null);
      },
    }),
    [user, token, isReady, loginStage, pendingToken, pendingMethods, emailNotVerified]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}