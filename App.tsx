import React, { useState } from 'react';
import Visualizer from './components/Visualizer';
import { audioEngine } from './services/AudioEngine';

function App() {
  const [started, setStarted] = useState(false);

  const handleStart = async () => {
    if (started) return;
    setStarted(true);

    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    console.log('[App] Start clicked', { ua, isIOS });

    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log('[App] Media permissions granted');
    } catch (e) {
      console.warn('[App] Media permission error', e);
    }

    try {
      await audioEngine.init();
      console.log('[App] Audio engine initialized');
      
      if (audioEngine.ctx) {
        if (audioEngine.ctx.state === 'suspended') {
          console.log('[App] AudioContext suspended, attempting resume...');
          await audioEngine.ctx.resume();
          console.log('[App] AudioContext resumed', { state: audioEngine.ctx.state });
        }
      }
      
      audioEngine.setPresence(true);
      console.log('[App] Audio presence set');
    } catch (e) {
      console.error('[App] Audio init error', e);
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