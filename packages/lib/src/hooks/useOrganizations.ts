/**
 * useOrganizations Hook
 * Thin React wrapper around OrganizationModel
 */

import { useState, useEffect, useCallback } from 'react';
import { getOrganizations, createOrganization, switchOrganization } from '../models/OrganizationModel';
import type { Organization } from '../schemas';

export function useOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getOrganizations();
      setOrganizations(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch organizations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const create = useCallback(async (orgData: Partial<Organization>) => {
    try {
      const newOrg = await createOrganization(orgData);
      setOrganizations(prev => [...prev, newOrg]);
      return newOrg;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
      throw err;
    }
  }, []);

  const switchOrg = useCallback(async (organizationId: string) => {
    try {
      const org = await switchOrganization(organizationId);
      return org;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch organization');
      throw err;
    }
  }, []);

  return {
    organizations,
    loading,
    error,
    fetchOrganizations,
    createOrganization: create,
    switchOrganization: switchOrg,
  };
}
