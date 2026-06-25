// ============================================
// GAME MANAGER - Goals, Timer, Kickoff, Score
// ============================================
import { useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../stores/gameStore';
import type { CarHandle } from './Car';
import type { BallHandle } from './Ball';
import { updateBotAI, createBotState, type BotDifficulty } from './BotAI';
import {
  ARENA_LENGTH, GOAL_WIDTH, GOAL_HEIGHT,
  BALL_START_POS, KICKOFF_COUNTDOWN, GOAL_REPLAY_DURATION,
  KICKOFF_SPAWNS
} from '../constants';
import type { Team } from '../types';
import { audioManager } from '../audio/AudioManager';

interface GameManagerProps {
  playerCarRef: React.RefObject<CarHandle | null>;
  botCarRef: React.RefObject<CarHandle | null>;
  ballRef: React.RefObject<BallHandle | null>;
}

export default function GameManager({ playerCarRef, botCarRef, ballRef }: GameManagerProps) {
  const phase = useGameStore((s) => s.phase);
  const setPhase = useGameStore((s) => s.setPhase);
  const addGoal = useGameStore((s) => s.addGoal);
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const setTimeRemaining = useGameStore((s) => s.setTimeRemaining);
  const blueScore = useGameStore((s) => s.blueScore);
  const orangeScore = useGameStore((s) => s.orangeScore);
  const isOvertime = useGameStore((s) => s.isOvertime);
  const setOvertime = useGameStore((s) => s.setOvertime);
  const countdownTimer = useGameStore((s) => s.countdownTimer);
  const setCountdownTimer = useGameStore((s) => s.setCountdownTimer);
  const setPlayerBoost = useGameStore((s) => s.setPlayerBoost);
  const setPlayerSpeed = useGameStore((s) => s.setPlayerSpeed);
  const matchSettings = useGameStore((s) => s.matchSettings);

  const botState = useRef(createBotState());
  const goalReplayTimer = useRef(0);
  const gameInitialized = useRef(false);

  const resetPositions = useCallback(() => {
    const spawnIndex = Math.floor(Math.random() * KICKOFF_SPAWNS.length);
    const spawn = KICKOFF_SPAWNS[spawnIndex];
    playerCarRef.current?.reset(spawn.blue as [number, number, number], spawn.blueRot);
    botCarRef.current?.reset(spawn.orange as [number, number, number], spawn.orangeRot);
    ballRef.current?.reset();
  }, [playerCarRef, botCarRef, ballRef]);

  const checkGoal = useCallback((): Team | null => {
    if (!ballRef.current) return null;
    const ballPos = ballRef.current.getPosition();
    const halfL = ARENA_LENGTH / 2;

    // Ball in blue goal (z < -halfL)
    if (
      ballPos.z < -halfL - 1 &&
      Math.abs(ballPos.x) < GOAL_WIDTH / 2 &&
      ballPos.y < GOAL_HEIGHT &&
      ballPos.y > 0
    ) {
      return 'orange'; // Orange scored
    }

    // Ball in orange goal (z > halfL)
    if (
      ballPos.z > halfL + 1 &&
      Math.abs(ballPos.x) < GOAL_WIDTH / 2 &&
      ballPos.y < GOAL_HEIGHT &&
      ballPos.y > 0
    ) {
      return 'blue'; // Blue scored
    }

    return null;
  }, [ballRef]);

  useFrame((_, delta) => {
    // === COUNTDOWN PHASE ===
    if (phase === 'countdown') {
      if (!gameInitialized.current) {
        resetPositions();
        gameInitialized.current = true;
      }

      const newTimer = countdownTimer - delta;
      if (newTimer <= 0) {
        setCountdownTimer(0);
        setPhase('playing');
        gameInitialized.current = false;
      } else {
        setCountdownTimer(newTimer);
      }
      return;
    }

    // === GOAL SCORED PHASE ===
    if (phase === 'goal_scored') {
      goalReplayTimer.current -= delta;
      if (goalReplayTimer.current <= 0) {
        resetPositions();
        setCountdownTimer(KICKOFF_COUNTDOWN);
        setPhase('countdown');
      }
      return;
    }

    // === FINISHED PHASE ===
    if (phase === 'finished') {
      return;
    }

    // === PLAYING / OVERTIME ===
    if (phase !== 'playing' && phase !== 'overtime') return;

    // Update match timer
    if (!isOvertime) {
      const newTime = timeRemaining - delta;
      if (newTime <= 0) {
        setTimeRemaining(0);
        if (blueScore === orangeScore) {
          setOvertime(true);
          setPhase('overtime');
          audioManager.playOvertimeAlert();
        } else {
          setPhase('finished');
          audioManager.playScoreScreenMusic();
          return;
        }
      } else {
        setTimeRemaining(newTime);
      }
    }

    // Apply player input
    const input = useGameStore.getState().input;
    if (playerCarRef.current && !playerCarRef.current.isDemolished()) {
      playerCarRef.current.applyInput(input, delta);
      setPlayerBoost(playerCarRef.current.getBoost());
      setPlayerSpeed(playerCarRef.current.getSpeed());
    }

    // Apply bot AI
    if (botCarRef.current && ballRef.current && !botCarRef.current.isDemolished()) {
      const botInput = updateBotAI(
        botCarRef.current,
        ballRef.current,
        'orange',
        matchSettings.botDifficulty as BotDifficulty,
        botState.current,
        delta
      );
      botCarRef.current.applyInput(botInput, delta);
    }

    // Check for goals
    const scoringTeam = checkGoal();
    if (scoringTeam) {
      const scorerName = scoringTeam === 'blue' ? 'Player' : 'Bot';
      addGoal(scoringTeam, scorerName);
      useGameStore.getState().addMatchEvent(`${scorerName.toUpperCase()} SCORED!`, 'goal');
      goalReplayTimer.current = GOAL_REPLAY_DURATION;
      audioManager.playGoal();
      audioManager.playCrowdCheer();

      // Goal Explosion Shockwave
      const ballPos = ballRef.current?.getPosition();
      if (ballPos) {
        useGameStore.getState().addCameraShake(5);
        const applyShockwave = (car: CarHandle | null) => {
          if (!car) return;
          const rb = car.getRigidBody();
          if (!rb) return;
          const carPos = car.getPosition();
          const dist = carPos.distanceTo(ballPos);
          if (dist < 40) { // Only affect cars within 40 units
            const force = Math.max(0, 1500 - dist * 30);
            const dir = new THREE.Vector3().subVectors(carPos, ballPos).normalize();
            rb.applyImpulse({ x: dir.x * force, y: 300 + force * 0.5, z: dir.z * force }, true);
            rb.applyTorqueImpulse({ x: (Math.random() - 0.5) * force, y: (Math.random() - 0.5) * force, z: (Math.random() - 0.5) * force }, true);
          }
        };
        applyShockwave(playerCarRef.current);
        applyShockwave(botCarRef.current);
      }

      // In overtime, any goal ends the game
      if (isOvertime) {
        setTimeout(() => {
          setPhase('finished');
          audioManager.playScoreScreenMusic();
        }, GOAL_REPLAY_DURATION * 1000);
      }
    }

    // Check demolition (simplified: supersonic car hitting opponent)
    if (playerCarRef.current && botCarRef.current) {
      const playerPos = playerCarRef.current.getPosition();
      const botPos = botCarRef.current.getPosition();
      const dist = playerPos.distanceTo(botPos);

      if (dist < 3.5) {
        const playerSpeed = playerCarRef.current.getSpeed();
        const botSpeed = botCarRef.current.getSpeed();

        if (playerSpeed > 42 && !botCarRef.current.isDemolished()) {
          botCarRef.current.demolish();
          audioManager.playHit(100);
          useGameStore.getState().addCameraShake(3);
          useGameStore.getState().addMatchEvent("PLAYER DEMOLISHED BOT", 'demolition');
        }
        if (botSpeed > 42 && !playerCarRef.current.isDemolished()) {
          playerCarRef.current.demolish();
          audioManager.playHit(100);
          useGameStore.getState().addCameraShake(3);
          useGameStore.getState().addMatchEvent("BOT DEMOLISHED PLAYER", 'demolition');
        }
      }
    }
  });

  return null;
}
