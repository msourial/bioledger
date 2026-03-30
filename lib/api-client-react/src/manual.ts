import { customFetch } from "./custom-fetch";

export interface AuraVisionRequest {
  imageBase64: string;
  mimeType?: string;
  challengeType: string;
  bioContext?: {
    hrv: number;
    strain: number;
    apm: number;
  };
}

export interface AuraVisionResponse {
  response: string;
  xpAwarded: number;
  challengeVerified: boolean;
  fallback: boolean;
}

export const auraVision = async (
  body: AuraVisionRequest,
  options?: RequestInit,
): Promise<AuraVisionResponse> => {
  return customFetch<AuraVisionResponse>("/api/aura/vision", {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });
};
