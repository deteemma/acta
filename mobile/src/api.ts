import type { CreateProjectInput, ProjectDto, UpdateProjectInput } from '@app/shared';
import { API_URL } from './config';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function createApi(getToken: () => string) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_URL}/api${path}`, {
      ...init,
      headers: {
        // Fastify refuse un corps JSON vide (ex. DELETE) : en-tête seulement si corps.
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${getToken()}`,
      },
    });
    if (!response.ok) throw new ApiError(response.status, await response.text());
    return (response.status === 204 ? undefined : await response.json()) as T;
  }

  return {
    listProjects: () => request<ProjectDto[]>('/projects'),
    createProject: (input: CreateProjectInput) =>
      request<ProjectDto>('/projects', { method: 'POST', body: JSON.stringify(input) }),
    updateProject: (id: string, input: UpdateProjectInput) =>
      request<ProjectDto>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
  };
}

export type Api = ReturnType<typeof createApi>;
