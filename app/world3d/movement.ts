import * as THREE from "three";

export type MovementBounds = {
  maxX: number;
  maxZ: number;
  minX: number;
  minZ: number;
};

export type WorldCollider = {
  maxX: number;
  maxZ: number;
  minX: number;
  minZ: number;
};

function overlapsCollider(
  x: number,
  z: number,
  radius: number,
  collider: WorldCollider,
) {
  return (
    x + radius > collider.minX &&
    x - radius < collider.maxX &&
    z + radius > collider.minZ &&
    z - radius < collider.maxZ
  );
}

export function moveWithCollisions(
  position: THREE.Vector3,
  movement: THREE.Vector3,
  bounds: MovementBounds,
  colliders: readonly WorldCollider[],
  radius = 0.46,
) {
  const nextX = THREE.MathUtils.clamp(
    position.x + movement.x,
    bounds.minX,
    bounds.maxX,
  );

  if (!colliders.some((collider) => overlapsCollider(nextX, position.z, radius, collider))) {
    position.x = nextX;
  }

  const nextZ = THREE.MathUtils.clamp(
    position.z + movement.z,
    bounds.minZ,
    bounds.maxZ,
  );

  if (!colliders.some((collider) => overlapsCollider(position.x, nextZ, radius, collider))) {
    position.z = nextZ;
  }
}

export function updateCharacterMotion(
  visual: THREE.Group,
  elapsedTime: number,
  speed: number,
  delta: number,
) {
  const movementAmount = THREE.MathUtils.clamp(speed / 5.3, 0, 1.4);
  const walking = movementAmount > 0.04;
  const walkPhase = elapsedTime * (8 + movementAmount * 2);
  const targetY = walking ? Math.abs(Math.sin(walkPhase)) * 0.085 * movementAmount : 0;
  const targetTilt = walking ? Math.sin(walkPhase) * 0.025 * movementAmount : 0;
  const idleScale = walking ? 1 : 1 + Math.sin(elapsedTime * 2.1) * 0.008;
  const smoothing = 1 - Math.exp(-delta * 12);

  visual.position.y = THREE.MathUtils.lerp(visual.position.y, targetY, smoothing);
  visual.rotation.z = THREE.MathUtils.lerp(visual.rotation.z, targetTilt, smoothing);
  visual.scale.y = THREE.MathUtils.lerp(visual.scale.y, idleScale, smoothing * 0.65);
}
