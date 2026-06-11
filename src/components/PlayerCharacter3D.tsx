import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { colors } from '@/src/theme';
import type { AvatarModel } from '@/src/state/HuntsContext';
import { buildCharacter } from '@/src/components/three/buildCharacter';
import { createFrameLimiter, useAppActiveRef } from '@/src/hooks/useAppActiveRef';
import { recordFrame } from '@/src/lib/perf';

type PlayerCharacter3DProps = {
  model: AvatarModel;
  walking: boolean;
  headingDegrees?: number | null;
  size?: number;
  showBadge?: boolean;
};

/**
 * Personnage 3D rendu via expo-gl + three.js (remplace le sprite du MVP,
 * même interface). Modèle low-poly procédural : animation de marche
 * (balancier bras/jambes), idle (légère respiration), orientation selon le cap.
 *
 * Les props dynamiques (walking/heading) sont lues via des refs dans la boucle
 * de rendu pour ne pas recréer le contexte GL à chaque changement. Le contexte
 * n'est recréé que si le modèle (homme/femme) change (via la prop `key`).
 */
export function PlayerCharacter3D({
  model,
  walking,
  headingDegrees,
  size = 132,
  showBadge = true,
}: PlayerCharacter3DProps) {
  const walkingRef = useRef(walking);
  const headingRef = useRef(headingDegrees ?? 0);
  const frameRef = useRef<number | null>(null);
  const appActiveRef = useAppActiveRef();

  useEffect(() => {
    walkingRef.current = walking;
  }, [walking]);

  useEffect(() => {
    headingRef.current = headingDegrees ?? 0;
  }, [headingDegrees]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    },
    []
  );

  const onContextCreate = (gl: any) => {
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    // Fond transparent : le personnage se superpose à la carte.
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      35,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.1,
      50
    );
    camera.position.set(0, 1.35, 4.2);
    camera.lookAt(0, 0.95, 0);

    scene.add(new THREE.HemisphereLight(0xf8fafc, 0x1c2333, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(2, 4, 3);
    scene.add(sun);

    const rig = buildCharacter(model);
    scene.add(rig.group);

    // Optimisation : 30 fps max (suffisant pour un personnage sur carte) et
    // aucun rendu quand l'app est en arrière-plan. Le temps est basé sur
    // l'horloge réelle pour que la vitesse d'animation reste constante.
    let t = 0;
    let lastTick = Date.now();
    const shouldRender = createFrameLimiter(30);

    const renderLoop = () => {
      frameRef.current = requestAnimationFrame(renderLoop);
      if (!appActiveRef.current || !shouldRender()) {
        return;
      }
      const now = Date.now();
      t += Math.min((now - lastTick) / 1000, 0.1);
      lastTick = now;
      recordFrame('character');

      const isWalking = walkingRef.current;

      if (isWalking) {
        // Balancier bras/jambes opposés + léger rebond vertical.
        const swing = Math.sin(t * 9) * 0.75;
        rig.leftArm.rotation.x = swing;
        rig.rightArm.rotation.x = -swing;
        rig.leftLeg.rotation.x = -swing * 0.9;
        rig.rightLeg.rotation.x = swing * 0.9;
        rig.group.position.y = Math.abs(Math.sin(t * 9)) * 0.06;
      } else {
        // Idle : retour progressif des membres + respiration.
        rig.leftArm.rotation.x *= 0.9;
        rig.rightArm.rotation.x *= 0.9;
        rig.leftLeg.rotation.x *= 0.9;
        rig.rightLeg.rotation.x *= 0.9;
        rig.group.position.y = Math.sin(t * 1.8) * 0.02;
        rig.head.rotation.y = Math.sin(t * 0.7) * 0.18;
      }

      // Orientation : cap GPS (0° = nord, carte orientée nord = -Z écran).
      const targetRotation = (-(headingRef.current ?? 0) * Math.PI) / 180;
      rig.group.rotation.y += (targetRotation - rig.group.rotation.y) * 0.12;

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    renderLoop();
  };

  return (
    <View style={styles.wrapper} pointerEvents="none">
      {/* key={model} force la recréation de la scène quand on change de personnage. */}
      <GLView key={model} style={{ width: size, height: size }} onContextCreate={onContextCreate} />
      <View style={styles.shadow} />
      {showBadge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{walking ? 'En marche' : 'Toi'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  shadow: { width: 34, height: 10, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.35)', marginTop: -14 },
  badge: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(11,15,26,0.85)',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  badgeText: { color: colors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
});
