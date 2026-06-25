// ============================================
// HUD - In-Game Heads-Up Display
// ============================================
import { useState, useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';
import './HUD.css';

function formatTime(seconds: number): string {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.floor(Math.max(0, seconds) % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function HUD() {
  const [hasGamepad, setHasGamepad] = useState(false);

  useEffect(() => {
    const checkGamepad = () => setHasGamepad(navigator.getGamepads().some(gp => gp !== null));
    window.addEventListener('gamepadconnected', checkGamepad);
    window.addEventListener('gamepaddisconnected', checkGamepad);
    // Check initially
    checkGamepad();
    return () => {
      window.removeEventListener('gamepadconnected', checkGamepad);
      window.removeEventListener('gamepaddisconnected', checkGamepad);
    };
  }, []);

  const countdownTimer = useGameStore((s) => s.countdownTimer);
  const phase = useGameStore((s) => s.phase);

  useEffect(() => {
    if (phase === 'countdown') {
      const ceilTime = Math.ceil(countdownTimer);
      if (ceilTime > 0 && ceilTime <= 3 && Math.abs(countdownTimer - ceilTime) < 0.1) {
        // Prevent multiple plays per second
        const lastAnnounced = (window as any).lastCountdownAnnounced;
        if (lastAnnounced !== ceilTime) {
          (window as any).lastCountdownAnnounced = ceilTime;
          import('../audio/AudioManager').then(m => m.audioManager.playCountdownBeep());
        }
      } else if (ceilTime === 0) {
        const lastAnnounced = (window as any).lastCountdownAnnounced;
        if (lastAnnounced !== 0) {
          (window as any).lastCountdownAnnounced = 0;
          import('../audio/AudioManager').then(m => m.audioManager.playCountdownGo());
        }
      }
    }
  }, [countdownTimer, phase]);

  const blueScore = useGameStore((s) => s.blueScore);
  const orangeScore = useGameStore((s) => s.orangeScore);
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const isOvertime = useGameStore((s) => s.isOvertime);
  const playerBoost = useGameStore((s) => s.playerBoost);
  const playerSpeed = useGameStore((s) => s.playerSpeed);
  const isSupersonic = useGameStore((s) => s.isSupersonic);
  const ballCamEnabled = useGameStore((s) => s.ballCamEnabled);
  const lastGoalScoredBy = useGameStore((s) => s.lastGoalScoredBy);
  const lastGoalScorerName = useGameStore((s) => s.lastGoalScorerName);
  const chatMessages = useGameStore((s) => s.chatMessages);
  const matchEvents = useGameStore((s) => s.matchEvents);

  if (phase === 'menu' || phase === 'lobby') return null;

  const boostPercent = Math.round(playerBoost);
  const speedKmh = Math.round(playerSpeed * 3.6);
  const boostAngle = (boostPercent / 100) * 270; // 270 degree arc

  return (
    <>
      <div className={`speed-lines ${isSupersonic && phase === 'playing' ? 'active' : ''}`}></div>
      <div className="hud-container">
      {/* Score Bar */}
      {useGameStore.getState().matchSettings.mode !== 'freeplay' && (
        <div className="hud-score-bar">
        <div className="hud-score blue-score">
          <span className="team-label">BLUE</span>
          <span className="score-value">{blueScore}</span>
        </div>
        <div className="hud-timer">
          {isOvertime && <span className="overtime-label">OVERTIME</span>}
          <span className="timer-value">{isOvertime ? '+0:00' : formatTime(timeRemaining)}</span>
        </div>
        <div className="hud-score orange-score">
          <span className="score-value">{orangeScore}</span>
          <span className="team-label">ORANGE</span>
        </div>
      </div>
      )}

      {/* Match Events */}
      <div className="hud-events">
        {matchEvents.filter(e => Date.now() - e.id < 4000).map(evt => (
          <div key={evt.id} className="event-item">
            {evt.text}
          </div>
        ))}
      </div>

      {/* Boost Meter */}
      <div className="hud-boost-container">
        <svg className="boost-ring" viewBox="0 0 120 120">
          {/* Background ring */}
          <circle
            cx="60" cy="60" r="50"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="8"
            strokeDasharray={`${270 * (Math.PI * 100 / 360)} ${2 * Math.PI * 50}`}
            strokeDashoffset="0"
            transform="rotate(135 60 60)"
            strokeLinecap="round"
          />
          {/* Boost fill */}
          <circle
            cx="60" cy="60" r="50"
            fill="none"
            stroke={boostPercent > 70 ? '#00ff88' : boostPercent > 30 ? '#ffaa00' : '#ff4444'}
            strokeWidth="8"
            strokeDasharray={`${boostAngle * (Math.PI * 100 / 360)} ${2 * Math.PI * 50}`}
            strokeDashoffset="0"
            transform="rotate(135 60 60)"
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 6px ${boostPercent > 70 ? '#00ff88' : boostPercent > 30 ? '#ffaa00' : '#ff4444'})`,
              transition: 'stroke-dasharray 0.1s ease'
            }}
          />
        </svg>
        <div className={`boost-value ${boostPercent <= 20 ? 'low-boost' : ''}`}>{boostPercent}</div>
      </div>

      {/* Speed */}
      <div className="hud-speed">
        <span className="speed-value">{speedKmh}</span>
        <span className="speed-unit">KM/H</span>
      </div>

      {/* Ball Cam Indicator */}
      <div className={`hud-ballcam ${ballCamEnabled ? 'active' : ''}`}>
        {ballCamEnabled ? '⚽ BALL CAM' : '🚗 CAR CAM'}
      </div>

      {/* Chat Messages */}
      <div className="hud-chat-box">
        {chatMessages.filter(msg => Date.now() - msg.time < 5000).map((msg, idx) => (
          <div key={idx} className="chat-message">
            <span className="chat-sender">{msg.sender}:</span> {msg.message}
          </div>
        ))}
      </div>

      {/* Countdown */}
      {phase === 'countdown' && countdownTimer > 0 && (
        <div className="hud-countdown">
          <span className="countdown-number">
            {Math.ceil(countdownTimer) > 0 ? Math.ceil(countdownTimer) : 'GO!'}
          </span>
        </div>
      )}

      {/* Goal Scored */}
      {phase === 'goal_scored' && (
        <div className={`hud-goal-alert ${lastGoalScoredBy}`}>
          <div className="goal-text">GOAL!</div>
          <div className="goal-scorer">{lastGoalScorerName}</div>
        </div>
      )}

      {/* Overtime Start */}
      {phase === 'overtime' && timeRemaining <= 0 && (
        <div className="hud-overtime-alert">
          <div className="overtime-text">OVERTIME!</div>
        </div>
      )}

      {/* Finished Menu Overlay */}
      {phase === 'finished' && (
        <div className="hud-finished">
          <div className="finished-title">MATCH FINISHED</div>
          <div className="finished-score">{blueScore} - {orangeScore}</div>
          <div className="finished-winner">{blueScore > orangeScore ? 'BLUE TEAM WINS' : 'ORANGE TEAM WINS'}</div>
          
          <div className="finished-stats">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Score</th>
                  <th>Goals</th>
                  <th>Assists</th>
                  <th>Saves</th>
                  <th>Shots</th>
                </tr>
              </thead>
              <tbody>
                <tr className="blue-row">
                  <td>Player</td>
                  <td>{blueScore * 100 + 50}</td>
                  <td>{blueScore}</td>
                  <td>0</td>
                  <td>1</td>
                  <td>{blueScore + 2}</td>
                </tr>
                <tr className="orange-row">
                  <td>Bot</td>
                  <td>{orangeScore * 100 + 20}</td>
                  <td>{orangeScore}</td>
                  <td>0</td>
                  <td>0</td>
                  <td>{orangeScore + 1}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="finished-instruction">Press ESC to return to Menu</div>
          <button className="finished-btn" onClick={() => {
            useGameStore.getState().resetMatch();
            useGameStore.getState().setPhase('menu');
          }}>
            BACK TO MENU
          </button>
        </div>
      )}

      {/* Pause Menu Overlay */}
      {phase === 'paused' && (
        <div className="hud-finished" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="finished-title">PAUSED</div>
          <button className="finished-btn" onClick={() => useGameStore.getState().setPhase('playing')}>RESUME</button>
          <button className="finished-btn" onClick={() => {
            useGameStore.getState().resetMatch();
            useGameStore.getState().setPhase('menu');
          }} style={{marginTop: '10px', background: '#d32f2f'}}>QUIT TO MENU</button>
        </div>
      )}

      {/* Controls Help */}
      <div className="hud-controls">
        {hasGamepad ? (
          <>
            <span>R2/L2: Drive</span>
            <span>A: Jump</span>
            <span>B: Boost</span>
            <span>Y: Ball Cam</span>
            <span>X: Drift</span>
          </>
        ) : (
          <>
            <span>WASD: Drive</span>
            <span>Space: Jump</span>
            <span>Shift: Boost</span>
            <span>Y: Ball Cam</span>
            <span>Left Click: Drift</span>
          </>
        )}
      </div>
    </div>
    </>
  );
}
