'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from './firebase';
const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (IS_DEMO) {
      // Synthetic demo user (not authenticated server-side)
      setUser({
        uid: 'demo-user',
        email: 'demo@example.com',
        displayName: 'Demo User',
      } as unknown as User);
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const token = await user.getIdToken();
          await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              displayName: user.displayName,
            }),
          });
        } catch (error) {
          console.error('Failed to complete user registration:', error);
        }
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    if (IS_DEMO) return; // no-op in demo
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      throw error;
    }
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    if (IS_DEMO) return; // no-op in demo
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      
      if (displayName && user) {
        await updateProfile(user, { displayName });
      }
      
      // Send email verification
      if (user) {
        await sendEmailVerification(user);
      }
    } catch (error) {
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    if (IS_DEMO) return; // no-op in demo
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    if (IS_DEMO) return; // no-op in demo
    try {
      await signOut(auth);
    } catch (error) {
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    if (IS_DEMO) return; // no-op in demo
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw error;
    }
  };

  const sendVerificationEmail = async () => {
    if (IS_DEMO) return; // no-op in demo
    try {
      if (user) {
        await sendEmailVerification(user);
      }
    } catch (error) {
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    logout,
    resetPassword,
    sendVerificationEmail,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}