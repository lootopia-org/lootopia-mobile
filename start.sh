#!/usr/bin/env bash
set -euo pipefail


export EXPO_PACKAGER_PROXY_URL="${EXPO_PACKAGER_PROXY_URL:-https://expo-dev.wookiesrpeople2.dev}"
export REACT_NATIVE_PACKAGER_HOSTNAME="${REACT_NATIVE_PACKAGER_HOSTNAME:-expo-dev.wookiesrpeople2.dev}"
export EXPO_PORT="${EXPO_PORT:-8081}"

echo "Starting Expo for Cloudflare tunnel:"
echo "  EXPO_PACKAGER_PROXY_URL=$EXPO_PACKAGER_PROXY_URL"
echo "  REACT_NATIVE_PACKAGER_HOSTNAME=$REACT_NATIVE_PACKAGER_HOSTNAME"
echo "  Port: $EXPO_PORT"
echo ""
echo "In Expo Go, use: exps://${REACT_NATIVE_PACKAGER_HOSTNAME#https://}"
echo ""

exec npx expo start --port "$EXPO_PORT" "$@"