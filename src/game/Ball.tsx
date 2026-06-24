// ============================================
// BALL - Physics-enabled Ball Component
// ============================================
import { useRef, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, BallCollider } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { BALL_RADIUS, BALL_RESTITUTION, BALL_MASS, BALL_START_POS } from '../constants';

export interface BallHandle {
  getPosition: () => THREE.Vector3;
  getVelocity: () => THREE.Vector3;
  reset: () => void;
  getRigidBody: () => RapierRigidBody | null;
}

const Ball = forwardRef<BallHandle>((_props, ref) => {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Points>(null);
  const trailPositions = useRef<Float32Array>(new Float32Array(300)); // 100 points * 3
  const trailIndex = useRef(0);
  const frameCount = useRef(0);

  useImperativeHandle(ref, () => ({
    getPosition: () => {
      if (rigidBodyRef.current) {
        const pos = rigidBodyRef.current.translation();
        return new THREE.Vector3(pos.x, pos.y, pos.z);
      }
      return new THREE.Vector3(...BALL_START_POS);
    },
    getVelocity: () => {
      if (rigidBodyRef.current) {
        const vel = rigidBodyRef.current.linvel();
        return new THREE.Vector3(vel.x, vel.y, vel.z);
      }
      return new THREE.Vector3();
    },
    reset: () => {
      if (rigidBodyRef.current) {
        rigidBodyRef.current.setTranslation({ x: BALL_START_POS[0], y: BALL_START_POS[1], z: BALL_START_POS[2] }, true);
        rigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        rigidBodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
      trailPositions.current.fill(0);
      trailIndex.current = 0;
    },
    getRigidBody: () => rigidBodyRef.current,
  }));

  useFrame(() => {
    if (!rigidBodyRef.current || !meshRef.current) return;

    const pos = rigidBodyRef.current.translation();
    const rot = rigidBodyRef.current.rotation();

    meshRef.current.position.set(pos.x, pos.y, pos.z);
    meshRef.current.quaternion.set(rot.x, rot.y, rot.z, rot.w);

    // Update trail
    frameCount.current++;
    if (frameCount.current % 2 === 0 && trailRef.current) {
      const idx = (trailIndex.current % 100) * 3;
      trailPositions.current[idx] = pos.x;
      trailPositions.current[idx + 1] = pos.y;
      trailPositions.current[idx + 2] = pos.z;
      trailIndex.current++;

      const geometry = trailRef.current.geometry;
      geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <>
      <RigidBody
        ref={rigidBodyRef}
        position={BALL_START_POS}
        restitution={BALL_RESTITUTION}
        friction={0.3}
        mass={BALL_MASS}
        linearDamping={0.1}
        angularDamping={0.05}
        colliders={false}
        name="ball"
      >
        <BallCollider args={[BALL_RADIUS]} />
      </RigidBody>

      {/* Visual mesh (separate for smooth rendering) */}
      <mesh ref={meshRef} castShadow>
        <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
        <meshStandardMaterial
          color="#eeeeee"
          emissive="#ffffff"
          emissiveIntensity={0.15}
          metalness={0.1}
          roughness={0.4}
        />
      </mesh>

      {/* Ball glow */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[BALL_RADIUS * 1.15, 16, 16]} />
        <meshBasicMaterial color="#ffffff" opacity={0.15} transparent toneMapped={false} />
      </mesh>

      {/* Trail */}
      <points ref={trailRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[trailPositions.current, 3]}
            count={100}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial color="#ffcc00" size={0.2} opacity={0.4} transparent sizeAttenuation />
      </points>
    </>
  );
});

Ball.displayName = 'Ball';
export default Ball;
