import * as THREE from 'three';
import type { AvatarModel } from '@/src/state/HuntsContext';

// Personnages 3D low-poly procéduraux (primitives three.js, zéro asset à
// télécharger : fiable hors-ligne et budget perf garanti, cf. étude de
// faisabilité). Deux modèles simples, sans cosmétiques : homme / femme.

export type CharacterRig = {
  group: any; // THREE.Group
  leftArm: any;
  rightArm: any;
  leftLeg: any;
  rightLeg: any;
  head: any;
};

const SKIN = 0xe8b890;
const TROUSERS = 0x1c2333;

export function buildCharacter(model: AvatarModel): CharacterRig {
  const isFemale = model === 'female';
  const shirtColor = isFemale ? 0xd4af37 : 0x2dd4bf; // or / teal — palette Lootopia
  const hairColor = isFemale ? 0x5a3825 : 0x2b2b2b;

  const group = new THREE.Group();

  const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7 });
  const trousers = new THREE.MeshStandardMaterial({ color: TROUSERS, roughness: 0.85 });
  const hair = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.9 });

  // Torse — épaules plus étroites pour le modèle féminin.
  const torsoWidth = isFemale ? 0.52 : 0.62;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoWidth, 0.72, 0.32), shirt);
  torso.position.y = 1.05;
  group.add(torso);

  // Tête + cheveux.
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.32), skin);
  head.position.y = 1.62;
  group.add(head);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.34), hair);
  cap.position.y = 1.78;
  group.add(cap);

  if (isFemale) {
    // Queue de cheval : seul marqueur distinctif, pas de cosmétique au sens propre.
    const ponytail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.12), hair);
    ponytail.position.set(0, 1.6, -0.24);
    group.add(ponytail);
  }

  // Bras — pivot à l'épaule (géométrie décalée pour que la rotation parte de l'épaule).
  const makeArm = (side: 1 | -1) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), shirt);
    arm.geometry.translate(0, -0.3, 0);
    arm.position.set(side * (torsoWidth / 2 + 0.1), 1.38, 0);
    group.add(arm);
    return arm;
  };
  const rightArm = makeArm(1);
  const leftArm = makeArm(-1);

  // Jambes — pivot à la hanche.
  const makeLeg = (side: 1 | -1) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.68, 0.22), trousers);
    leg.geometry.translate(0, -0.34, 0);
    leg.position.set(side * 0.16, 0.68, 0);
    group.add(leg);
    return leg;
  };
  const rightLeg = makeLeg(1);
  const leftLeg = makeLeg(-1);

  return { group, leftArm, rightArm, leftLeg, rightLeg, head };
}

// Coffre au trésor low-poly pour la vue AR : base + couvercle pivotant.
export type ChestRig = {
  group: any;
  lid: any; // rotation.x négative = couvercle ouvert
};

export function buildChest(): ChestRig {
  const group = new THREE.Group();

  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.85 });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.35,
    metalness: 0.7,
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.7), wood);
  base.position.y = 0.3;
  group.add(base);

  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.1, 0.74), gold);
  trim.position.y = 0.58;
  group.add(trim);

  // Couvercle : pivot sur l'arête arrière.
  const lid = new THREE.Group();
  const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.26, 0.7), wood);
  lidMesh.position.set(0, 0.13, 0.35);
  lid.add(lidMesh);
  const lidTrim = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.08, 0.2), gold);
  lidTrim.position.set(0, 0.18, 0.35);
  lid.add(lidTrim);
  lid.position.set(0, 0.63, -0.35);
  group.add(lid);

  // Trésor visible quand le couvercle s'ouvre.
  const loot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), gold);
  loot.position.set(0, 0.62, 0);
  group.add(loot);

  return { group, lid };
}

export const CHEST_AR_DISTANCE = 25;

export type GrassMoundRig = {
  group: any;
};

/** Grass-and-dirt mound that hides a buried treasure chest. */
export function buildGrassMound(): GrassMoundRig {
  const group = new THREE.Group();

  const grass = new THREE.MeshStandardMaterial({ color: 0x3d8b37, roughness: 0.95 });
  const dirt = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 1 });

  const dirtMound = new THREE.Mesh(
    new THREE.SphereGeometry(1.35, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    dirt
  );
  dirtMound.scale.set(1.2, 0.45, 1.0);
  dirtMound.position.y = 0.12;
  group.add(dirtMound);

  const grassCap = new THREE.Mesh(
    new THREE.SphereGeometry(1.22, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.48),
    grass
  );
  grassCap.scale.set(1.1, 0.34, 0.92);
  grassCap.position.y = 0.34;
  group.add(grassCap);

  const bladeGeo = new THREE.ConeGeometry(0.04, 0.22, 4);
  for (let i = 0; i < 36; i++) {
    const blade = new THREE.Mesh(bladeGeo, grass);
    const angle = (i / 36) * Math.PI * 2 + (i % 3) * 0.2;
    const radius = 0.3 + (i % 5) * 0.16;
    blade.position.set(
      Math.cos(angle) * radius,
      0.3 + (i % 4) * 0.04,
      Math.sin(angle) * radius * 0.82
    );
    blade.rotation.set((i % 2) * 0.25 - 0.12, angle, (i % 3) * 0.18 - 0.09);
    group.add(blade);
  }

  return { group };
}

/** Low-poly dynamite stick with fuse. */
export function buildDynamite(): any {
  const group = new THREE.Group();

  const stickMat = new THREE.MeshStandardMaterial({ color: 0xb53d3d, roughness: 0.65 });
  const fuseMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    roughness: 0.75,
    emissive: 0xfbbf24,
    emissiveIntensity: 0.35,
  });

  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.34, 8), stickMat);
  stick.rotation.z = Math.PI / 2;
  group.add(stick);

  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.11, 6), fuseMat);
  fuse.position.set(0.19, 0.05, 0);
  fuse.rotation.z = -0.45;
  group.add(fuse);

  return group;
}

export type ExplosionRig = {
  group: any;
  particles: any[];
};

/** Burst of low-poly particles for a dynamite detonation. */
export function buildExplosion(): ExplosionRig {
  const group = new THREE.Group();
  const particles: any[] = [];
  const colors = [0xfbbf24, 0xf97316, 0x78716c, 0x3d8b37];

  for (let i = 0; i < 18; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: colors[i % colors.length],
      roughness: 0.85,
      transparent: true,
      opacity: 1,
    });
    const size = 0.06 + (i % 4) * 0.04;
    const particle = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
    const angle = (i / 18) * Math.PI * 2;
    const speed = 1.4 + (i % 5) * 0.35;
    particles.push({
      mesh: particle,
      vx: Math.cos(angle) * speed,
      vy: 1.2 + (i % 3) * 0.6,
      vz: Math.sin(angle) * speed,
    });
    group.add(particle);
  }

  group.visible = false;
  return { group, particles };
}
