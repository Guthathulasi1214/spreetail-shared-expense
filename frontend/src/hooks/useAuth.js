/**
 * src/hooks/useAuth.js
 *
 * Thin wrapper around AuthContext so components don't need to import
 * both useContext and AuthContext — just "import { useAuth } from '../hooks/useAuth'".
 *
 * Throws if called outside an AuthProvider — catches setup mistakes early.
 */

import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an <AuthProvider>');
  }
  return context;
}
