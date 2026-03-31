import { defineChain } from 'viem';

export const flowEvmTestnet = defineChain({
  id: 545,
  name: 'Flow EVM Testnet',
  network: 'flow-testnet',
  nativeCurrency: { name: 'FLOW', symbol: 'FLOW', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet.evm.nodes.onflow.org'] },
  },
  testnet: true,
});
