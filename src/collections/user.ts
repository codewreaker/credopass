import { createCollection } from '@tanstack/db'
import { QueryClient } from '@tanstack/query-core'
import {
    queryCollectionOptions
} from '@tanstack/query-db-collection'
import { UserSchema, type User } from '../schemas'


const queryClient = new QueryClient();

const API_BASE = `http://localhost:${import.meta.env.VITE_PORT}/api`;
console.log('=========API_BASE',API_BASE)
export const userCollection = createCollection(
  queryCollectionOptions({
    queryKey: ["users"],
    queryFn: async (): Promise<User[]> => {
      const response = await fetch(`${API_BASE}/users`);
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
    getKey: (item) => item.id,
    queryClient: queryClient,
    
    // Handle INSERT
    onInsert: async ({ transaction }) => {
      const { modified: newUser } = transaction.mutations[0];
      const response = await fetch(`${API_BASE}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      if (!response.ok) throw new Error("Failed to create user");
    },
    
    // Handle UPDATE
    onUpdate: async ({ transaction }) => {
      const { original, modified } = transaction.mutations[0];
      const response = await fetch(`${API_BASE}/users/${original.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modified),
      });
      if (!response.ok) throw new Error("Failed to update user");
    },
    
    // Handle DELETE
    onDelete: async ({ transaction }) => {
      const { original } = transaction.mutations[0];
      const response = await fetch(`${API_BASE}/users/${original.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete user");
    },
    
    schema: UserSchema,
  })
);