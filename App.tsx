import React, { useState } from 'react';
import Visualizer from './components/Visualizer';
import { audioEngine } from './services/AudioEngine';

function App() {
  const [started, setStarted] = useState(false);

  const handleStart = () => {
    if (started) return;
    setStarted(true);
    Promise.all([
      navigator.mediaDevices.getUserMedia({ video: true, audio: true }).catch(() => {}),
      audioEngine.init().catch(() => {})
    ]).then(() => {
      audioEngine.setPresence(true);
    });
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