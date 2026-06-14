import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  type ImageBackgroundProps,
  type ImageProps,
  type ImageStyle,
  type StyleProp,
  View,
  StyleSheet,
} from 'react-native';
import { useAuth } from '@/src/state/AuthContext';
import { sessionCookieHeader } from '@/src/lib/api-client';
import { extractStoredImageKey, needsAuthenticatedImageFetch, resolveStoredImageUri } from '@/src/lib/view-image';
import { colors } from '@/src/theme';

type StoredImageProps = Omit<ImageProps, 'source'> & {
  storedUrl?: string | null;
  uri?: string | null;
};

type StoredImageBackgroundProps = Omit<ImageBackgroundProps, 'source'> & {
  storedUrl?: string | null;
  uri?: string | null;
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return globalThis.btoa(binary);
}

function useAuthenticatedImageUri(value?: string | null): {
  uri?: string;
  loading: boolean;
  failed: boolean;
} {
  const { token } = useAuth();
  const normalized = value?.trim();
  const [uri, setUri] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!normalized) {
      setUri(undefined);
      setLoading(false);
      return;
    }

    if (normalized.startsWith('data:') || normalized.startsWith('file://')) {
      setUri(normalized);
      setLoading(false);
      return;
    }

    const resolved = resolveStoredImageUri(normalized);
    if (resolved?.startsWith('data:')) {
      setUri(resolved);
      setLoading(false);
      return;
    }

    if (!needsAuthenticatedImageFetch(normalized)) {
      setUri(resolved ?? normalized);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const viewUrl = resolveStoredImageUri(normalized);
        if (!viewUrl) {
          throw new Error('Missing image URL');
        }

        const headers: Record<string, string> = {};
        if (token) {
          Object.assign(headers, sessionCookieHeader(token));
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(viewUrl, { headers, credentials: 'omit' });
        if (!response.ok) {
          throw new Error(`Image fetch failed (${response.status})`);
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const buffer = await response.arrayBuffer();
        const base64 = arrayBufferToBase64(buffer);
        const dataUri = `data:${contentType};base64,${base64}`;
        if (!cancelled) {
          setUri(dataUri);
          setFailed(false);
        }
      } catch {
        if (!cancelled) {
          setUri(undefined);
          setFailed(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [normalized, token]);

  return { uri, loading, failed };
}

function ImageFallback({ loading }: { loading: boolean }) {
  if (!loading) {
    return null;
  }
  return (
    <View style={styles.fallback}>
      <ActivityIndicator color={colors.gold} />
    </View>
  );
}

export function StoredImage({ storedUrl, uri: uriProp, style, ...props }: StoredImageProps) {
  const { uri, loading, failed } = useAuthenticatedImageUri(storedUrl ?? uriProp);
  if (failed || !uri) {
    return <ImageFallback loading={loading} />;
  }
  return <Image {...props} source={{ uri }} style={style} />;
}

export function StoredImageBackground({
  storedUrl,
  uri: uriProp,
  style,
  imageStyle,
  children,
  ...props
}: StoredImageBackgroundProps) {
  const { uri, loading, failed } = useAuthenticatedImageUri(storedUrl ?? uriProp);
  if (failed || !uri) {
    return (
      <View style={style}>
        <ImageFallback loading={loading} />
        {children}
      </View>
    );
  }
  return (
    <ImageBackground
      {...props}
      source={{ uri }}
      style={style}
      imageStyle={imageStyle as StyleProp<ImageStyle>}
    >
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
});
