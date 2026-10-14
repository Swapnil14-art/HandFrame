import React from 'react';
import { SimpleRouter } from './router/SimpleRouter';

/**
 * Root Application Component.
 * Establishes a full-screen viewport with locked bounds to prevent page bounce during touch gestures.
 */
export const App: React.FC = () => {
  return (
    // Outer shell locked to 100vw and 100dvh (dynamic viewport height) with text selection disabled
    <div className="w-screen h-dvh bg-black text-white overflow-hidden font-sans select-none">
      <SimpleRouter />
    </div>
  );
};

export default App;
