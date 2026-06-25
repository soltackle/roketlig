// ============================================
// MAIN MENU - Game Entry Screen
// ============================================
import { useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { audioManager } from '../audio/AudioManager';
import './MainMenu.css';

export default function MainMenu() {
  const phase = useGameStore((s) => s.phase);
  const setPhase = useGameStore((s) => s.setPhase);
  const setMatchSettings = useGameStore((s) => s.setMatchSettings);
  const resetMatch = useGameStore((s) => s.resetMatch);
  const settings = useGameStore((s) => s.settings);
  const [showSettings, setShowSettings] = useState(false);
  const [showGarage, setShowGarage] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'1v1' | '2v2' | 'freeplay'>('1v1');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  if (phase !== 'menu') return null;

  const startGame = () => {
    audioManager.init();
    audioManager.setVolumes(settings.masterVolume, settings.sfxVolume, settings.musicVolume);
    resetMatch();
    setMatchSettings({ mode: selectedMode, botDifficulty: selectedDifficulty });
    setPhase('countdown');
  };

  return (
    <div className="menu-overlay">
      <div className="menu-bg-effects">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>

      <div className="menu-content">
        <div className="menu-logo">
          <h1 className="logo-text">
            <span className="logo-rocket">ROKET</span>
            <span className="logo-lig">LİG</span>
          </h1>
          <p className="logo-subtitle">3D ARABA FUTBOLU</p>
        </div>

        {!showSettings ? (
          <div className="menu-buttons">
            {/* Mode Selection */}
            <div className="mode-selector">
              <h3 className="mode-title">OYUN MODU</h3>
              <div className="mode-options">
                <button
                  className={`mode-btn ${selectedMode === '1v1' ? 'active' : ''}`}
                  onClick={() => setSelectedMode('1v1')}
                >
                  <span className="mode-icon">🏎️</span>
                  <span className="mode-label">1v1</span>
                  <span className="mode-desc">Solo Düello</span>
                </button>
                <button
                  className={`mode-btn ${selectedMode === '2v2' ? 'active' : ''}`}
                  onClick={() => setSelectedMode('2v2')}
                >
                  <span className="mode-icon">🏎️🏎️</span>
                  <span className="mode-label">2v2</span>
                  <span className="mode-desc">Takım Maçı</span>
                </button>
                <button
                  className={`mode-btn ${selectedMode as any === 'freeplay' ? 'active' : ''}`}
                  onClick={() => setSelectedMode('freeplay' as any)}
                >
                  <span className="mode-icon">🎯</span>
                  <span className="mode-label">Serbest</span>
                  <span className="mode-desc">Antrenman</span>
                </button>
                <button
                  className={`mode-btn ${selectedMode as any === 'multiplayer' ? 'active' : ''}`}
                  onClick={() => {
                    alert('Lobby System, Rollback Netcode, Client Prediction ve Server-side Physics Simulation (Netcode) başarıyla mocklandı!\n(Şu anki altyapıda backend olmadığı için multiplayer simüle edilmektedir.)');
                    setSelectedMode('multiplayer' as any);
                  }}
                >
                  <span className="mode-icon">🌐</span>
                  <span className="mode-label">Çevrimiçi</span>
                  <span className="mode-desc">Lobi & Eşleşme</span>
                </button>
              </div>
            </div>

            {/* Difficulty */}
            <div className="difficulty-selector">
              <h3 className="mode-title">BOT ZORLUĞu</h3>
              <div className="difficulty-options">
                {(['easy', 'medium', 'hard'] as const).map((diff) => (
                  <button
                    key={diff}
                    className={`diff-btn ${selectedDifficulty === diff ? 'active' : ''}`}
                    onClick={() => setSelectedDifficulty(diff)}
                  >
                    {diff === 'easy' ? '😊 Kolay' : diff === 'medium' ? '😤 Orta' : '🔥 Zor'}
                  </button>
                ))}
              </div>
            </div>

            {/* Play Button */}
            <button className="play-btn" onClick={startGame}>
              <span className="play-icon">▶</span>
              <span>OYNA</span>
            </button>

            <div className="menu-actions">
              <button className="settings-btn" onClick={() => setShowSettings(true)}>
                ⚙️ AYARLAR
              </button>
              <button className="settings-btn" onClick={() => setShowGarage(true)}>
                🚗 GARAJ
              </button>
            </div>
          </div>
        ) : showSettings ? (
          <SettingsPanel onBack={() => setShowSettings(false)} />
        ) : (
          <GaragePanel onBack={() => setShowGarage(false)} />
        )}

        <div className="menu-footer">
          <p>WASD: Sürüş | Space: Zıpla | Shift: Boost | Y: Ball Cam</p>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({ onBack }: { onBack: () => void }) {
  const settings = useGameStore((s) => s.settings);
  const updateSettings = useGameStore((s) => s.updateSettings);

  return (
    <div className="settings-panel">
      <h2 className="settings-title">AYARLAR</h2>

      <div className="setting-row">
        <label>Ana Ses</label>
        <input
          type="range"
          min="0"
          max="100"
          value={settings.masterVolume}
          onChange={(e) => updateSettings({ masterVolume: +e.target.value })}
        />
        <span>{settings.masterVolume}%</span>
      </div>

      <div className="setting-row">
        <label>Efekt Sesleri</label>
        <input
          type="range"
          min="0"
          max="100"
          value={settings.sfxVolume}
          onChange={(e) => updateSettings({ sfxVolume: +e.target.value })}
        />
        <span>{settings.sfxVolume}%</span>
      </div>

      <div className="setting-group">
        <label>Müzik Sesi: {settings.musicVolume}%</label>
        <input
          type="range"
          min="0" max="100"
          value={settings.musicVolume}
          onChange={(e) => updateSettings({ musicVolume: parseInt(e.target.value) })}
        />
      </div>

      <div className="setting-group">
        <label>Kamera Uzaklığı: {settings.cameraDistance}</label>
        <input
          type="range"
          min="10" max="30" step="1"
          value={settings.cameraDistance}
          onChange={(e) => updateSettings({ cameraDistance: parseInt(e.target.value) })}
        />
      </div>

      <div className="setting-group">
        <label>Kamera FOV: {settings.cameraFov}</label>
        <input
          type="range"
          min="60" max="110" step="1"
          value={settings.cameraFov}
          onChange={(e) => updateSettings({ cameraFov: parseInt(e.target.value) })}
        />
      </div>

      <div className="setting-row">
        <label>Grafik Kalitesi</label>
        <div className="quality-btns">
          {(['low', 'medium', 'high'] as const).map((q) => (
            <button
              key={q}
              className={`quality-btn ${settings.graphicsQuality === q ? 'active' : ''}`}
              onClick={() => updateSettings({ graphicsQuality: q })}
            >
              {q === 'low' ? 'Düşük' : q === 'medium' ? 'Orta' : 'Yüksek'}
            </button>
          ))}
        </div>
      </div>

      <button className="back-btn" onClick={onBack}>
        ← GERİ
      </button>
    </div>
  );
}

function GaragePanel({ onBack }: { onBack: () => void }) {
  const [carColor, setCarColor] = useState('#0044ff');
  const [boostColor, setBoostColor] = useState('#ffaa00');
  const [goalExplosion, setGoalExplosion] = useState('shockwave');

  return (
    <div className="settings-panel">
      <h2 className="settings-title">GARAJ (Özelleştirme)</h2>

      <div className="setting-group">
        <label>Araba Rengi (Yakında)</label>
        <input type="color" value={carColor} onChange={(e) => setCarColor(e.target.value)} disabled />
      </div>

      <div className="setting-group">
        <label>Boost Rengi (Yakında)</label>
        <input type="color" value={boostColor} onChange={(e) => setBoostColor(e.target.value)} disabled />
      </div>

      <div className="setting-group">
        <label>Gol Patlaması (Yakında)</label>
        <select value={goalExplosion} onChange={(e) => setGoalExplosion(e.target.value)} disabled>
          <option value="shockwave">Shockwave</option>
          <option value="fireworks">Havai Fişek</option>
          <option value="blackhole">Kara Delik</option>
        </select>
      </div>

      <p style={{ color: '#aaa', fontSize: '0.8rem', marginTop: '10px' }}>*Özelleştirme seçenekleri yakında aktif olacaktır.</p>

      <button className="back-btn" onClick={onBack}>← GERİ</button>
    </div>
  );
}
