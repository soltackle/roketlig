import { useGameStore } from '../stores/gameStore';

export default function Scoreboard() {
  const visible = useGameStore((s) => s.scoreboardVisible);
  const blueScore = useGameStore((s) => s.blueScore);
  const orangeScore = useGameStore((s) => s.orangeScore);

  if (!visible) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '600px',
      background: 'rgba(0,0,0,0.85)',
      borderRadius: '10px',
      border: '2px solid rgba(255,255,255,0.2)',
      padding: '20px',
      zIndex: 200,
      fontFamily: 'Orbitron, sans-serif',
      color: 'white'
    }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px', letterSpacing: '2px' }}>SCOREBOARD</h2>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '10px' }}>
        <div style={{ width: '40%', color: '#2196F3', fontWeight: 'bold', fontSize: '1.5rem' }}>BLUE TEAM</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{blueScore}</div>
      </div>
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', marginBottom: '20px',
        background: 'linear-gradient(90deg, rgba(33,150,243,0.5) 0%, rgba(0,0,0,0) 100%)',
        padding: '10px', borderRadius: '5px'
      }}>
        <div style={{ width: '40%', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '30px', height: '30px', background: '#2196F3', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>P</div>
          Player
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>Score: {blueScore * 100}</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '10px', marginTop: '30px' }}>
        <div style={{ width: '40%', color: '#FF6D00', fontWeight: 'bold', fontSize: '1.5rem' }}>ORANGE TEAM</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{orangeScore}</div>
      </div>
      <div style={{ 
        display: 'flex', justifyContent: 'space-between',
        background: 'linear-gradient(90deg, rgba(255,109,0,0.5) 0%, rgba(0,0,0,0) 100%)',
        padding: '10px', borderRadius: '5px'
      }}>
        <div style={{ width: '40%', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '30px', height: '30px', background: '#FF6D00', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>B</div>
          Bot
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>Score: {orangeScore * 100}</div>
      </div>
    </div>
  );
}
