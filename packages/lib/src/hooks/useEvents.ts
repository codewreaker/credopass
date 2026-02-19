/**
 * useEvents Hook
 * Thin React wrapper around EventModel
 */

import { useState, useEffect, useCallback } from 'react';
import { getEvents, getEventById, createEvent, updateEvent, deleteEvent } from '../models/EventModel';
import type { Event, EventType } from '../schemas';

export function useEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getEvents();
      setEvents(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const create = useCallback(async (eventData: Partial<EventType>) => {
    try {
      const newEvent = await createEvent(eventData);
      setEvents(prev => [...prev, newEvent]);
      return newEvent;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
      throw err;
    }
  }, []);

  const update = useCallback(async (id: string, eventData: Partial<EventType>) => {
    try {
      const updatedEvent = await updateEvent(id, eventData);
      setEvents(prev => prev.map(e => e.id === id ? updatedEvent : e));
      return updatedEvent;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update event');
      throw err;
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      await deleteEvent(id);
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
      throw err;
    }
  }, []);

  return {
    events,
    loading,
    error,
    fetchEvents,
    createEvent: create,
    updateEvent: update,
    deleteEvent: remove,
    getEventById,
  };
}
