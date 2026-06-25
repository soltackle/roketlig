// ============================================
// BOT AI - Artificial Intelligence for Bot Cars
// ============================================
import * as THREE from 'three';
import type { PlayerInput, Team } from '../types';
import type { CarHandle } from './Car';
import type { BallHandle } from './Ball';
import { ARENA_LENGTH, ARENA_WIDTH, GOAL_WIDTH, GOAL_HEIGHT, LARGE_BOOST_POSITIONS } from '../constants';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

interface BotState {
  reactionTimer: number;
  lastInput: PlayerInput;
  targetUpdateTimer: number;
  dodgeTimer: number;
  randomOffset: THREE.Vector3;
}

const EMPTY_INPUT: PlayerInput = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  boost: false,
  drift: false,
  airRollLeft: false,
  airRollRight: false,
};

const DIFFICULTY_SETTINGS = {
  easy: {
    reactionDelay: 0.3,
    targetUpdateInterval: 0.5,
    accuracy: 0.6,
    boostUsage: 0.3,
    dodgeChance: 0.1,
    aimSpread: 8,
  },
  medium: {
    reactionDelay: 0.15,
    targetUpdateInterval: 0.25,
    accuracy: 0.8,
    boostUsage: 0.6,
    dodgeChance: 0.3,
    aimSpread: 4,
  },
  hard: {
    reactionDelay: 0.05,
    targetUpdateInterval: 0.1,
    accuracy: 0.95,
    boostUsage: 0.85,
    dodgeChance: 0.6,
    aimSpread: 1.5,
  },
};

export function createBotState(): BotState {
  return {
    reactionTimer: 0,
    lastInput: { ...EMPTY_INPUT },
    targetUpdateTimer: 0,
    dodgeTimer: 0,
    randomOffset: new THREE.Vector3(
      (Math.random() - 0.5) * 4,
      0,
      (Math.random() - 0.5) * 4
    ),
  };
}

export function updateBotAI(
  botCar: CarHandle,
  ball: BallHandle,
  team: Team,
  difficulty: BotDifficulty,
  state: BotState,
  delta: number
): PlayerInput {
  const settings = DIFFICULTY_SETTINGS[difficulty];
  const input: PlayerInput = { ...EMPTY_INPUT };

  // Reaction delay
  state.reactionTimer -= delta;
  if (state.reactionTimer > 0) {
    return state.lastInput;
  }

  // Update target periodically
  state.targetUpdateTimer -= delta;
  if (state.targetUpdateTimer <= 0) {
    state.targetUpdateTimer = settings.targetUpdateInterval;
    state.randomOffset = new THREE.Vector3(
      (Math.random() - 0.5) * settings.aimSpread,
      0,
      (Math.random() - 0.5) * settings.aimSpread
    );
  }

  const carPos = botCar.getPosition();
  const carRot = botCar.getRotation();
  const ballPos = ball.getPosition();
  const ballVel = ball.getVelocity();
  const carSpeed = botCar.getSpeed();
  const isGrounded = botCar.isOnGround();

  // Determine goal positions
  const ownGoalZ = team === 'blue' ? -ARENA_LENGTH / 2 : ARENA_LENGTH / 2;
  const targetGoalZ = team === 'blue' ? ARENA_LENGTH / 2 : -ARENA_LENGTH / 2;

  // Predict ball position (simple linear prediction)
  const predictionTime = Math.min(1.5, carPos.distanceTo(ballPos) / Math.max(carSpeed, 10));
  const predictedBallPos = new THREE.Vector3(
    ballPos.x + ballVel.x * predictionTime,
    ballPos.y + ballVel.y * predictionTime - 15 * predictionTime * predictionTime, // gravity
    ballPos.z + ballVel.z * predictionTime
  );
  predictedBallPos.y = Math.max(1, predictedBallPos.y);

  // Wall Prediction (bounce)
  if (Math.abs(predictedBallPos.x) > ARENA_WIDTH / 2) {
    predictedBallPos.x = Math.sign(predictedBallPos.x) * ARENA_WIDTH - predictedBallPos.x;
  }
  if (Math.abs(predictedBallPos.z) > ARENA_LENGTH / 2 && Math.abs(predictedBallPos.x) > GOAL_WIDTH / 2) {
    predictedBallPos.z = Math.sign(predictedBallPos.z) * ARENA_LENGTH - predictedBallPos.z;
  }

  // Decide behavior: attack, defend, or go for boost
  const ballToOwnGoalDist = Math.abs(ballPos.z - ownGoalZ);
  const ballToTargetGoalDist = Math.abs(ballPos.z - targetGoalZ);
  const carToOwnGoalDist = Math.abs(carPos.z - ownGoalZ);
  const isBallComingToGoal = team === 'blue'
    ? ballVel.z < -5 && ballPos.z < 0
    : ballVel.z > 5 && ballPos.z > 0;

  let targetPos: THREE.Vector3;

  const isKickoff = Math.abs(ballPos.x) < 0.5 && Math.abs(ballPos.z) < 0.5 && carPos.distanceTo(ballPos) > 10;

  if (isKickoff) {
    // KICKOFF: Boost straight to the ball
    targetPos = ballPos.clone();
  } else if (isBallComingToGoal || (ballToOwnGoalDist < 40 && carToOwnGoalDist < 20)) {
    // GOALIE ROTATION: Protect the net
    if (ballToOwnGoalDist < 15) {
      // Clear the ball
      targetPos = predictedBallPos.clone();
    } else {
      // Wait in net
      targetPos = new THREE.Vector3(
        Math.max(-5, Math.min(5, ballPos.x * 0.5)),
        1,
        ownGoalZ > 0 ? ownGoalZ - 2 : ownGoalZ + 2
      );
    }
  } else if (botCar.getBoost() < 20 && !isBallComingToGoal && !isKickoff) {
    // GET BOOST: Find nearest large boost pad
    let nearestDist = Infinity;
    let nearestPad = new THREE.Vector3(0, 0, 0);
    for (const pos of LARGE_BOOST_POSITIONS) {
      const padPos = new THREE.Vector3(pos[0], pos[1], pos[2]);
      const dist = carPos.distanceTo(padPos);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestPad = padPos;
      }
    }
    targetPos = nearestPad;
  } else {
    // ATTACK: Aim to hit ball toward opponent goal
    const ballToGoal = new THREE.Vector3(
      -ballPos.x * 0.3, // Aim slightly toward center
      0,
      targetGoalZ
    ).sub(ballPos).normalize();

    // Position behind ball relative to target goal
    targetPos = predictedBallPos.clone().sub(
      ballToGoal.multiplyScalar(3) // Get behind ball
    );
    targetPos.add(state.randomOffset);
  }

  // Calculate steering
  const carForward = new THREE.Vector3(0, 0, -1).applyQuaternion(carRot);
  const toTarget = new THREE.Vector3(
    targetPos.x - carPos.x,
    0,
    targetPos.z - carPos.z
  ).normalize();

  const cross = carForward.clone().cross(toTarget);
  const dot = carForward.dot(toTarget);

  // Steering
  const steerThreshold = 0.15;
  if (cross.y > steerThreshold) {
    input.left = true;
  } else if (cross.y < -steerThreshold) {
    input.right = true;
  }

  // Forward/backward
  const distToBall = carPos.distanceTo(predictedBallPos);
  if (dot > -0.3) {
    input.forward = true;
  } else {
    // Ball is behind us - reverse or turn around
    if (distToBall < 10) {
      input.backward = true;
    } else {
      input.forward = true;
      input.left = true;
    }
  }

  // Boost usage
  if (isKickoff) {
    input.boost = true;
    // Front flip if somewhat close
    if (distToBall < 25 && distToBall > 15 && isGrounded) {
      input.jump = true;
      input.forward = true;
    } else if (distToBall < 14 && distToBall > 10 && !isGrounded) {
      input.jump = true;
      input.forward = true;
    }
  } else {
    if (distToBall > 15 && botCar.getBoost() > 10 && Math.random() < settings.boostUsage && input.forward) {
      input.boost = true;
    }
    // Boost toward ball when close
    if (distToBall < 8 && distToBall > 3 && botCar.getBoost() > 5 && dot > 0.7 && Math.random() < settings.boostUsage) {
      input.boost = true;
    }
  }

  // Jump when ball is above ground
  if (!isKickoff && isGrounded && distToBall < 5 && predictedBallPos.y > 2 && predictedBallPos.y < 6) {
    input.jump = true;
  }

  // Bot Aerials
  if (!isKickoff && isGrounded && distToBall < 15 && predictedBallPos.y >= 6 && botCar.getBoost() > 20) {
    input.jump = true;
  }
  if (!isKickoff && !isGrounded && predictedBallPos.y > 4 && carPos.y < predictedBallPos.y - 1 && botCar.getBoost() > 0) {
    // Tilt back and boost to fly
    input.backward = true;
    input.boost = true;
  }

  // Dodge at ball for powerful hit
  state.dodgeTimer -= delta;
  if (distToBall < 4 && dot > 0.8 && carSpeed > 10 && state.dodgeTimer <= 0 && Math.random() < settings.dodgeChance) {
    input.jump = true;
    input.forward = true;
    state.dodgeTimer = 1.5;
  }

  // Don't drive into own goal
  if (team === 'blue' && carPos.z < -ARENA_LENGTH / 2 + 5 && Math.abs(carPos.x) < GOAL_WIDTH / 2) {
    input.forward = false;
    input.backward = true;
    input.boost = false;
  }
  if (team === 'orange' && carPos.z > ARENA_LENGTH / 2 - 5 && Math.abs(carPos.x) < GOAL_WIDTH / 2) {
    input.forward = false;
    input.backward = true;
    input.boost = false;
  }

  state.lastInput = { ...input };
  state.reactionTimer = settings.reactionDelay * (0.8 + Math.random() * 0.4);

  return input;
}
