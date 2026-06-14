import React, { useMemo } from 'react';
import {
  Image,
  ImageBackground,
  type ImageBackgroundProps,
  type ImageProps,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
} from 'react-native';
import { useAuth } from '@/src/state/AuthContext';
import { sessionCookieHeader } from '@/src/lib/api-client';
import { resolveStoredImageUri } from '@/src/lib/view-image';

type StoredImageProps = Omit<ImageProps, 'source'> & {
  storedUrl?: string | null;
  uri?: string | null;
};

type StoredImageBackgroundProps = Omit<ImageBackgroundProps, 'source'> & {
  storedUrl?: string | null;
  uri?: string | null;
};

function useStoredImageSource(value?: string | null): ImageSourcePropType | undefined {
  const { token } = useAuth();
  const resolved = resolveStoredImageUri(value);

  return useMemo(() => {
    if (!resolved) {
      return undefined;
    }
    if (resolved.startsWith('file://') || resolved.startsWith('data:')) {
      return { uri: resolved };
    }
    if (token) {
      return { uri: resolved, headers: sessionCookieHeader(token) };
    }
    return { uri: resolved };
  }, [resolved, token]);
}

export function StoredImage({ storedUrl, uri, style, ...props }: StoredImageProps) {
  const source = useStoredImageSource(storedUrl ?? uri);
  if (!source) {
    return null;
  }
  return <Image {...props} source={source} style={style} />;
}

export function StoredImageBackground({
  storedUrl,
  uri,
  style,
  imageStyle,
  ...props
}: StoredImageBackgroundProps) {
  const source = useStoredImageSource(storedUrl ?? uri);
  if (!source) {
    return null;
  }
  return (
    <ImageBackground
      {...props}
      source={source}
      style={style}
      imageStyle={imageStyle as StyleProp<ImageStyle>}
    />
  );
}
