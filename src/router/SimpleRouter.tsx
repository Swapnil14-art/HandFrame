import React, { useEffect, useState } from 'react';
import { LandingPage } from '../components/LandingPage';
import { CameraView } from '../components/CameraView';
import { UnlistedFilterEditor } from '../components/UnlistedFilterEditor';

// Configurable unlisted route path defaulting to /aesthetic14
const UNLISTED_ROUTE_PATH = (import.meta.env.VITE_FILTER_EDITOR_PATH || '/aesthetic14').replace(/^\/+/, '');

export const SimpleRouter: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState<'landing' | 'camera' | 'unlisted-editor'>('landing');

  useEffect(() => {
    const parseLocation = () => {
      const pathname = window.location.pathname.replace(/^\/+/, '');
      const hash = window.location.hash.replace(/^#\/*/, '');

      const activePath = hash || pathname;

      if (activePath === UNLISTED_ROUTE_PATH || activePath.startsWith(UNLISTED_ROUTE_PATH)) {
        setCurrentRoute('unlisted-editor');
      } else if (activePath === 'camera') {
        setCurrentRoute('camera');
      } else {
        setCurrentRoute('landing');
      }
    };

    parseLocation();
    window.addEventListener('popstate', parseLocation);
    window.addEventListener('hashchange', parseLocation);

    return () => {
      window.removeEventListener('popstate', parseLocation);
      window.removeEventListener('hashchange', parseLocation);
    };
  }, []);

  const navigateTo = (route: 'landing' | 'camera' | 'unlisted-editor') => {
    setCurrentRoute(route);
    if (route === 'landing') {
      window.history.pushState({}, '', '/');
    } else if (route === 'camera') {
      window.history.pushState({}, '', '/camera');
    } else if (route === 'unlisted-editor') {
      window.history.pushState({}, '', `/${UNLISTED_ROUTE_PATH}`);
    }
  };

  switch (currentRoute) {
    case 'camera':
      return <CameraView onBackToLanding={() => navigateTo('landing')} />;

    case 'unlisted-editor':
      return (
        <UnlistedFilterEditor
          onLaunchCamera={() => navigateTo('camera')}
          onGoHome={() => navigateTo('landing')}
        />
      );

    case 'landing':
    default:
      return <LandingPage onStartCamera={() => navigateTo('camera')} />;
  }
};
