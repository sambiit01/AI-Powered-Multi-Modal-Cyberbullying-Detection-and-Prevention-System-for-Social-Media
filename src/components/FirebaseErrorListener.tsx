'use client';

/**
 * @fileOverview Listens for FirestorePermissionError events and displays them.
 * This is critical for catching and surfacing security rule denials during development.
 */

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: any) => {
      // In development, we want these to be loud.
      // They will trigger the Next.js error overlay if unhandled,
      // which is exactly what we want for debugging rules.
      console.error(error.message);
      
      toast({
        variant: 'destructive',
        title: 'Security Rule Denied',
        description: `Operation "${error.context.operation}" failed at ${error.context.path}. Check your Firestore rules.`,
      });

      // Throwing here will trigger the Next.js Error Overlay in development
      if (process.env.NODE_ENV === 'development') {
        throw error;
      }
    };

    errorEmitter.on('permission-error', handlePermissionError);
    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast]);

  return null;
}
