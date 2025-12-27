// #region agent log
console.log('[DEBUG-A] index.tsx: Entry point loaded', { hasDocument: !!document, hasGetElementById: !!document.getElementById });
// #endregion

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// #region agent log
console.log('[DEBUG-A] index.tsx: Imports loaded', { hasReact: !!React, hasReactDOM: !!ReactDOM, hasApp: !!App });
// #endregion

const rootElement = document.getElementById('root');

// #region agent log
console.log('[DEBUG-A] index.tsx: Root element check', { rootElementExists: !!rootElement, rootElementId: rootElement?.id });
// #endregion

if (!rootElement) {
  // #region agent log
  console.error('[DEBUG-A] ERROR: Root element not found');
  // #endregion
  throw new Error("Could not find root element to mount to");
}

// #region agent log
console.log('[DEBUG-A] index.tsx: Before ReactDOM.createRoot', { hasReactDOM: !!ReactDOM, hasCreateRoot: !!ReactDOM.createRoot });
// #endregion

const root = ReactDOM.createRoot(rootElement);

// #region agent log
console.log('[DEBUG-A] index.tsx: Before root.render', { rootCreated: !!root, hasRender: !!root.render });
// #endregion

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// #region agent log
console.log('[DEBUG-A] index.tsx: After root.render - React app mounting');
// #endregion