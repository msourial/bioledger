import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generate a mock hash for the companion signature
export function generateMockSignature(): string {
  const chars = '0123456789abcdef';
  let hash = '0x';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

// Generate a mock Filecoin CID
export function generateMockCid(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz234567';
  let cid = 'bafy';
  for (let i = 0; i < 55; i++) {
    cid += chars[Math.floor(Math.random() * chars.length)];
  }
  return cid;
}

export function truncateHash(hash: string): string {
  if (!hash || hash.length < 12) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}
