// ============================================
// GAME STORE - Zustand State Management
// ============================================
import { create } from 'zustand';
import type { GamePhase, Team, MatchSettings } from '../types';
import { MATCH_DURATION, BOOST_START } from '../constants';

interface GameStore {
  // Game phase
  phase: GamePhase;
  setPhase: (phase: GamePhase) => void;

  // Scores
  blueScore: number;
  orangeScore: number;
  addGoal: (team: Team, scorerName: string) => void;

  // Timer
  timeRemaining: number;
  setTimeRemaining: (time: number) => void;
  isOvertime: boolean;
  setOvertime: (val: boolean) => void;

  // Countdown
  countdownTimer: number;
  setCountdownTimer: (val: number) => void;

  // Goal info
  lastGoalScoredBy: Team | null;
  lastGoalScorerName: string | null;

  // Player boost
  playerBoost: number;
  setPlayerBoost: (val: number) => void;

  // Player speed
  playerSpeed: number;
  setPlayerSpeed: (val: number) => void;

  // Ball cam
  ballCamEnabled: boolean;
  toggleBallCam: () => void;

  // Match settings
  matchSettings: MatchSettings;
  setMatchSettings: (settings: Partial<MatchSettings>) => void;

  // Camera Shake
  cameraShake: number;
  addCameraShake: (amount: number) => void;
  setCameraShake: (amount: number) => void;

  // Supersonic
  isSupersonic: boolean;
  setIsSupersonic: (val: boolean) => void;

  // Input state
  input: {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    jump: boolean;
    boost: boolean;
    drift: boolean;
    airRollLeft: boolean;
    airRollRight: boolean;
  };
  setInput: (key: string, value: boolean) => void;

  // Chat messages
  chatMessages: { sender: string; message: string; time: number }[];
  addChatMessage: (sender: string, message: string) => void;

  // Scoreboard visibility
  scoreboardVisible: boolean;
  setScoreboardVisible: (val: boolean) => void;

  // Settings
  settings: {
    masterVolume: number;
    sfxVolume: number;
    musicVolume: number;
    graphicsQuality: 'low' | 'medium' | 'high';
  };
  updateSettings: (settings: Partial<GameStore['settings']>) => void;

  // Reset
  resetMatch: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  phase: 'menu',
  setPhase: (phase) => set({ phase }),

  blueScore: 0,
  orangeScore: 0,
  addGoal: (team, scorerName) =>
    set((state) => ({
      blueScore: team === 'blue' ? state.blueScore + 1 : state.blueScore,
      orangeScore: team === 'orange' ? state.orangeScore + 1 : state.orangeScore,
      lastGoalScoredBy: team,
      lastGoalScorerName: scorerName,
      phase: 'goal_scored',
    })),

  timeRemaining: MATCH_DURATION,
  setTimeRemaining: (time) => set({ timeRemaining: time }),
  isOvertime: false,
  setOvertime: (val) => set({ isOvertime: val }),

  countdownTimer: 3,
  setCountdownTimer: (val) => set({ countdownTimer: val }),

  lastGoalScoredBy: null,
  lastGoalScorerName: null,

  playerBoost: BOOST_START,
  setPlayerBoost: (val) => set({ playerBoost: val }),

  playerSpeed: 0,
  setPlayerSpeed: (val) => set({ playerSpeed: val }),

  ballCamEnabled: true,
  toggleBallCam: () => set((state) => ({ ballCamEnabled: !state.ballCamEnabled })),

  matchSettings: {
    mode: '1v1',
    botDifficulty: 'medium',
  },
  setMatchSettings: (settings) =>
    set((state) => ({
      matchSettings: { ...state.matchSettings, ...settings },
    })),

  // Camera shake
  cameraShake: 0,
  addCameraShake: (amount) => set((state) => ({ cameraShake: state.cameraShake + amount })),
  setCameraShake: (amount) => set({ cameraShake: amount }),

  // Supersonic
  isSupersonic: false,
  setIsSupersonic: (val) => set({ isSupersonic: val }),

  input: {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    boost: false,
    drift: false,
    airRollLeft: false,
    airRollRight: false,
  },
  setInput: (key, value) =>
    set((state) => ({
      input: { ...state.input, [key]: value },
    })),

  chatMessages: [],
  addChatMessage: (sender, message) =>
    set((state) => ({
      chatMessages: [
        ...state.chatMessages.slice(-49),
        { sender, message, time: Date.now() },
      ],
    })),

  scoreboardVisible: false,
  setScoreboardVisible: (val) => set({ scoreboardVisible: val }),

  settings: {
    masterVolume: 80,
    sfxVolume: 100,
    musicVolume: 50,
    graphicsQuality: 'high',
  },
  updateSettings: (settings) =>
    set((state) => ({
      settings: { ...state.settings, ...settings },
    })),

  resetMatch: () =>
    set({
      blueScore: 0,
      orangeScore: 0,
      timeRemaining: MATCH_DURATION,
      isOvertime: false,
      countdownTimer: 3,
      lastGoalScoredBy: null,
      lastGoalScorerName: null,
      playerBoost: BOOST_START,
      playerSpeed: 0,
      chatMessages: [],
    }),
}));
