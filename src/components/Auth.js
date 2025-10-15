// src/components/Auth.js
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import netlifyIdentity from 'netlify-identity-widget';

const isBrowser = typeof window !== 'undefined';

export const useAuth = () => {
  const initedRef = useRef(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // helper: mirror token to a global used elsewhere (e.g., X-App-Token header)
  const setGlobalToken = useCallback((token) => {
    if (!isBrowser) return;
    if (!window.__APP_TOKEN && token) {
      window.__APP_TOKEN = token;
    } else if (window.__APP_TOKEN && !token) {
      delete window.__APP_TOKEN;
    } else if (token) {
      window.__APP_TOKEN = token;
    }
  }, []);

  // get a fresh JWT on demand
  const getJwt = useCallback(async () => {
    const current = netlifyIdentity?.currentUser();
    if (!current) return null;
    try {
      const jwt = await current.jwt();
      setGlobalToken(jwt);
      return jwt;
    } catch {
      return null;
    }
  }, [setGlobalToken]);

  useEffect(() => {
    if (!isBrowser) return;

    // init only once
    if (!initedRef.current) {
      netlifyIdentity.init();
      initedRef.current = true;
    }

    // seed initial state
    const current = netlifyIdentity.currentUser();
    setUser(current);
    setLoading(false);

    // seed global token if logged in
    if (current) {
      current
        .jwt()
        .then((jwt) => setGlobalToken(jwt))
        .catch(() => {});
    } else {
      setGlobalToken(null);
    }

    // handlers
    const handleLogin = (u) => {
      setUser(u);
      // close the widget for better UX
      netlifyIdentity.close();
      // refresh/mirror token
      u?.jwt?.().then((jwt) => setGlobalToken(jwt)).catch(() => {});
    };

    const handleLogout = () => {
      setUser(null);
      setGlobalToken(null);
    };

    // subscribe
    netlifyIdentity.on('login', handleLogin);
    netlifyIdentity.on('logout', handleLogout);

    // cleanup
    return () => {
      netlifyIdentity.off('login', handleLogin);
      netlifyIdentity.off('logout', handleLogout);
    };
  }, [setGlobalToken]);

  const login = useCallback(() => {
    if (!isBrowser) return;
    netlifyIdentity.open('login');
  }, []);

  const signup = useCallback(() => {
    if (!isBrowser) return;
    netlifyIdentity.open('signup');
  }, []);

  const logout = useCallback(() => {
    if (!isBrowser) return;
    netlifyIdentity.logout();
  }, []);

  const isAuthenticated = useMemo(() => !!user, [user]);

  return {
    user,
    loading,
    isAuthenticated,
    login,
    signup,
    logout,
    getJwt, // call when you need a fresh token for a request
  };
};
