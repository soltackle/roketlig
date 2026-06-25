// ============================================
// GAME CONSTANTS - Rocket League Web Clone
// ============================================

// --- Arena Dimensions ---
export const ARENA_WIDTH = 60;       // X axis
export const ARENA_LENGTH = 100;     // Z axis
export const ARENA_HEIGHT = 25;      // Y axis (ceiling)
export const WALL_THICKNESS = 2;

// --- Goal Dimensions ---
export const GOAL_WIDTH = 14;
export const GOAL_HEIGHT = 6;
export const GOAL_DEPTH = 5;

// --- Ball ---
export const BALL_RADIUS = 1.2;
export const BALL_MASS = 0.3;
export const BALL_RESTITUTION = 0.6;
export const BALL_START_POS: [number, number, number] = [0, BALL_RADIUS + 0.5, 0];

// --- Car ---
export const CAR_WIDTH = 2.2;
export const CAR_HEIGHT = 1.0;
export const CAR_LENGTH = 3.5;
export const CAR_MASS = 1.5;

// Car Physics
export const CAR_MAX_SPEED = 40;
export const CAR_BOOST_MAX_SPEED = 55;
export const CAR_ACCELERATION = 30;
export const CAR_BRAKE_FORCE = 40;
export const CAR_TURN_SPEED = 3.5;
export const CAR_AIR_TURN_SPEED = 2.5;

// --- Boost ---
export const BOOST_MAX = 100;
export const BOOST_START = 33;
export const BOOST_CONSUMPTION_RATE = 33; // per second
export const BOOST_FORCE = 45;
export const BOOST_SMALL_AMOUNT = 12;
export const BOOST_LARGE_AMOUNT = 100;
export const BOOST_SMALL_RESPAWN_TIME = 4; // seconds
export const BOOST_LARGE_RESPAWN_TIME = 10; // seconds

// --- Jump ---
export const JUMP_FORCE = 12;
export const DOUBLE_JUMP_FORCE = 10;
export const DODGE_FORCE = 15;
export const DODGE_TORQUE = 8;
export const DODGE_TIMER = 1.5; // seconds window for dodge after jump
export const MAX_JUMPS = 2;

// --- Game Rules ---
export const MATCH_DURATION = 300; // 5 minutes in seconds
export const KICKOFF_COUNTDOWN = 3; // seconds
export const GOAL_REPLAY_DURATION = 3; // seconds
export const DEMOLITION_RESPAWN_TIME = 3; // seconds
export const SUPERSONIC_SPEED = 42;

// --- Physics ---
export const PHYSICS_TIMESTEP = 1 / 60;
export const GRAVITY: [number, number, number] = [0, -30, 0];

// --- Camera ---
export const CAMERA_DISTANCE = 12;
export const CAMERA_HEIGHT = 5;
export const CAMERA_STIFFNESS = 4;

// --- Kickoff Positions ---
export const KICKOFF_SPAWNS = [
  // Center
  { blue: [0, CAR_HEIGHT, -40], orange: [0, CAR_HEIGHT, 40], blueRot: 0, orangeRot: Math.PI },
  // Diagonal 1 (Blue Left, Orange Right)
  { blue: [-15, CAR_HEIGHT, -30], orange: [15, CAR_HEIGHT, 30], blueRot: Math.PI / 4, orangeRot: -Math.PI * 0.75 },
  // Diagonal 2 (Blue Right, Orange Left)
  { blue: [15, CAR_HEIGHT, -30], orange: [-15, CAR_HEIGHT, 30], blueRot: -Math.PI / 4, orangeRot: Math.PI * 0.75 },
  // Off-center 1
  { blue: [-10, CAR_HEIGHT, -35], orange: [10, CAR_HEIGHT, 35], blueRot: 0, orangeRot: Math.PI },
  // Off-center 2
  { blue: [10, CAR_HEIGHT, -35], orange: [-10, CAR_HEIGHT, 35], blueRot: 0, orangeRot: Math.PI },
] as const;

// --- Team Colors ---
export const BLUE_TEAM_COLOR = '#2196F3';
export const ORANGE_TEAM_COLOR = '#FF6D00';
export const BLUE_TEAM_EMISSIVE = '#1565C0';
export const ORANGE_TEAM_EMISSIVE = '#E65100';

// --- Boost Pad Positions ---
// Large boost pads (6 total)
export const LARGE_BOOST_POSITIONS: [number, number, number][] = [
  [-25, 0.1, -40],
  [25, 0.1, -40],
  [-25, 0.1, 0],
  [25, 0.1, 0],
  [-25, 0.1, 40],
  [25, 0.1, 40],
];

// Small boost pads
export const SMALL_BOOST_POSITIONS: [number, number, number][] = [
  // Center line
  [-15, 0.1, 0], [0, 0.1, 0], [15, 0.1, 0],
  // Mid field lines
  [-20, 0.1, -15], [-10, 0.1, -15], [0, 0.1, -15], [10, 0.1, -15], [20, 0.1, -15],
  [-20, 0.1, 15], [-10, 0.1, 15], [0, 0.1, 15], [10, 0.1, 15], [20, 0.1, 15],
  // Near goal lines
  [-15, 0.1, -30], [0, 0.1, -30], [15, 0.1, -30],
  [-15, 0.1, 30], [0, 0.1, 30], [15, 0.1, 30],
  // Side lines
  [-25, 0.1, -20], [25, 0.1, -20],
  [-25, 0.1, 20], [25, 0.1, 20],
];
