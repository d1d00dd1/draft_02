// #region agent log
console.log('[DEBUG-B] App.tsx: Starting imports');
// #endregion

import React, { useState } from 'react';

// #region agent log
console.log('[DEBUG-B] App.tsx: React imported', { hasReact: !!React, hasUseState: !!useState });
// #endregion

import Visualizer from './components/Visualizer';

// #region agent log
console.log('[DEBUG-B] App.tsx: Visualizer imported', { hasVisualizer: !!Visualizer });
// #endregion

import { audioEngine } from './services/AudioEngine';

// #region agent log
console.log('[DEBUG-B] App.tsx: All imports complete', { hasAudioEngine: !!audioEngine });
// #endregion

const App: React.FC = () => {
  // #region agent log
  console.log('[DEBUG-A] App.tsx: Component rendering');
  // #endregion

  const [started, setStarted] = useState(false);

  const handleStart = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/2f539a89-c611-48c4-abc8-28e976db483b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:20',message:'handleStart called',data:{started,hasMediaDevices:!!navigator.mediaDevices},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    if (!started) {
      try {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/2f539a89-c611-48c4-abc8-28e976db483b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:24',message:'Before getUserMedia',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion

        await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/2f539a89-c611-48c4-abc8-28e976db483b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:27',message:'After getUserMedia, before audioEngine.init',data:{hasAudioEngine:!!audioEngine,hasInit:!!audioEngine.init},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion

        await audioEngine.init();

        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/2f539a89-c611-48c4-abc8-28e976db483b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:30',message:'After audioEngine.init',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion

        audioEngine.setPresence(true);
        setStarted(true);

        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/2f539a89-c611-48c4-abc8-28e976db483b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:34',message:'handleStart completed successfully',data:{started:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion

      } catch (err) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/2f539a89-c611-48c4-abc8-28e976db483b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:37',message:'ERROR in handleStart',data:{error:err instanceof Error?err.message:String(err),errorName:err instanceof Error?err.name:'unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion

        console.error("Initialization failed:", err);
      }
    }
  };

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/2f539a89-c611-48c4-abc8-28e976db483b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:42',message:'App render return',data:{started,hasVisualizer:!!Visualizer},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  // #region agent log
  React.useEffect(() => {
    fetch('http://127.0.0.1:7243/ingest/2f539a89-c611-48c4-abc8-28e976db483b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:45',message:'App render - before Visualizer',data:{started},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  }, [started]);
  // #endregion

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