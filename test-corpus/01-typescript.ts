import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { api } from '~/utils/api';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'user' | 'moderator';
  createdAt: Date;
  updatedAt: Date;
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
    language: string;
    timezone: string;
  };
  metadata: Record<string, unknown>;
}

type Action<T> = 
  | { type: 'SET_DATA'; payload: T }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' };

function createReducer<T>() {
  return (state: { data: T | null; loading: boolean; error: string | null }, action: Action<T>) => {
    switch (action.type) {
      case 'SET_DATA':
        return { ...state, data: action.payload, loading: false, error: null };
      case 'SET_LOADING':
        return { ...state, loading: action.payload };
      case 'SET_ERROR':
        return { ...state, error: action.payload, loading: false };
      case 'RESET':
        return { data: null, loading: false, error: null };
      default:
        return state;
    }
  };
}

export function useDataFetching<T>(url: string, options?: RequestInit) {
  const [state, dispatch] = useReducer(createReducer<T>(), {
    data: null,
    loading: false,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const response = await fetch(url, {
        ...options,
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as T;

      if (mountedRef.current) {
        dispatch({ type: 'SET_DATA', payload: data });
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      if (mountedRef.current) {
        dispatch({
          type: 'SET_ERROR',
          payload: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }, [url, options]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [fetchData]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const retry = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return useMemo(
    () => ({ ...state, refetch: fetchData, reset, retry }),
    [state, fetchData, reset, retry]
  );
}
