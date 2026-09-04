import React from 'react';
import { SimpleRouter } from './router/SimpleRouter';

export const App: React.FC = () => {
  return (
    <div className="w-screen h-dvh bg-black text-white overflow-hidden font-sans select-none">
      <SimpleRouter />
    </div>
  );
};

export default App;
