import React, { useEffect, useState } from 'react';
import Visualizer from './components/Visualizer';
import { audioEngine } from './services/AudioEngine';

function App() {
  const [started, setStarted] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const handleStart = async () => {
    if (started) return;
    setStarted(true);
    
    try {
      const [nextStream] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: true, audio: false }).catch(() => null),
        audioEngine.init().catch(() => {})
      ]);

      if (nextStream) {
        setStream(nextStream);
      }
      
      if (audioEngine.ctx && audioEngine.ctx.state === 'suspended') {
        await audioEngine.ctx.resume();
      }
      
      audioEngine.setPresence(true);
    } catch (e) {
      console.error('Start error:', e);
    }
  };

  return (
    <div
      className="relative w-full h-screen bg-black overflow-hidden select-none cursor-none"
      onClick={handleStart}
      onTouchStart={handleStart}
    >
      <Visualizer stream={stream} />
      {!started && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 pointer-events-auto"
          onClick={handleStart}
          onTouchStart={handleStart}
        />
      )}
      
      <style>{`body, .cursor-none { cursor: none; }`}</style>
    </div>
  );
}

export default App;
