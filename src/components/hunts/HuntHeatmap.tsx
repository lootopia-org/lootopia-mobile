import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MapView, { Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import type { HuntAnalytics } from '@/src/lib/chase-api';
import { colors, darkMapStyle, glassCard, radii } from '@/src/theme';

type HuntHeatmapProps = {
  analytics: HuntAnalytics;
};

function parseCoord(value?: string): number | null {
  if (!value) {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function HuntHeatmap({ analytics }: HuntHeatmapProps) {
  const { t } = useTranslation('hunts');

  const { center, maxCompletions, stepMarkers, userDots } = useMemo(() => {
    const stepMarkers = analytics.steps
      .map((step) => {
        const lat = parseCoord(step.latitude);
        const lng = parseCoord(step.longitude);
        if (lat === null || lng === null) {
          return null;
        }
        return { ...step, lat, lng };
      })
      .filter(Boolean) as Array<(typeof analytics.steps)[number] & { lat: number; lng: number }>;

    const userDots = analytics.userLocations
      .map((loc) => {
        const lat = parseCoord(loc.latitude);
        const lng = parseCoord(loc.longitude);
        if (lat === null || lng === null) {
          return null;
        }
        return { lat, lng };
      })
      .filter(Boolean) as Array<{ lat: number; lng: number }>;

    const allPoints = [
      ...stepMarkers.map((m) => ({ lat: m.lat, lng: m.lng })),
      ...userDots,
    ];

    const center =
      allPoints.length > 0
        ? {
            latitude: allPoints.reduce((sum, p) => sum + p.lat, 0) / allPoints.length,
            longitude: allPoints.reduce((sum, p) => sum + p.lng, 0) / allPoints.length,
          }
        : { latitude: 37.7749, longitude: -122.4194 };

    const maxCompletions = Math.max(1, ...stepMarkers.map((s) => s.completionCount));

    return { center, maxCompletions, stepMarkers, userDots };
  }, [analytics]);

  if (stepMarkers.length === 0 && userDots.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>{t('detail.heatmap.empty')}</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.mapCard}>
        <MapView
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          customMapStyle={darkMapStyle}
          initialRegion={{
            latitude: center.latitude,
            longitude: center.longitude,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          }}
        >
          {userDots.map((dot, index) => (
            <Circle
              key={`user-${index}`}
              center={{ latitude: dot.lat, longitude: dot.lng }}
              radius={25}
              fillColor="rgba(45, 212, 191, 0.35)"
              strokeColor="rgba(45, 212, 191, 0.8)"
              strokeWidth={1}
            />
          ))}
          {stepMarkers.map((step) => {
            const intensity = step.completionCount / maxCompletions;
            const radius = 30 + intensity * 70;
            return (
              <Circle
                key={step.stepId}
                center={{ latitude: step.lat, longitude: step.lng }}
                radius={radius}
                fillColor={`rgba(212, 175, 55, ${0.25 + intensity * 0.45})`}
                strokeColor="rgba(212, 175, 55, 0.9)"
                strokeWidth={2}
              />
            );
          })}
        </MapView>
      </View>

      <Text style={styles.stats}>
        {t('detail.heatmap.stats', {
          participantCount: analytics.participantCount,
          completedCount: analytics.completedHuntCount,
        })}
      </Text>
      <Text style={styles.legend}>{t('detail.heatmap.legend.stepCompletions')}</Text>
      <Text style={styles.legend}>{t('detail.heatmap.legend.recentLocations')}</Text>

      {stepMarkers.length > 0 ? (
        <View style={styles.topSteps}>
          {[...stepMarkers]
            .sort((a, b) => b.completionCount - a.completionCount)
            .slice(0, 5)
            .map((step) => (
              <View key={step.stepId} style={styles.topStepRow}>
                <Text style={styles.topStepTitle} numberOfLines={1}>
                  {t('detail.heatmap.topSteps', { order: step.order, title: step.title })}
                </Text>
                <Text style={styles.topStepVisits}>{t('detail.heatmap.visits', { count: step.completionCount })}</Text>
              </View>
            ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mapCard: { ...glassCard, overflow: 'hidden', marginBottom: 10 },
  map: { height: 280, width: '100%' },
  emptyCard: { ...glassCard, padding: 24, marginBottom: 10, alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  stats: { color: colors.foreground, fontWeight: '800', fontSize: 13, marginBottom: 6 },
  legend: { color: colors.textMuted, fontSize: 11, marginBottom: 2 },
  topSteps: { marginTop: 10, gap: 6 },
  topStepRow: {
    ...glassCard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  topStepTitle: { color: colors.foreground, fontSize: 12, fontWeight: '700', flex: 1 },
  topStepVisits: { color: colors.gold, fontSize: 11, fontWeight: '800' },
});
