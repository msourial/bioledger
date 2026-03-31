import { useCallback, type ReactNode } from 'react';
import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth';
import { PrivySafeContext, type PrivySafeState } from '@/hooks/use-privy-safe';
import { flowEvmTestnet } from '@/lib/chains';
import type { EIP1193Provider } from 'viem';

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string | undefined;

const NOOP_STATE: PrivySafeState = {
  privyAvailable: false,
  authenticated: false,
  ready: false,
  user: null,
  login: () => {},
  logout: async () => {},
  getProvider: async () => null,
};

function PrivyBridge({ children }: { children: ReactNode }) {
  const privy = usePrivy();
  const { wallets } = useWallets();

  const getProvider = useCallback(async (): Promise<EIP1193Provider | null> => {
    const embedded = wallets.find((w) => w.walletClientType === 'privy');
    if (!embedded) return null;
    try {
      const provider = await embedded.getEthereumProvider();
      return provider as EIP1193Provider;
    } catch {
      return null;
    }
  }, [wallets]);

  const state: PrivySafeState = {
    privyAvailable: true,
    authenticated: privy.authenticated,
    ready: privy.ready,
    user: privy.user,
    login: privy.login,
    logout: privy.logout,
    getProvider,
  };

  return (
    <PrivySafeContext.Provider value={state}>
      {children}
    </PrivySafeContext.Provider>
  );
}

export default function PrivyProviderWrapper({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) {
    return (
      <PrivySafeContext.Provider value={NOOP_STATE}>
        {children}
      </PrivySafeContext.Provider>
    );
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        defaultChain: flowEvmTestnet,
        supportedChains: [flowEvmTestnet],
        appearance: {
          theme: 'dark',
          accentColor: '#8B5CF6',
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
        loginMethods: ['wallet', 'email'],
      }}
    >
      <PrivyBridge>{children}</PrivyBridge>
    </PrivyProvider>
  );
}

export { flowEvmTestnet } from '@/lib/chains';
