// ============================================
// ARENA - 3D Stadium with Neon Cyberpunk Style
// ============================================
import { useFrame, extend } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Grid, Text, shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../stores/gameStore';
import {
  ARENA_WIDTH, ARENA_LENGTH, ARENA_HEIGHT, WALL_THICKNESS,
  GOAL_WIDTH, GOAL_HEIGHT, GOAL_DEPTH,
} from '../constants';

// --- Grass Shader ---
const GrassMaterial = shaderMaterial(
  { color1: new THREE.Color('#0a3010'), color2: new THREE.Color('#0d4015') },
  // vertex shader
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // fragment shader
  `
    uniform vec3 color1;
    uniform vec3 color2;
    varying vec2 vUv;
    void main() {
      float stripe = step(0.5, fract(vUv.y * 15.0));
      vec3 color = mix(color1, color2, stripe);
      gl_FragColor = vec4(color, 1.0);
    }
  `
);
extend({ GrassMaterial });

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
  const settings = useGameStore((s) => s.settings);
  const shadowRes = settings.graphicsQuality === 'high' ? 2048 : 512;

  return (
    <group>
      {/* Lights */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[100, 100, 50]}
        castShadow
        intensity={1}
        shadow-mapSize={[shadowRes, shadowRes]}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />
      
      {/* Stadium Spotlights */}
      <spotLight position={[-40, 60, -60]} angle={0.6} penumbra={0.8} intensity={2000} color="#e0f7fa" castShadow />
      <spotLight position={[40, 60, -60]} angle={0.6} penumbra={0.8} intensity={2000} color="#e0f7fa" castShadow />
      <spotLight position={[-40, 60, 60]} angle={0.6} penumbra={0.8} intensity={2000} color="#e0f7fa" castShadow />
      <spotLight position={[40, 60, 60]} angle={0.6} penumbra={0.8} intensity={2000} color="#e0f7fa" castShadow />

      {/* Floor */}
      <RigidBody type="fixed" colliders="cuboid" restitution={0.2} friction={0.5}>
        <mesh position={[0, -1, 0]} receiveShadow>
          <boxGeometry args={[ARENA_WIDTH, 2, ARENA_LENGTH]} />
          {/* @ts-ignore */}
          <grassMaterial />
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
        <gridHelper args={[ARENA_LENGTH, 20, "#0088ff", "#002244"]} position={[-ARENA_WIDTH / 2, WALL_HEIGHT / 2, 0]} rotation={[0, 0, Math.PI / 2]} />
        
        {/* Right Wall */}
        <mesh position={[ARENA_WIDTH / 2 + WALL_THICKNESS / 2, WALL_HEIGHT / 2, 0]} material={wallMaterial}>
          <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, ARENA_LENGTH]} />
        </mesh>
        <gridHelper args={[ARENA_LENGTH, 20, "#ff8800", "#442200"]} position={[ARENA_WIDTH / 2, WALL_HEIGHT / 2, 0]} rotation={[0, 0, Math.PI / 2]} />

        {/* Top Wall (Ceiling) */}
        <mesh position={[0, ARENA_HEIGHT + WALL_THICKNESS / 2, 0]} material={wallMaterial}>
          <boxGeometry args={[ARENA_WIDTH + WALL_THICKNESS * 2, WALL_THICKNESS, ARENA_LENGTH + WALL_THICKNESS * 2]} />
        </mesh>
        <gridHelper args={[Math.max(ARENA_WIDTH, ARENA_LENGTH), 30, "#ffffff", "#222222"]} position={[0, ARENA_HEIGHT, 0]} />
        
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
        {/* Neon Light Tubes */}
        <mesh position={[0, GOAL_HEIGHT, 0]}>
          <boxGeometry args={[GOAL_WIDTH + 0.4, 0.4, 0.4]} />
          <meshBasicMaterial color="#00ffff" />
        </mesh>
        <mesh position={[-GOAL_WIDTH / 2, GOAL_HEIGHT / 2, 0]}>
          <boxGeometry args={[0.4, GOAL_HEIGHT, 0.4]} />
          <meshBasicMaterial color="#00ffff" />
        </mesh>
        <mesh position={[GOAL_WIDTH / 2, GOAL_HEIGHT / 2, 0]}>
          <boxGeometry args={[0.4, GOAL_HEIGHT, 0.4]} />
          <meshBasicMaterial color="#00ffff" />
        </mesh>
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
        <pointLight position={[0, GOAL_HEIGHT/2, GOAL_DEPTH/2]} color="#ff8800" intensity={2} distance={20} />
        {/* Neon Light Tubes */}
        <mesh position={[0, GOAL_HEIGHT, 0]}>
          <boxGeometry args={[GOAL_WIDTH + 0.4, 0.4, 0.4]} />
          <meshBasicMaterial color="#ffcc00" />
        </mesh>
        <mesh position={[-GOAL_WIDTH / 2, GOAL_HEIGHT / 2, 0]}>
          <boxGeometry args={[0.4, GOAL_HEIGHT, 0.4]} />
          <meshBasicMaterial color="#ffcc00" />
        </mesh>
        <mesh position={[GOAL_WIDTH / 2, GOAL_HEIGHT / 2, 0]}>
          <boxGeometry args={[0.4, GOAL_HEIGHT, 0.4]} />
          <meshBasicMaterial color="#ffcc00" />
        </mesh>
      </group>

      {/* Holographic Scoreboard */}
      <HolographicScoreboard />
    </group>
  );
}

function HolographicScoreboard() {
  const blueScore = useGameStore((s) => s.blueScore);
  const orangeScore = useGameStore((s) => s.orangeScore);
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const isOvertime = useGameStore((s) => s.isOvertime);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <group position={[0, ARENA_HEIGHT - 5, 0]}>
      {/* Front facing */}
      <group position={[0, 0, 0]}>
        <Text position={[-8, 0, 0]} fontSize={8} color="#0088ff" anchorX="center" anchorY="middle" material-toneMapped={false}>
          {blueScore}
        </Text>
        <Text position={[0, 0, 0]} fontSize={4} color="#ffffff" anchorX="center" anchorY="middle" material-toneMapped={false}>
          {isOvertime ? 'OT' : formatTime(timeRemaining)}
        </Text>
        <Text position={[8, 0, 0]} fontSize={8} color="#ff8800" anchorX="center" anchorY="middle" material-toneMapped={false}>
          {orangeScore}
        </Text>
      </group>
      
      {/* Back facing (so both sides can read it) */}
      <group position={[0, 0, 0]} rotation={[0, Math.PI, 0]}>
        <Text position={[8, 0, 0]} fontSize={8} color="#0088ff" anchorX="center" anchorY="middle" material-toneMapped={false}>
          {blueScore}
        </Text>
        <Text position={[0, 0, 0]} fontSize={4} color="#ffffff" anchorX="center" anchorY="middle" material-toneMapped={false}>
          {isOvertime ? 'OT' : formatTime(timeRemaining)}
        </Text>
        <Text position={[-8, 0, 0]} fontSize={8} color="#ff8800" anchorX="center" anchorY="middle" material-toneMapped={false}>
          {orangeScore}
        </Text>
      </group>
    </group>
  );
}
