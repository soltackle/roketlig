// ============================================
// BOOST PAD - Collectible Boost Pads
// ============================================
import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  BOOST_SMALL_AMOUNT, BOOST_LARGE_AMOUNT,
  BOOST_SMALL_RESPAWN_TIME, BOOST_LARGE_RESPAWN_TIME,
  LARGE_BOOST_POSITIONS, SMALL_BOOST_POSITIONS,
} from '../constants';
import type { CarHandle } from './Car';

interface BoostPadProps {
  position: [number, number, number];
  isLarge: boolean;
  carRefs: React.RefObject<CarHandle | null>[];
}

function BoostPad({ position, isLarge, carRefs }: BoostPadProps) {
  const [active, setActive] = useState(true);
  const respawnTimer = useRef(0);
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const radius = isLarge ? 2.5 : 1.2;
  const height = isLarge ? 1.5 : 0.6;

  useFrame((_, delta) => {
    // Respawn timer
    if (!active) {
      respawnTimer.current -= delta;
      if (respawnTimer.current <= 0) {
        setActive(true);
      }
      return;
    }

    // Animate glow
    if (glowRef.current) {
      glowRef.current.rotation.y += delta * 2;
      glowRef.current.scale.setScalar(1 + Math.sin(performance.now() * 0.003) * 0.15);
    }

    // Check collision with cars
    for (const carRef of carRefs) {
      if (!carRef.current) continue;
      if (carRef.current.isDemolished()) continue;

      const carPos = carRef.current.getPosition();
      const dx = carPos.x - position[0];
      const dz = carPos.z - position[2];
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < radius + 1.5 && carPos.y < height + 2) {
        const currentBoost = carRef.current.getBoost();
        if (currentBoost < 100) {
          const amount = isLarge ? BOOST_LARGE_AMOUNT : BOOST_SMALL_AMOUNT;
          carRef.current.setBoost(Math.min(100, currentBoost + amount));
          setActive(false);
          respawnTimer.current = isLarge ? BOOST_LARGE_RESPAWN_TIME : BOOST_SMALL_RESPAWN_TIME;
          break;
        }
      }
    }
  });

  if (!active) return null;

  return (
    <group position={position}>
      {/* Base pad */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius, isLarge ? 6 : 16]} />
        <meshStandardMaterial
          color={isLarge ? '#ffaa00' : '#ffdd44'}
          emissive={isLarge ? '#ff8800' : '#ffcc00'}
          emissiveIntensity={0.8}
          metalness={0.5}
          roughness={0.3}
        />
      </mesh>

      {/* Floating orb/glow */}
      <mesh ref={glowRef} position={[0, height, 0]}>
        <sphereGeometry args={[isLarge ? 0.8 : 0.3, 16, 16]} />
        <meshStandardMaterial
          color={isLarge ? '#ffcc00' : '#ffee88'}
          emissive={isLarge ? '#ffaa00' : '#ffdd44'}
          emissiveIntensity={1.5}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Light */}
      <pointLight
        position={[0, height, 0]}
        color={isLarge ? '#ffaa00' : '#ffdd44'}
        intensity={isLarge ? 2 : 0.5}
        distance={isLarge ? 8 : 4}
      />
    </group>
  );
}

interface BoostPadsProps {
  carRefs: React.RefObject<CarHandle | null>[];
}

export default function BoostPads({ carRefs }: BoostPadsProps) {
  return (
    <group>
      {LARGE_BOOST_POSITIONS.map((pos, i) => (
        <BoostPad key={`large-${i}`} position={pos} isLarge={true} carRefs={carRefs} />
      ))}
      {SMALL_BOOST_POSITIONS.map((pos, i) => (
        <BoostPad key={`small-${i}`} position={pos} isLarge={false} carRefs={carRefs} />
      ))}
    </group>
  );
}
