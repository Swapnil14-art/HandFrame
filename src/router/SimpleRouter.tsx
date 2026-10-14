import React, { useEffect, useState } from 'react';
import { LandingPage } from '../components/LandingPage';
import { CameraView } from '../components/CameraView';
import { UnlistedFilterEditor } from '../components/UnlistedFilterEditor';

// Unlisted route for accessing the custom filter creation tool (default: /custom)
const UNLISTED_ROUTE_PATH = (import.meta.env.VITE_FILTER_EDITOR_PATH || '/custom').replace(/^\/+/, '');

/**
 * Lightweight Single-Page App (SPA) Router:
 * Avoids heavy routing libraries (like react-router-dom) while supporting:
 * 1. HTML5 History API (`window.history.pushState` and `popstate` event for back/forward buttons).
 * 2. Hash routing fallback (`hashchange` event) for static hosting environments (e.g. GitHub Pages).
 */
export const SimpleRouter: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState<'landing' | 'camera' | 'unlisted-editor'>('landing');

  useEffect(() => {
    // Parses either window.location.pathname (/camera) or window.location.hash (#/camera)
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

  /**
   * Programmatic client-side navigation updating browser history without page reload.
   */
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

  // Render the view corresponding to the active route
  switch (currentRoute) {
    case 'camera':
      // Live camera feed with 4-point hand tracking, filter compositor, and HUD
      return <CameraView onBackToLanding={() => navigateTo('landing')} />;

    case 'unlisted-editor':
      // Developer / secret editor route for designing custom matrix & convolution filters
      return (
        <UnlistedFilterEditor
          onLaunchCamera={() => navigateTo('camera')}
          onGoHome={() => navigateTo('landing')}
        />
      );

    case 'landing':
    default:
      // Hero onboarding page requesting user gesture before triggering camera permissions
      return <LandingPage onStartCamera={() => navigateTo('camera')} />;
  }
};
