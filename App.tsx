import React, { useState } from 'react';
import Visualizer from './components/Visualizer';
import { audioEngine } from './services/AudioEngine';

const App: React.FC = () => {
  const [started, setStarted] = useState(false);

  const handleStart = async () => {
    if (!started) {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        await audioEngine.init();
        audioEngine.setPresence(true);
        setStarted(true);
      } catch (err) {
        console.error("Initialization failed:", err);
      }
    }
  };

  return (
    <div 
      className="relative w-full h-screen bg-black overflow-hidden select-none cursor-none"
      onClick={handleStart}
    >
      <Visualizer />

      {!started && (
        <div 
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 pointer-events-auto"
          onClick={handleStart}
        />
      )}

      <style>{`
        body, .cursor-none {
          cursor: none;
        }
      `}</style>
    </div>
  );
};

export default App;