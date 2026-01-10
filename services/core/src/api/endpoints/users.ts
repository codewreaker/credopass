// ============================================================================
// FILE: packages/api-client/src/endpoints/users.ts
// User API endpoints
// ============================================================================

import type { ApiClient } from '../client';
import type { User, CreateUser, UpdateUser } from '@credopass/validation';

export function createUsersApi(client: ApiClient) {
  return {
    /**
     * Get all users
     */
    getAll: () => client.get<User[]>('/api/users'),

    /**
     * Get a user by ID
     */
    getById: (id: string) => client.get<User>(`/api/users/${id}`),

    /**
     * Create a new user
     */
    create: (data: CreateUser) => client.post<User, CreateUser>('/api/users', data),

    /**
     * Update a user
     */
    update: (id: string, data: UpdateUser) =>
      client.put<User, UpdateUser>(`/api/users/${id}`, data),

    /**
     * Delete a user
     */
    delete: (id: string) => client.delete(`/api/users/${id}`),
  };
}

export type UsersApi = ReturnType<typeof createUsersApi>;
