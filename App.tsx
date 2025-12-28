import React, { useState } from 'react';
import Visualizer from './components/Visualizer';
import { audioEngine } from './services/AudioEngine';

function App() {
  const [started, setStarted] = useState(false);

  const handleStart = async () => {
    if (started) return;
    setStarted(true);
    
    try {
      await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: true, audio: false }).catch(() => {}),
        audioEngine.init().catch(() => {})
      ]);
      
      if (audioEngine.ctx && audioEngine.ctx.state === 'suspended') {
        await audioEngine.ctx.resume();
      }
      
      audioEngine.setPresence(true);
    } catch (e) {
      console.error('Start error:', e);
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden select-none cursor-none" onClick={handleStart}>
      <Visualizer />
      {!started && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 pointer-events-auto" onClick={handleStart} />
      )}
      
      <style>{`body, .cursor-none { cursor: none; }`}</style>
    </div>
  );
}

export default App;