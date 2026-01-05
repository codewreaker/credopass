import { createCollection } from '@tanstack/db'
import { QueryClient } from '@tanstack/query-core'
import {
    queryCollectionOptions
} from '@tanstack/query-db-collection'
import { type UserType } from '../db/schema'


const queryClient = new QueryClient();

const API_BASE = `/api`;



const userCollection = createCollection(
  queryCollectionOptions({
    queryKey: ["users"],
    queryFn: async (): Promise<UserType[]> => {
      const response = await fetch(`${API_BASE}/users`);
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
    getKey: (item) => item.id,
    queryClient: queryClient,
    
    // Handle INSERT
    onInsert: async ({ transaction }) => {
      const { modified: newUser } = transaction.mutations[0];
      console.log('newUser', newUser);
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
  })
);

export { userCollection };