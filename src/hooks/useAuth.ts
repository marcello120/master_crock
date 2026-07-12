'use client';

import { useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { ref, set, get } from 'firebase/database';
import { auth, db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';

export function useAuth() {
  const { user, loading, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return unsubscribe;
  }, [setUser]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    setLoading(true);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });

    // Create user profile in RTDB
    const userRef = ref(db, `users/${cred.user.uid}`);
    const existing = await get(userRef);
    if (!existing.exists()) {
      await set(userRef, { displayName, decks: {} });
    }

    return cred.user;
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return { user, loading, signIn, signUp, signOut };
}
