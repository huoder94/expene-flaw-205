import { storage } from '@/src/utils/storage';

export const SESSION_TOKEN_KEY = 'finance_session_token';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

if (!BACKEND_URL) {
  console.warn('[api] EXPO_PUBLIC_BACKEND_URL is not defined');
}

let cachedToken: string | null = null;

export const setToken = async (token: string | null) => {
  cachedToken = token;
  if (token) {
    await storage.secureSet(SESSION_TOKEN_KEY, token);
  } else {
    await storage.secureRemove(SESSION_TOKEN_KEY);
  }
};

export const loadToken = async (): Promise<string | null> => {
  if (cachedToken) return cachedToken;
  const stored = await storage.secureGet<string>(SESSION_TOKEN_KEY, '');
  cachedToken = stored && stored.length > 0 ? stored : null;
  return cachedToken;
};

const buildHeaders = (extra: Record<string, string> = {}) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  if (cachedToken) headers.Authorization = `Bearer ${cachedToken}`;
  return headers;
};

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  auth?: boolean;
}

export async function apiFetch<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const url = `${BACKEND_URL}/api${path}`;
  const init: RequestInit = {
    method: opts.method || 'GET',
    headers: buildHeaders(),
  };
  if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
  }
  const res = await fetch(url, init);
  if (res.status === 401) {
    await setToken(null);
    throw new Error('UNAUTHORIZED');
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = data?.detail || `HTTP ${res.status}`;
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }
  return data as T;
}

// ---- Auth ----
export const postAuthSession = (session_id: string) =>
  apiFetch<{ session_token: string; user: any }>('/auth/session', { method: 'POST', body: { session_id } });

export const getMe = () => apiFetch<any>('/auth/me');

export const postLogout = () => apiFetch('/auth/logout', { method: 'POST' });

// ---- Transactions ----
export interface ApiTransaction {
  id: string;
  title: string;
  amount: number;
  type: 'despesa' | 'receita' | 'poupanca';
  category: string;
  date: string;
  monthKey: string;
  icon: string;
  notes?: string;
}

export const listTransactions = () => apiFetch<ApiTransaction[]>('/transactions');

export const createTransaction = (t: Omit<ApiTransaction, 'id'>) =>
  apiFetch<ApiTransaction>('/transactions', { method: 'POST', body: t });

export const updateTransaction = (id: string, t: Omit<ApiTransaction, 'id'>) =>
  apiFetch<ApiTransaction>(`/transactions/${id}`, { method: 'PUT', body: t });

export const deleteTransactionApi = (id: string) =>
  apiFetch(`/transactions/${id}`, { method: 'DELETE' });

// ---- Profile ----
export const getHeaderTitle = () => apiFetch<{ title: string }>('/profile/header-title');
export const setHeaderTitleApi = (title: string) =>
  apiFetch<{ title: string }>('/profile/header-title', { method: 'PUT', body: { title } });

export interface SavingsConfig {
  goal: number;
  initial: number;
}
export const getSavingsConfig = () => apiFetch<SavingsConfig>('/profile/savings-config');
export const setSavingsConfig = (cfg: SavingsConfig) =>
  apiFetch<SavingsConfig>('/profile/savings-config', { method: 'PUT', body: cfg });
