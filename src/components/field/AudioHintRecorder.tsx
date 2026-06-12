import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
} from 'expo-audio';
import { colors, radii } from '@/src/theme';

/**
 * Indice audio d'une étape de brouillon Terrain : enregistrement micro
 * de 10 s max (arrêt auto), réécoute possible une fois capturé.
 */

const MAX_DURATION_SECONDS = 10;

type Props = {
  audioHintUri?: string;
  onRecorded: (uri: string) => void;
};

export function AudioHintRecorder({ audioHintUri, onRecorded }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stopTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppingRef = useRef(false);

  const clearTimers = () => {
    if (stopTimeout.current) {
      clearTimeout(stopTimeout.current);
      stopTimeout.current = null;
    }
    if (tickInterval.current) {
      clearInterval(tickInterval.current);
      tickInterval.current = null;
    }
  };

  useEffect(() => clearTimers, []);

  const startRecording = async () => {
    setError(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Permission micro refusée.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      stoppingRef.current = false;
      setElapsed(0);
      setRecording(true);
      tickInterval.current = setInterval(
        () => setElapsed((value) => Math.min(value + 1, MAX_DURATION_SECONDS)),
        1000
      );
      // Arrêt automatique à 10 s.
      stopTimeout.current = setTimeout(() => {
        void stopRecording();
      }, MAX_DURATION_SECONDS * 1000);
    } catch {
      setError("Impossible de démarrer l'enregistrement.");
    }
  };

  const stopRecording = async () => {
    if (stoppingRef.current) {
      return;
    }
    stoppingRef.current = true;
    clearTimers();
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (recorder.uri) {
        onRecorded(recorder.uri);
      }
    } catch {
      setError("Échec de l'enregistrement.");
    } finally {
      setRecording(false);
    }
  };

  const playHint = () => {
    if (!audioHintUri) {
      return;
    }
    player.replace(audioHintUri);
    void player.seekTo(0);
    player.play();
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {recording ? (
          <Pressable style={[styles.button, styles.stopButton]} onPress={() => void stopRecording()}>
            <Text style={styles.stopText}>■ Stop</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.button} onPress={() => void startRecording()}>
            <Text style={styles.buttonText}>
              🎙 {audioHintUri ? "Réenregistrer l'indice audio" : 'Indice audio 10 s'}
            </Text>
          </Pressable>
        )}
        {recording ? (
          <Text style={styles.recIndicator}>● REC 0:{String(elapsed).padStart(2, '0')}</Text>
        ) : null}
        {!recording && audioHintUri ? (
          <Pressable style={styles.playButton} onPress={playHint}>
            <Text style={styles.playText}>▶ Écouter</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  button: {
    borderColor: colors.glassBorderStrong,
    borderWidth: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  buttonText: { color: colors.gold, fontWeight: '800', fontSize: 12 },
  stopButton: { backgroundColor: 'rgba(248,113,113,0.12)', borderColor: colors.danger },
  stopText: { color: colors.danger, fontWeight: '900', fontSize: 12 },
  recIndicator: { color: colors.danger, fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  playButton: {
    borderColor: colors.glassBorderStrong,
    borderWidth: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.glass,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  playText: { color: colors.teal, fontWeight: '800', fontSize: 12 },
  error: { color: colors.danger, fontSize: 11, marginTop: 6 },
});
