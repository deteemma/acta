import type { PublicConfigDto } from '@app/shared';
import { ApiError } from './api-error';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://acta.localhost').replace(/\/$/, '');
export const OFFLINE_MODE = process.env.EXPO_PUBLIC_HORS_LIGNE === 'true';

export async function fetchPublicConfig(): Promise<PublicConfigDto> {
  const response = await fetch(`${API_URL}/api/config`);
  if (!response.ok) throw new ApiError(response.status, await response.text());
  return (await response.json()) as PublicConfigDto;
}
