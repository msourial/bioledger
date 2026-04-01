import { createPublicClient, createWalletClient, custom, http, parseEther, formatEther, type EIP1193Provider } from 'viem';
import { flowEvmTestnet } from '@/lib/chains';
import { AURA_TOKEN_ABI } from '@/contracts/abi';

// Contract address — set after deployment. For now use env var or fallback.
const AURA_TOKEN_ADDRESS = (import.meta.env.VITE_AURA_TOKEN_ADDRESS as `0x${string}` | undefined)
  ?? '0x0000000000000000000000000000000000000000';

const publicClient = createPublicClient({
  chain: flowEvmTestnet,
  transport: http(),
});

/**
 * Get AURA token balance for an address
 */
export async function getAuraBalance(address: `0x${string}`): Promise<string> {
  try {
    const balance = await publicClient.readContract({
      address: AURA_TOKEN_ADDRESS,
      abi: AURA_TOKEN_ABI,
      functionName: 'balanceOf',
      args: [address],
    });
    return formatEther(balance as bigint);
  } catch (err) {
    console.warn('[AURA Token] Failed to read balance:', err);
    return '0';
  }
}

/**
 * Mint AURA tokens to an address (requires minter wallet)
 * Called when user earns XP from a wellness challenge
 */
export async function mintAuraTokens(
  walletProvider: EIP1193Provider,
  toAddress: `0x${string}`,
  xpAmount: number,
): Promise<{ hash: string | null; amount: string }> {
  const amount = parseEther(String(xpAmount)); // 1 XP = 1 AURA (18 decimals)

  try {
    const client = createWalletClient({
      chain: flowEvmTestnet,
      transport: custom(walletProvider),
    });

    const [account] = await client.getAddresses();
    if (!account) {
      console.warn('[AURA Token] No wallet account available');
      return { hash: null, amount: String(xpAmount) };
    }

    const hash = await client.writeContract({
      account,
      address: AURA_TOKEN_ADDRESS,
      abi: AURA_TOKEN_ABI,
      functionName: 'mint',
      args: [toAddress, amount],
    });

    console.log(`🪙 AURA Token: Minted ${xpAmount} AURA to ${toAddress} — tx: ${hash}`);
    return { hash, amount: String(xpAmount) };
  } catch (err) {
    console.warn('[AURA Token] Mint failed (expected on testnet without gas):', err);
    // Return gracefully — the XP is still tracked off-chain
    return { hash: null, amount: String(xpAmount) };
  }
}

/**
 * Check if token contract is deployed and accessible
 */
export async function isTokenDeployed(): Promise<boolean> {
  if (AURA_TOKEN_ADDRESS === '0x0000000000000000000000000000000000000000') return false;
  try {
    await publicClient.readContract({
      address: AURA_TOKEN_ADDRESS,
      abi: AURA_TOKEN_ABI,
      functionName: 'name',
    });
    return true;
  } catch {
    return false;
  }
}
