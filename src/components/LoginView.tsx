import React, { useState } from 'react';
import { LogIn, Sparkles, AlertCircle, ExternalLink } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';

export const LoginView: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('popup') || err.code?.includes('popup')) {
        setError("Sign-in popups are blocked by the preview window. Please open the app in a new tab using the arrow icon in the top right, or check your browser's popup blocker.");
      } else {
        setError(err.message || "Failed to sign in. Please ensure your Firebase configuration is correct and domains are authorized.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 p-8 text-center">
        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome to ReviseAI</h1>
        <p className="text-slate-600 mb-8">Sign in to start creating interactive lessons, structured study notes, and flashcards.</p>
        
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-left">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <LogIn className="w-5 h-5" />
          )}
          <span>{isLoading ? 'Signing in...' : 'Sign in with Google'}</span>
        </button>

        {error && (
           <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500">
             <ExternalLink className="w-4 h-4" />
             <span>Try opening the app in a new tab</span>
           </div>
        )}
      </div>
    </div>
  );
};

