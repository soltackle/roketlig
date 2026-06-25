// ============================================
// CAMERA - Ball Cam / Car Cam System
// ============================================
import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../stores/gameStore';
import type { CarHandle } from './Car';
import type { BallHandle } from './Ball';
import { CAMERA_DISTANCE, CAMERA_HEIGHT, CAMERA_STIFFNESS } from '../constants';

interface GameCameraProps {
  carRef: React.RefObject<CarHandle | null>;
  ballRef: React.RefObject<BallHandle | null>;
}

export default function GameCamera({ carRef, ballRef }: GameCameraProps) {
  const { camera } = useThree();
  const ballCamEnabled = useGameStore((s) => s.ballCamEnabled);
  const currentPos = useRef(new THREE.Vector3(0, 10, 20));
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));

  const phase = useGameStore((s) => s.phase);

  useFrame((_, delta) => {
    // Apply Camera Shake
    const shake = useGameStore.getState().cameraShake;
    if (shake > 0) {
      useGameStore.getState().setCameraShake(Math.max(0, shake - delta * 10));
    }

    if (phase === 'menu') {
      const time = performance.now() * 0.0005;
      const targetPos = new THREE.Vector3(Math.sin(time) * 40, 20, Math.cos(time) * 40);
      const targetLook = new THREE.Vector3(0, 0, 0);
      currentPos.current.lerp(targetPos, delta * 2);
      currentLookAt.current.lerp(targetLook, delta * 2);
    } else {
      if (!carRef.current) return;

    const carPos = carRef.current.getPosition();
    const carRot = carRef.current.getRotation();

    if (carRef.current.isDemolished()) {
      // Follow ball when demolished
      if (ballRef.current) {
        const ballPos = ballRef.current.getPosition();
        const targetPos = new THREE.Vector3(ballPos.x + 15, 12, ballPos.z + 15);
        currentPos.current.lerp(targetPos, delta * 2);
        currentLookAt.current.lerp(ballPos, delta * 3);
      }
    } else if (ballCamEnabled && ballRef.current) {
      // Ball Cam: camera behind car, looking at ball
      const ballPos = ballRef.current.getPosition();

      // Direction from car to ball
      const carToBall = new THREE.Vector3().subVectors(ballPos, carPos).normalize();
      // Camera goes behind car (opposite of ball direction)
      const cameraOffset = carToBall.clone().negate().multiplyScalar(CAMERA_DISTANCE);
      cameraOffset.y = CAMERA_HEIGHT;

      const targetPos = new THREE.Vector3().addVectors(carPos, cameraOffset);
      // Keep camera above ground
      targetPos.y = Math.max(targetPos.y, 3);

      currentPos.current.lerp(targetPos, delta * CAMERA_STIFFNESS);
      currentLookAt.current.lerp(ballPos, delta * CAMERA_STIFFNESS * 1.5);
    } else {
      // Car Cam: camera behind car, looking forward
      const backward = new THREE.Vector3(0, 0, 1).applyQuaternion(carRot);
      const targetPos = new THREE.Vector3()
        .copy(carPos)
        .add(backward.multiplyScalar(CAMERA_DISTANCE))
        .add(new THREE.Vector3(0, CAMERA_HEIGHT, 0));

      // Keep camera above ground
      targetPos.y = Math.max(targetPos.y, 3);

      const lookTarget = carPos.clone().add(
        new THREE.Vector3(0, 0, -1).applyQuaternion(carRot).multiplyScalar(10)
      );
      lookTarget.y = carPos.y + 1;

      currentPos.current.lerp(targetPos, delta * CAMERA_STIFFNESS);
      currentLookAt.current.lerp(lookTarget, delta * CAMERA_STIFFNESS);
    }
    } // End of else block for phase !== menu

    // Apply shake offset
    const shakeOffset = new THREE.Vector3(
      (Math.random() - 0.5) * shake,
      (Math.random() - 0.5) * shake,
      (Math.random() - 0.5) * shake
    );

    camera.position.copy(currentPos.current).add(shakeOffset);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}
