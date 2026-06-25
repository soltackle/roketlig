// ============================================
// SHARED TYPES - Rocket League Web Clone
// ============================================

export type Team = 'blue' | 'orange';

export interface PlayerInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  boost: boolean;
  drift: boolean;
  airRollLeft: boolean;
  airRollRight: boolean;
}

export interface CarState {
  id: string;
  team: Team;
  position: [number, number, number];
  rotation: [number, number, number, number]; // quaternion
  velocity: [number, number, number];
  angularVelocity: [number, number, number];
  boost: number;
  isOnGround: boolean;
  jumpsLeft: number;
  jumpTimer: number;
  isDemolished: boolean;
  demolishTimer: number;
  isSupersonic: boolean;
  score: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  isBot: boolean;
  name: string;
}

export interface BallState {
  position: [number, number, number];
  rotation: [number, number, number, number];
  velocity: [number, number, number];
  angularVelocity: [number, number, number];
  lastTouchedBy: string | null;
}

export interface BoostPadState {
  id: number;
  position: [number, number, number];
  isLarge: boolean;
  isActive: boolean;
  respawnTimer: number;
}

export type GamePhase = 'menu' | 'lobby' | 'countdown' | 'playing' | 'goal_scored' | 'overtime' | 'finished' | 'paused';

export interface GameState {
  phase: GamePhase;
  blueScore: number;
  orangeScore: number;
  timeRemaining: number;
  countdownTimer: number;
  isOvertime: boolean;
  lastGoalScoredBy: Team | null;
  lastGoalScorerName: string | null;
}

export interface MatchSettings {
  mode: '1v1' | '2v2' | 'freeplay';
  botDifficulty: 'easy' | 'medium' | 'hard';
}
