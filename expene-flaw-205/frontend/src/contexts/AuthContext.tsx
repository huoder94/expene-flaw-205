import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { getMe, loadToken, postAuthSession, postLogout, setToken } from '@/src/api/client';

// Required so redirect completes on iOS/Android
WebBrowser.maybeCompleteAuthSession();

export interface AuthUser {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  loginError: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const processedSessionIds = new Set<string>();

const extractSessionId = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const match = url.match(/[?#&]session_id=([^&#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  const finalizeLogin = useCallback(async (sessionId: string) => {
    if (processedSessionIds.has(sessionId)) return;
    processedSessionIds.add(sessionId);
    try {
      const resp = await postAuthSession(sessionId);
      await setToken(resp.session_token);
      setUser(resp.user);
      setLoginError(null);
    } catch (e: any) {
      console.warn('[auth] session exchange failed', e);
      setLoginError('Falha ao fazer login. Tente novamente.');
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const restore = async () => {
      const token = await loadToken();
      if (token) {
        try {
          const me = await getMe();
          if (mounted) setUser(me);
        } catch (e) {
          if (mounted) setUser(null);
        }
      }
      if (mounted) setLoading(false);
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const url = window.location.href;
      const sid = extractSessionId(url);
      if (sid) {
        finalizeLogin(sid).finally(() => {
          try {
            const cleanHash = window.location.hash.replace(/[?#&]?session_id=[^&#]+/, '').replace(/^#/, '');
            const cleanSearch = window.location.search.replace(/[?&]session_id=[^&#]+/, '').replace(/^&/, '?');
            const newUrl = window.location.pathname + (cleanSearch && cleanSearch !== '?' ? cleanSearch : '') + (cleanHash ? '#' + cleanHash : '');
            window.history.replaceState(window.history.state, '', newUrl);
          } catch {}
          restore();
        });
      } else {
        restore();
      }
    } else {
      const sub = Linking.addEventListener('url', ({ url }) => {
        const sid = extractSessionId(url);
        if (sid) finalizeLogin(sid);
      });
      Linking.getInitialURL().then((url) => {
        const sid = extractSessionId(url);
        if (sid) finalizeLogin(sid);
      });
      restore();
      return () => {
        mounted = false;
        sub.remove();
      };
    }

    return () => {
      mounted = false;
    };
  }, [finalizeLogin]);

  const signInWithGoogle = useCallback(async () => {
    setLoginError(null);
    let redirectUrl: string;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      redirectUrl = window.location.origin + '/';
    } else {
      redirectUrl = Linking.createURL('');
    }
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = authUrl;
      return;
    }

    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      const urlFromResult = (result as any)?.url;
      let sid = extractSessionId(urlFromResult);
      if (!sid) {
        const initial = await Linking.getInitialURL();
        sid = extractSessionId(initial);
      }
      if (sid) await finalizeLogin(sid);
    } catch (e) {
      console.warn('[auth] openAuthSession error', e);
      setLoginError('Não foi possível abrir o login. Tente novamente.');
    }
  }, [finalizeLogin]);

  const logout = useCallback(async () => {
    try {
      await postLogout();
    } catch {}
    await setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loginError, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
