import * as THREE from 'three';

export type DeviceRotation = {
  alpha: number;
  beta: number;
  gamma: number;
};

const euler = new THREE.Euler();
const quaternion = new THREE.Quaternion();
const forward = new THREE.Vector3();
const eye = new THREE.Vector3(0, 1.65, 0);
const portraitFix = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

/** Rotate a perspective camera from expo-sensors DeviceMotion rotation (radians). */
export function applyDeviceOrientationToCamera(
  camera: THREE.PerspectiveCamera,
  rotation: DeviceRotation | null,
  referenceAlpha: number | null
) {
  if (!rotation) {
    return;
  }

  const alpha = referenceAlpha != null ? rotation.alpha - referenceAlpha : rotation.alpha;
  euler.set(rotation.beta, alpha, -rotation.gamma, 'YXZ');
  quaternion.setFromEuler(euler);
  quaternion.multiply(portraitFix);
  camera.quaternion.copy(quaternion);
  camera.position.copy(eye);
}

export function getCameraForward(camera: THREE.PerspectiveCamera): THREE.Vector3 {
  return camera.getWorldDirection(new THREE.Vector3());
}

/** Horizontal forward on the XZ plane from a device rotation snapshot. */
export function getHorizontalForwardFromRotation(
  rotation: DeviceRotation,
  referenceAlpha: number | null
): THREE.Vector3 {
  const alpha = referenceAlpha != null ? rotation.alpha - referenceAlpha : rotation.alpha;
  euler.set(rotation.beta, alpha, -rotation.gamma, 'YXZ');
  quaternion.setFromEuler(euler);
  quaternion.multiply(portraitFix);
  forward.set(0, 0, -1);
  forward.applyQuaternion(quaternion);
  forward.y = 0;
  if (forward.lengthSq() < 0.0001) {
    forward.set(0, 0, -1);
  } else {
    forward.normalize();
  }
  return forward.clone();
}

/** World position for a chest anchored `distance` meters ahead on the ground plane. */
export function getChestAnchorPosition(
  rotation: DeviceRotation,
  referenceAlpha: number | null,
  distance: number
): THREE.Vector3 {
  const ahead = getHorizontalForwardFromRotation(rotation, referenceAlpha);
  return new THREE.Vector3(ahead.x * distance, 0, ahead.z * distance);
}
