import React, { useState, useEffect } from 'react';
import Visualizer from './components/Visualizer';
import { audioEngine } from './services/AudioEngine';

function App() {
  const [started, setStarted] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [audioState, setAudioState] = useState<string>('unknown');

  useEffect(() => {
    const updateAudioState = () => {
      if (audioEngine.ctx) {
        setAudioState(audioEngine.ctx.state);
      } else {
        setAudioState('not initialized');
      }
    };
    
    updateAudioState();
    const interval = setInterval(updateAudioState, 500);
    return () => clearInterval(interval);
  }, [started]);

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

  const handleDebugEnableAudio = async () => {
    try {
      if (!audioEngine.ctx) {
        await audioEngine.init();
      }
      if (audioEngine.ctx && audioEngine.ctx.state === 'suspended') {
        await audioEngine.ctx.resume();
        console.log('Audio context resumed:', audioEngine.ctx.state);
      }
      if (!audioEngine.isPlaying) {
        audioEngine.setPresence(true);
      }
    } catch (e) {
      console.error('Debug enable audio error:', e);
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden select-none cursor-none" onClick={handleStart}>
      <Visualizer />
      {!started && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 pointer-events-auto" onClick={handleStart} />
      )}
      
      {/* Debug Mode Toggle - Double tap top right corner */}
      <div 
        className="fixed top-2 right-2 z-50"
        onDoubleClick={() => setDebugMode(!debugMode)}
      >
        {debugMode && (
          <div className="bg-black/80 text-white p-3 rounded border border-white/20 text-xs font-mono">
            <div className="mb-2">
              <div>Audio State: <span className="text-yellow-400">{audioState}</span></div>
              <div>Is Playing: <span className="text-yellow-400">{audioEngine.isPlaying ? 'Yes' : 'No'}</span></div>
              <div>Is Setup: <span className="text-yellow-400">{audioEngine.isSetup ? 'Yes' : 'No'}</span></div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDebugEnableAudio();
              }}
              className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-white text-xs w-full mb-2"
            >
              Enable Audio
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDebugMode(false);
              }}
              className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-white text-xs w-full"
            >
              Close
            </button>
          </div>
        )}
        {!debugMode && (
          <div className="text-white/30 text-xs">Double tap for debug</div>
        )}
      </div>
      
      <style>{`body, .cursor-none { cursor: none; }`}</style>
    </div>
  );
}

export default App;