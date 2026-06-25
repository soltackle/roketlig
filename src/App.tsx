import { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';
import { Environment } from '@react-three/drei';
import { useGameStore } from './stores/gameStore';
import { useInputManager } from './input/useInputManager';

import Arena from './game/Arena';
import Ball, { type BallHandle } from './game/Ball';
import Car, { type CarHandle } from './game/Car';
import BoostPads from './game/BoostPads';
import GameCamera from './game/GameCamera';
import GameManager from './game/GameManager';

import MainMenu from './ui/MainMenu';
import HUD from './ui/HUD';
import Scoreboard from './ui/Scoreboard';

import { KICKOFF_SPAWNS, GRAVITY } from './constants';

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <div className="loading-text">YÜKLENIYOR...</div>
    </div>
  );
}

function GameScene() {
  const playerCarRef = useRef<CarHandle>(null);
  const botCarRef = useRef<CarHandle>(null);
  const ballRef = useRef<BallHandle>(null);
  const phase = useGameStore((s) => s.phase);

  // If we want a 3D main menu, we should always render the game scene
  // The camera will handle the 'menu' phase by panning around!

  const carRefs = [playerCarRef, botCarRef];

  return (
    <Physics gravity={GRAVITY} timeStep={1/60} paused={phase === 'paused' || phase === 'menu'}>
      <Arena />
      <Ball ref={ballRef} />
      <Car
        ref={playerCarRef}
        team="blue"
        startPosition={KICKOFF_SPAWNS[0].blue as [number, number, number]}
        startRotationY={KICKOFF_SPAWNS[0].blueRot}
        name="Player"
      />
      <Car
        ref={botCarRef}
        team="orange"
        startPosition={KICKOFF_SPAWNS[0].orange as [number, number, number]}
        startRotationY={KICKOFF_SPAWNS[0].orangeRot}
        name="Bot"
      />
      <BoostPads carRefs={carRefs} />
      <GameCamera carRef={playerCarRef} ballRef={ballRef} />
      <GameManager
        playerCarRef={playerCarRef}
        botCarRef={botCarRef}
        ballRef={ballRef}
      />
    </Physics>
  );
}

function InputHandler() {
  useInputManager();
  return null;
}

export default function App() {
  const phase = useGameStore((s) => s.phase);

  return (
    <>
      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ fov: 75, near: 0.1, far: 500 }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: '#000011',
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
      >
        <Suspense fallback={null}>
          {/* Background even in menu */}
          {phase === 'menu' && (
            <>
              <ambientLight intensity={0.3} />
              <pointLight position={[10, 20, 10]} intensity={0.5} />
            </>
          )}
          <GameScene />
          <Environment preset="night" />
          <EffectComposer multisampling={4}>
            <Bloom luminanceThreshold={0.8} mipmapBlur intensity={1.5} />
            <Vignette eskil={false} offset={0.1} darkness={0.8} />
            <ChromaticAberration
              offset={new THREE.Vector2(0.002, 0.002)}
            />
          </EffectComposer>
        </Suspense>
      </Canvas>

      {/* UI Layer */}
      <MainMenu />
      <HUD />
      <Scoreboard />
      <InputHandler />
    </>
  );
}
