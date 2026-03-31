import { createContext, useContext } from 'react';
import type { EIP1193Provider } from 'viem';

export interface PrivySafeState {
  privyAvailable: boolean;
  authenticated: boolean;
  ready: boolean;
  user: { wallet?: { address: string } } | null;
  login: () => void;
  logout: () => Promise<void>;
  getProvider: () => Promise<EIP1193Provider | null>;
}

const DEFAULT: PrivySafeState = {
  privyAvailable: false,
  authenticated: false,
  ready: false,
  user: null,
  login: () => {},
  logout: async () => {},
  getProvider: async () => null,
};

export const PrivySafeContext = createContext<PrivySafeState>(DEFAULT);

export function usePrivySafe(): PrivySafeState {
  return useContext(PrivySafeContext);
}
