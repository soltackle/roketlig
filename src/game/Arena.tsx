// ============================================
// ARENA - 3D Stadium with Neon Cyberpunk Style
// ============================================
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { Grid } from '@react-three/drei';
import * as THREE from 'three';
import {
  ARENA_WIDTH, ARENA_LENGTH, ARENA_HEIGHT, WALL_THICKNESS,
  GOAL_WIDTH, GOAL_HEIGHT, GOAL_DEPTH,
} from '../constants';

const WALL_HEIGHT = 15;

// Custom neon materials
const floorMaterial = new THREE.MeshStandardMaterial({
  color: '#050510',
  roughness: 0.1,
  metalness: 0.8,
});

const wallMaterial = new THREE.MeshStandardMaterial({
  color: '#0a0a2a',
  roughness: 0.4,
  metalness: 0.8,
  transparent: true,
  opacity: 0.7,
});

const blueGoalMaterial = new THREE.MeshStandardMaterial({
  color: '#000000',
  emissive: '#0088ff',
  emissiveIntensity: 2,
  toneMapped: false,
});

const orangeGoalMaterial = new THREE.MeshStandardMaterial({
  color: '#000000',
  emissive: '#ff4400',
  emissiveIntensity: 2,
  toneMapped: false,
});

export default function Arena() {
  return (
    <group>
      {/* Lights */}
      <ambientLight intensity={0.2} />
      <directionalLight position={[10, 50, 10]} intensity={1.5} castShadow />
      <pointLight position={[0, 20, 0]} intensity={1} distance={100} color="#ffffff" />
      
      {/* Floor */}
      <RigidBody type="fixed" colliders="cuboid" restitution={0.2} friction={0.5}>
        <mesh position={[0, -1, 0]} receiveShadow material={floorMaterial}>
          <boxGeometry args={[ARENA_WIDTH, 2, ARENA_LENGTH]} />
        </mesh>
      </RigidBody>

      {/* Grid Helper over floor */}
      <Grid 
        position={[0, 0.01, 0]} 
        args={[ARENA_WIDTH, ARENA_LENGTH]} 
        cellSize={2} 
        cellThickness={1} 
        cellColor="#00ccff" 
        sectionSize={10} 
        sectionThickness={1.5} 
        sectionColor="#2196F3" 
        fadeDistance={80} 
        fadeStrength={1} 
      />

      {/* Center circle */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[9.5, 10, 64]} />
        <meshBasicMaterial color="#00ccff" transparent opacity={0.6} toneMapped={false} />
      </mesh>
      {/* Center line */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ARENA_WIDTH - 2, 0.3]} />
        <meshBasicMaterial color="#00ccff" transparent opacity={0.6} toneMapped={false} />
      </mesh>

      {/* Walls */}
      <RigidBody type="fixed" restitution={0.3} friction={0.1}>
        {/* Left Wall */}
        <mesh position={[-ARENA_WIDTH / 2 - WALL_THICKNESS / 2, WALL_HEIGHT / 2, 0]} material={wallMaterial}>
          <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, ARENA_LENGTH]} />
        </mesh>
        {/* Right Wall */}
        <mesh position={[ARENA_WIDTH / 2 + WALL_THICKNESS / 2, WALL_HEIGHT / 2, 0]} material={wallMaterial}>
          <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, ARENA_LENGTH]} />
        </mesh>
        {/* Top Wall (Ceiling) */}
        <mesh position={[0, ARENA_HEIGHT + WALL_THICKNESS / 2, 0]} material={wallMaterial}>
          <boxGeometry args={[ARENA_WIDTH + WALL_THICKNESS * 2, WALL_THICKNESS, ARENA_LENGTH + WALL_THICKNESS * 2]} />
        </mesh>
        
        {/* Back Wall (Blue Side) */}
        <CuboidCollider args={[ARENA_WIDTH / 2, WALL_HEIGHT / 2, WALL_THICKNESS / 2]} position={[0, WALL_HEIGHT / 2, -ARENA_LENGTH / 2 - WALL_THICKNESS / 2]} />
        {/* Front Wall (Orange Side) */}
        <CuboidCollider args={[ARENA_WIDTH / 2, WALL_HEIGHT / 2, WALL_THICKNESS / 2]} position={[0, WALL_HEIGHT / 2, ARENA_LENGTH / 2 + WALL_THICKNESS / 2]} />
      </RigidBody>

      {/* Visual Walls for Back/Front (with holes for goals) */}
      {/* Blue Side */}
      <group position={[0, 0, -ARENA_LENGTH / 2 - WALL_THICKNESS / 2]}>
        <mesh position={[-ARENA_WIDTH / 4 - GOAL_WIDTH / 4, WALL_HEIGHT / 2, 0]} material={wallMaterial}>
          <boxGeometry args={[ARENA_WIDTH / 2 - GOAL_WIDTH / 2, WALL_HEIGHT, WALL_THICKNESS]} />
        </mesh>
        <mesh position={[ARENA_WIDTH / 4 + GOAL_WIDTH / 4, WALL_HEIGHT / 2, 0]} material={wallMaterial}>
          <boxGeometry args={[ARENA_WIDTH / 2 - GOAL_WIDTH / 2, WALL_HEIGHT, WALL_THICKNESS]} />
        </mesh>
        <mesh position={[0, WALL_HEIGHT / 2 + GOAL_HEIGHT / 2, 0]} material={wallMaterial}>
          <boxGeometry args={[GOAL_WIDTH, WALL_HEIGHT - GOAL_HEIGHT, WALL_THICKNESS]} />
        </mesh>
      </group>

      {/* Orange Side */}
      <group position={[0, 0, ARENA_LENGTH / 2 + WALL_THICKNESS / 2]}>
        <mesh position={[-ARENA_WIDTH / 4 - GOAL_WIDTH / 4, WALL_HEIGHT / 2, 0]} material={wallMaterial}>
          <boxGeometry args={[ARENA_WIDTH / 2 - GOAL_WIDTH / 2, WALL_HEIGHT, WALL_THICKNESS]} />
        </mesh>
        <mesh position={[ARENA_WIDTH / 4 + GOAL_WIDTH / 4, WALL_HEIGHT / 2, 0]} material={wallMaterial}>
          <boxGeometry args={[ARENA_WIDTH / 2 - GOAL_WIDTH / 2, WALL_HEIGHT, WALL_THICKNESS]} />
        </mesh>
        <mesh position={[0, WALL_HEIGHT / 2 + GOAL_HEIGHT / 2, 0]} material={wallMaterial}>
          <boxGeometry args={[GOAL_WIDTH, WALL_HEIGHT - GOAL_HEIGHT, WALL_THICKNESS]} />
        </mesh>
      </group>

      {/* Blue Goal */}
      <group position={[0, 0, -ARENA_LENGTH / 2]}>
        <RigidBody type="fixed" colliders="cuboid">
          {/* Back */}
          <mesh position={[0, GOAL_HEIGHT / 2, -GOAL_DEPTH]} material={blueGoalMaterial}>
            <boxGeometry args={[GOAL_WIDTH, GOAL_HEIGHT, 0.5]} />
          </mesh>
          {/* Left */}
          <mesh position={[-GOAL_WIDTH / 2, GOAL_HEIGHT / 2, -GOAL_DEPTH / 2]} material={blueGoalMaterial}>
            <boxGeometry args={[0.5, GOAL_HEIGHT, GOAL_DEPTH]} />
          </mesh>
          {/* Right */}
          <mesh position={[GOAL_WIDTH / 2, GOAL_HEIGHT / 2, -GOAL_DEPTH / 2]} material={blueGoalMaterial}>
            <boxGeometry args={[0.5, GOAL_HEIGHT, GOAL_DEPTH]} />
          </mesh>
          {/* Top */}
          <mesh position={[0, GOAL_HEIGHT, -GOAL_DEPTH / 2]} material={blueGoalMaterial}>
            <boxGeometry args={[GOAL_WIDTH, 0.5, GOAL_DEPTH]} />
          </mesh>
        </RigidBody>
        <pointLight position={[0, GOAL_HEIGHT/2, -GOAL_DEPTH/2]} color="#0088ff" intensity={2} distance={20} />
      </group>

      {/* Orange Goal */}
      <group position={[0, 0, ARENA_LENGTH / 2]}>
        <RigidBody type="fixed" colliders="cuboid">
          {/* Back */}
          <mesh position={[0, GOAL_HEIGHT / 2, GOAL_DEPTH]} material={orangeGoalMaterial}>
            <boxGeometry args={[GOAL_WIDTH, GOAL_HEIGHT, 0.5]} />
          </mesh>
          {/* Left */}
          <mesh position={[-GOAL_WIDTH / 2, GOAL_HEIGHT / 2, GOAL_DEPTH / 2]} material={orangeGoalMaterial}>
            <boxGeometry args={[0.5, GOAL_HEIGHT, GOAL_DEPTH]} />
          </mesh>
          {/* Right */}
          <mesh position={[GOAL_WIDTH / 2, GOAL_HEIGHT / 2, GOAL_DEPTH / 2]} material={orangeGoalMaterial}>
            <boxGeometry args={[0.5, GOAL_HEIGHT, GOAL_DEPTH]} />
          </mesh>
          {/* Top */}
          <mesh position={[0, GOAL_HEIGHT, GOAL_DEPTH / 2]} material={orangeGoalMaterial}>
            <boxGeometry args={[GOAL_WIDTH, 0.5, GOAL_DEPTH]} />
          </mesh>
        </RigidBody>
        <pointLight position={[0, GOAL_HEIGHT/2, GOAL_DEPTH/2]} color="#ff4400" intensity={2} distance={20} />
      </group>
    </group>
  );
}
