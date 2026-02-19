/**
 * useMembers Hook
 * Thin React wrapper around MemberModel
 */

import { useState, useEffect, useCallback } from 'react';
import { getMembers, getMemberById, updateMember } from '../models/MemberModel';
import type { User } from '../schemas';

export function useMembers() {
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMembers();
      setMembers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const update = useCallback(async (id: string, memberData: Partial<User>) => {
    try {
      const updatedMember = await updateMember(id, memberData);
      setMembers(prev => prev.map(m => m.id === id ? updatedMember : m));
      return updatedMember;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update member');
      throw err;
    }
  }, []);

  return {
    members,
    loading,
    error,
    fetchMembers,
    updateMember: update,
    getMemberById,
  };
}
