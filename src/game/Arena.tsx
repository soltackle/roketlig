// ============================================
// ARENA - 3D Stadium with Walls, Floor, Ceiling, Goals
// ============================================
import { useRef } from 'react';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import {
  ARENA_WIDTH, ARENA_LENGTH, ARENA_HEIGHT, WALL_THICKNESS,
  GOAL_WIDTH, GOAL_HEIGHT, GOAL_DEPTH,
} from '../constants';

function FieldMarkings() {
  return (
    <group position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Center circle */}
      <mesh>
        <ringGeometry args={[9.5, 10, 64]} />
        <meshStandardMaterial color="#ffffff" opacity={0.4} transparent />
      </mesh>
      {/* Center line */}
      <mesh>
        <planeGeometry args={[ARENA_WIDTH - 2, 0.3]} />
        <meshStandardMaterial color="#ffffff" opacity={0.4} transparent />
      </mesh>
      {/* Center dot */}
      <mesh>
        <circleGeometry args={[0.5, 32]} />
        <meshStandardMaterial color="#ffffff" opacity={0.5} transparent />
      </mesh>
    </group>
  );
}

function GoalStructure({ position, team }: { position: [number, number, number]; team: 'blue' | 'orange' }) {
  const color = team === 'blue' ? '#1565C0' : '#E65100';
  const emissiveColor = team === 'blue' ? '#2196F3' : '#FF6D00';

  return (
    <group position={position}>
      {/* Goal frame - top bar */}
      <mesh position={[0, GOAL_HEIGHT, 0]}>
        <boxGeometry args={[GOAL_WIDTH + 1, 0.5, 0.5]} />
        <meshStandardMaterial color={color} emissive={emissiveColor} emissiveIntensity={0.3} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Goal frame - left post */}
      <mesh position={[-GOAL_WIDTH / 2 - 0.25, GOAL_HEIGHT / 2, 0]}>
        <boxGeometry args={[0.5, GOAL_HEIGHT, 0.5]} />
        <meshStandardMaterial color={color} emissive={emissiveColor} emissiveIntensity={0.3} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Goal frame - right post */}
      <mesh position={[GOAL_WIDTH / 2 + 0.25, GOAL_HEIGHT / 2, 0]}>
        <boxGeometry args={[0.5, GOAL_HEIGHT, 0.5]} />
        <meshStandardMaterial color={color} emissive={emissiveColor} emissiveIntensity={0.3} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Goal net (back wall visual) */}
      <mesh position={[0, GOAL_HEIGHT / 2, team === 'blue' ? -GOAL_DEPTH / 2 : GOAL_DEPTH / 2]}>
        <boxGeometry args={[GOAL_WIDTH, GOAL_HEIGHT, 0.1]} />
        <meshStandardMaterial color={color} opacity={0.3} transparent wireframe />
      </mesh>
      {/* Goal floor glow */}
      <mesh position={[0, 0.03, team === 'blue' ? -GOAL_DEPTH / 2 : GOAL_DEPTH / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GOAL_WIDTH, GOAL_DEPTH]} />
        <meshStandardMaterial color={emissiveColor} emissive={emissiveColor} emissiveIntensity={0.5} opacity={0.3} transparent />
      </mesh>
    </group>
  );
}

export default function Arena() {
  const halfW = ARENA_WIDTH / 2;
  const halfL = ARENA_LENGTH / 2;
  const halfH = ARENA_HEIGHT / 2;
  const t = WALL_THICKNESS;

  return (
    <group>
      {/* ===== FLOOR ===== */}
      <RigidBody type="fixed" friction={0.8} restitution={0.3}>
        <CuboidCollider args={[halfW, 0.5, halfL]} position={[0, -0.5, 0]} />
      </RigidBody>
      {/* Floor visual */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ARENA_WIDTH, ARENA_LENGTH]} />
        <meshStandardMaterial color="#1a472a" metalness={0.1} roughness={0.8} />
      </mesh>

      {/* ===== CEILING ===== */}
      <RigidBody type="fixed" restitution={0.5}>
        <CuboidCollider args={[halfW, 0.5, halfL]} position={[0, ARENA_HEIGHT + 0.5, 0]} />
      </RigidBody>
      {/* Ceiling visual */}
      <mesh position={[0, ARENA_HEIGHT, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ARENA_WIDTH, ARENA_LENGTH]} />
        <meshStandardMaterial color="#0a0a1a" opacity={0.6} transparent metalness={0.5} roughness={0.3} />
      </mesh>

      {/* ===== LEFT WALL ===== */}
      <RigidBody type="fixed" restitution={0.4}>
        <CuboidCollider args={[t / 2, halfH, halfL]} position={[-halfW - t / 2, halfH, 0]} />
      </RigidBody>
      <mesh position={[-halfW, halfH, 0]}>
        <boxGeometry args={[0.2, ARENA_HEIGHT, ARENA_LENGTH]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.4} roughness={0.5} opacity={0.8} transparent />
      </mesh>

      {/* ===== RIGHT WALL ===== */}
      <RigidBody type="fixed" restitution={0.4}>
        <CuboidCollider args={[t / 2, halfH, halfL]} position={[halfW + t / 2, halfH, 0]} />
      </RigidBody>
      <mesh position={[halfW, halfH, 0]}>
        <boxGeometry args={[0.2, ARENA_HEIGHT, ARENA_LENGTH]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.4} roughness={0.5} opacity={0.8} transparent />
      </mesh>

      {/* ===== BACK WALL (Blue side - Z negative) ===== */}
      {/* Left section (left of goal) */}
      <RigidBody type="fixed" restitution={0.4}>
        <CuboidCollider
          args={[(halfW - GOAL_WIDTH / 2) / 2, halfH, t / 2]}
          position={[-(halfW + GOAL_WIDTH / 2) / 2, halfH, -halfL - t / 2]}
        />
      </RigidBody>
      <mesh position={[-(halfW + GOAL_WIDTH / 2) / 2, halfH, -halfL]}>
        <boxGeometry args={[halfW - GOAL_WIDTH / 2, ARENA_HEIGHT, 0.2]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.4} roughness={0.5} opacity={0.8} transparent />
      </mesh>

      {/* Right section (right of goal) */}
      <RigidBody type="fixed" restitution={0.4}>
        <CuboidCollider
          args={[(halfW - GOAL_WIDTH / 2) / 2, halfH, t / 2]}
          position={[(halfW + GOAL_WIDTH / 2) / 2, halfH, -halfL - t / 2]}
        />
      </RigidBody>
      <mesh position={[(halfW + GOAL_WIDTH / 2) / 2, halfH, -halfL]}>
        <boxGeometry args={[halfW - GOAL_WIDTH / 2, ARENA_HEIGHT, 0.2]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.4} roughness={0.5} opacity={0.8} transparent />
      </mesh>

      {/* Top section (above goal) */}
      <RigidBody type="fixed" restitution={0.4}>
        <CuboidCollider
          args={[GOAL_WIDTH / 2, (ARENA_HEIGHT - GOAL_HEIGHT) / 2, t / 2]}
          position={[0, GOAL_HEIGHT + (ARENA_HEIGHT - GOAL_HEIGHT) / 2, -halfL - t / 2]}
        />
      </RigidBody>
      <mesh position={[0, GOAL_HEIGHT + (ARENA_HEIGHT - GOAL_HEIGHT) / 2, -halfL]}>
        <boxGeometry args={[GOAL_WIDTH, ARENA_HEIGHT - GOAL_HEIGHT, 0.2]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.4} roughness={0.5} opacity={0.8} transparent />
      </mesh>

      {/* ===== FRONT WALL (Orange side - Z positive) ===== */}
      {/* Left section */}
      <RigidBody type="fixed" restitution={0.4}>
        <CuboidCollider
          args={[(halfW - GOAL_WIDTH / 2) / 2, halfH, t / 2]}
          position={[-(halfW + GOAL_WIDTH / 2) / 2, halfH, halfL + t / 2]}
        />
      </RigidBody>
      <mesh position={[-(halfW + GOAL_WIDTH / 2) / 2, halfH, halfL]}>
        <boxGeometry args={[halfW - GOAL_WIDTH / 2, ARENA_HEIGHT, 0.2]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.4} roughness={0.5} opacity={0.8} transparent />
      </mesh>

      {/* Right section */}
      <RigidBody type="fixed" restitution={0.4}>
        <CuboidCollider
          args={[(halfW - GOAL_WIDTH / 2) / 2, halfH, t / 2]}
          position={[(halfW + GOAL_WIDTH / 2) / 2, halfH, halfL + t / 2]}
        />
      </RigidBody>
      <mesh position={[(halfW + GOAL_WIDTH / 2) / 2, halfH, halfL]}>
        <boxGeometry args={[halfW - GOAL_WIDTH / 2, ARENA_HEIGHT, 0.2]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.4} roughness={0.5} opacity={0.8} transparent />
      </mesh>

      {/* Top section (above goal) */}
      <RigidBody type="fixed" restitution={0.4}>
        <CuboidCollider
          args={[GOAL_WIDTH / 2, (ARENA_HEIGHT - GOAL_HEIGHT) / 2, t / 2]}
          position={[0, GOAL_HEIGHT + (ARENA_HEIGHT - GOAL_HEIGHT) / 2, halfL + t / 2]}
        />
      </RigidBody>
      <mesh position={[0, GOAL_HEIGHT + (ARENA_HEIGHT - GOAL_HEIGHT) / 2, halfL]}>
        <boxGeometry args={[GOAL_WIDTH, ARENA_HEIGHT - GOAL_HEIGHT, 0.2]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.4} roughness={0.5} opacity={0.8} transparent />
      </mesh>

      {/* ===== GOAL BACK WALLS (inside goal) ===== */}
      {/* Blue goal back wall */}
      <RigidBody type="fixed" restitution={0.3}>
        <CuboidCollider args={[GOAL_WIDTH / 2, GOAL_HEIGHT / 2, t / 2]} position={[0, GOAL_HEIGHT / 2, -halfL - GOAL_DEPTH]} />
      </RigidBody>
      {/* Blue goal side walls */}
      <RigidBody type="fixed" restitution={0.3}>
        <CuboidCollider args={[t / 2, GOAL_HEIGHT / 2, GOAL_DEPTH / 2]} position={[-GOAL_WIDTH / 2, GOAL_HEIGHT / 2, -halfL - GOAL_DEPTH / 2]} />
      </RigidBody>
      <RigidBody type="fixed" restitution={0.3}>
        <CuboidCollider args={[t / 2, GOAL_HEIGHT / 2, GOAL_DEPTH / 2]} position={[GOAL_WIDTH / 2, GOAL_HEIGHT / 2, -halfL - GOAL_DEPTH / 2]} />
      </RigidBody>
      {/* Blue goal ceiling */}
      <RigidBody type="fixed" restitution={0.3}>
        <CuboidCollider args={[GOAL_WIDTH / 2, t / 2, GOAL_DEPTH / 2]} position={[0, GOAL_HEIGHT, -halfL - GOAL_DEPTH / 2]} />
      </RigidBody>

      {/* Orange goal back wall */}
      <RigidBody type="fixed" restitution={0.3}>
        <CuboidCollider args={[GOAL_WIDTH / 2, GOAL_HEIGHT / 2, t / 2]} position={[0, GOAL_HEIGHT / 2, halfL + GOAL_DEPTH]} />
      </RigidBody>
      {/* Orange goal side walls */}
      <RigidBody type="fixed" restitution={0.3}>
        <CuboidCollider args={[t / 2, GOAL_HEIGHT / 2, GOAL_DEPTH / 2]} position={[-GOAL_WIDTH / 2, GOAL_HEIGHT / 2, halfL + GOAL_DEPTH / 2]} />
      </RigidBody>
      <RigidBody type="fixed" restitution={0.3}>
        <CuboidCollider args={[t / 2, GOAL_HEIGHT / 2, GOAL_DEPTH / 2]} position={[GOAL_WIDTH / 2, GOAL_HEIGHT / 2, halfL + GOAL_DEPTH / 2]} />
      </RigidBody>
      {/* Orange goal ceiling */}
      <RigidBody type="fixed" restitution={0.3}>
        <CuboidCollider args={[GOAL_WIDTH / 2, t / 2, GOAL_DEPTH / 2]} position={[0, GOAL_HEIGHT, halfL + GOAL_DEPTH / 2]} />
      </RigidBody>

      {/* ===== GOAL VISUALS ===== */}
      <GoalStructure position={[0, 0, -halfL]} team="blue" />
      <GoalStructure position={[0, 0, halfL]} team="orange" />

      {/* ===== FIELD MARKINGS ===== */}
      <FieldMarkings />

      {/* ===== ARENA LIGHTS ===== */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[20, ARENA_HEIGHT + 10, 0]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={200}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
      />
      <pointLight position={[0, ARENA_HEIGHT - 2, -30]} intensity={0.8} color="#4488ff" distance={60} />
      <pointLight position={[0, ARENA_HEIGHT - 2, 30]} intensity={0.8} color="#ff8844" distance={60} />
      <pointLight position={[0, ARENA_HEIGHT - 2, 0]} intensity={0.6} color="#ffffff" distance={80} />

      {/* Corner ramp colliders (simplified 45° ramps) */}
      {/* Bottom-left corner (blue side) */}
      <RigidBody type="fixed" restitution={0.4}>
        <CuboidCollider
          args={[4, halfH, 4]}
          position={[-halfW + 2, halfH, -halfL + 2]}
          rotation={[0, Math.PI / 4, 0]}
        />
      </RigidBody>
      {/* Bottom-right corner (blue side) */}
      <RigidBody type="fixed" restitution={0.4}>
        <CuboidCollider
          args={[4, halfH, 4]}
          position={[halfW - 2, halfH, -halfL + 2]}
          rotation={[0, -Math.PI / 4, 0]}
        />
      </RigidBody>
      {/* Top-left corner (orange side) */}
      <RigidBody type="fixed" restitution={0.4}>
        <CuboidCollider
          args={[4, halfH, 4]}
          position={[-halfW + 2, halfH, halfL - 2]}
          rotation={[0, -Math.PI / 4, 0]}
        />
      </RigidBody>
      {/* Top-right corner (orange side) */}
      <RigidBody type="fixed" restitution={0.4}>
        <CuboidCollider
          args={[4, halfH, 4]}
          position={[halfW - 2, halfH, halfL - 2]}
          rotation={[0, Math.PI / 4, 0]}
        />
      </RigidBody>
    </group>
  );
}
