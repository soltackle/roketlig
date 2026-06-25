// ============================================
// BALL - Physics-enabled Ball Component
// ============================================
import { useRef, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, BallCollider } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { BALL_RADIUS, BALL_RESTITUTION, BALL_MASS, BALL_START_POS } from '../constants';
import { audioManager } from '../audio/AudioManager';
import { useGameStore } from '../stores/gameStore';

export interface BallHandle {
  getPosition: () => THREE.Vector3;
  getVelocity: () => THREE.Vector3;
  reset: () => void;
  getRigidBody: () => RapierRigidBody | null;
}

const Ball = forwardRef<BallHandle>((_props, ref) => {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.Points>(null);
  const indicatorRef = useRef<THREE.Mesh>(null);
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
    const vel = rigidBodyRef.current.linvel();
    const angvel = rigidBodyRef.current.angvel();

    // Magnus Effect (Curve ball based on spin)
    const v = new THREE.Vector3(vel.x, vel.y, vel.z);
    const w = new THREE.Vector3(angvel.x, angvel.y, angvel.z);
    const magnusForce = new THREE.Vector3().crossVectors(w, v).multiplyScalar(0.002);
    rigidBodyRef.current.applyImpulse({ x: magnusForce.x, y: magnusForce.y, z: magnusForce.z }, true);

    // Enforce ball max speed
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
    if (speed > 80) {
      const factor = 80 / speed;
      rigidBodyRef.current.setLinvel({ x: vel.x * factor, y: vel.y * factor, z: vel.z * factor }, true);
    }

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

    // Update ground indicator
    if (indicatorRef.current) {
      indicatorRef.current.position.set(pos.x, 0.1, pos.z);
      // Fade out if ball is very high
      const opacity = Math.max(0, 0.6 - (pos.y / 30));
      (indicatorRef.current.material as THREE.MeshBasicMaterial).opacity = opacity;
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
        onCollisionEnter={({ other }) => {
          if (other.rigidBodyObject?.name?.startsWith('car-')) {
            audioManager.playHit(50);
            useGameStore.getState().addCameraShake(0.5); // Small shake on ball hit
          } else if (other.rigidBodyObject?.name === 'ground' || other.rigidBodyObject?.name === 'wall') {
             // Play a softer bounce sound (already handled in AudioManager? No, let's play generic hit but quieter)
            audioManager.playHit(20);
          }
        }}
      >
        <BallCollider args={[BALL_RADIUS]} />
      </RigidBody>

      {/* Visual mesh (separate for smooth rendering) */}
      <group ref={meshRef}>
        {/* Main Ball Body */}
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
          <meshStandardMaterial
            color="#ffffff"
            metalness={0.8}
            roughness={0.2}
            emissive="#111111"
          />
        </mesh>
        
        {/* Holographic Wireframe Shell */}
        <mesh>
          <sphereGeometry args={[BALL_RADIUS + 0.05, 16, 16]} />
          <meshBasicMaterial
            color="#00ffff"
            wireframe={true}
            transparent={true}
            opacity={0.3}
          />
        </mesh>
        {/* Ball glow */}
        <mesh>
          <sphereGeometry args={[BALL_RADIUS + 0.2, 32, 32]} />
          <meshBasicMaterial
            color="#00ffff"
            transparent
            opacity={0.15}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

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

      {/* Ball Ground Indicator */}
      <mesh ref={indicatorRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[BALL_RADIUS * 0.8, BALL_RADIUS, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </>
  );
});

Ball.displayName = 'Ball';
export default Ball;
