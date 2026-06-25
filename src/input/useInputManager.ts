// ============================================
// INPUT MANAGER - Keyboard Input Hook
// ============================================
import { useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';

const KEY_MAP: Record<string, string> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'jump',
  ShiftLeft: 'boost',
  ShiftRight: 'boost',
  KeyQ: 'airRollLeft',
  KeyE: 'airRollRight',
  KeyC: 'drift',
};

export function useInputManager() {
  const setInput = useGameStore((s) => s.setInput);
  const toggleBallCam = useGameStore((s) => s.toggleBallCam);
  const setScoreboardVisible = useGameStore((s) => s.setScoreboardVisible);
  const phase = useGameStore((s) => s.phase);

  useEffect(() => {
    if (phase !== 'playing' && phase !== 'countdown' && phase !== 'overtime') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default for game keys
      if (KEY_MAP[e.code] || e.code === 'KeyY' || e.code === 'Tab') {
        e.preventDefault();
      }

      const action = KEY_MAP[e.code];
      if (action) {
        setInput(action, true);
      }

      // Ball cam toggle
      if (e.code === 'KeyY' && !e.repeat) {
        toggleBallCam();
      }

      // Scoreboard
      if (e.code === 'Tab') {
        setScoreboardVisible(true);
      }

      // Pause Menu
      if (e.code === 'Escape' && !e.repeat) {
        if (useGameStore.getState().phase === 'playing') {
          useGameStore.getState().setPhase('paused');
        } else if (useGameStore.getState().phase === 'paused') {
          useGameStore.getState().setPhase('playing');
        }
      }

      // Quick Chat
      if (!e.repeat) {
        if (e.code === 'Digit1') useGameStore.getState().addChatMessage('Player', 'What a save!');
        if (e.code === 'Digit2') useGameStore.getState().addChatMessage('Player', 'Great pass!');
        if (e.code === 'Digit3') useGameStore.getState().addChatMessage('Player', 'Nice shot!');
        if (e.code === 'Digit4') useGameStore.getState().addChatMessage('Player', 'Oops!');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const action = KEY_MAP[e.code];
      if (action) {
        setInput(action, false);
      }

      if (e.code === 'Tab') {
        setScoreboardVisible(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [phase, setInput, toggleBallCam, setScoreboardVisible]);
}
