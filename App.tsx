import React, { useState, useEffect } from 'react';
import Visualizer from './components/Visualizer';
import { audioEngine } from './services/AudioEngine';

function App() {
  const [started, setStarted] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const updateDebug = () => {
      const ua = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      setDebugInfo({
        ua: ua.substring(0, 50) + '...',
        isIOS,
        audioCtxState: audioEngine.ctx?.state || 'none',
        isSetup: audioEngine.isSetup,
        isPlaying: audioEngine.isPlaying,
        masterGain: audioEngine.masterGain?.gain.value || 0,
        hasDrone: !!audioEngine.droneOsc,
        timestamp: new Date().toLocaleTimeString()
      });
    };

    const interval = setInterval(updateDebug, 500);
    updateDebug();
    return () => clearInterval(interval);
  }, []);

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
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      
      if (!audioEngine.ctx) {
        audioEngine.ctx = new AC();
        console.log('[App] AudioContext created', { state: audioEngine.ctx.state, isIOS });
      }
      
      if (audioEngine.ctx.state === 'suspended') {
        await audioEngine.ctx.resume();
        console.log('[App] AudioContext resumed', { state: audioEngine.ctx.state });
      }
      
      if (isIOS) {
        try {
          const buffer = audioEngine.ctx.createBuffer(1, 1, 22050);
          const source = audioEngine.ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(audioEngine.ctx.destination);
          source.start(0);
          console.log('[App] Silent audio played to unlock iOS audio');
        } catch (e) {
          console.error('[App] Failed to unlock audio', e);
        }
      }
      
      await audioEngine.init();
      console.log('[App] Audio engine initialized');
      
      if (audioEngine.ctx.state === 'suspended') {
        await audioEngine.ctx.resume();
        console.log('[App] AudioContext resumed again', { state: audioEngine.ctx.state });
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
      
      <div className="absolute top-2 left-2 z-50 bg-black/80 text-white text-xs font-mono p-2 rounded max-w-xs">
        <div>iOS: {debugInfo.isIOS ? 'YES' : 'NO'}</div>
        <div>AudioCtx: {debugInfo.audioCtxState}</div>
        <div>Setup: {debugInfo.isSetup ? 'YES' : 'NO'}</div>
        <div>Playing: {debugInfo.isPlaying ? 'YES' : 'NO'}</div>
        <div>Gain: {debugInfo.masterGain?.toFixed(2) || '0'}</div>
        <div>Drone: {debugInfo.hasDrone ? 'YES' : 'NO'}</div>
        <div className="text-[8px] mt-1 opacity-60">{debugInfo.ua}</div>
      </div>

      <style>{`body, .cursor-none { cursor: none; }`}</style>
    </div>
  );
}

export default App;