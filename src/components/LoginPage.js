// src/components/LoginPage.js
import React, { useState } from 'react';
import { Shield, RefreshCw } from 'lucide-react';

const LoginPage = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const handleLogin = async () => {
    if (loading) return;
    setErr(null);
    setLoading(true);
    try {
      await onLogin?.();
    } catch (e) {
      setErr(e?.message || 'Sign-in failed. Please try again.');
      setLoading(false); // only clear if we remain on this screen
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center" role="main" aria-busy={loading}>
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-brand-blue rounded-full mb-4">
            <Shield className="text-white" size={48} aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">49 North</h1>
          <p className="text-gray-600 mt-2">Command Center</p>
        </div>

        <div className="space-y-4">
          <p className="text-center text-gray-600">
            Secure access to your business operations dashboard
          </p>

          {err && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm" role="alert">
              {err}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-colors ${
              loading
                ? 'bg-blue-900 text-white opacity-80 cursor-not-allowed'
                : 'bg-brand-blue text-white hover:bg-blue-900'
            }`}
            aria-disabled={loading}
          >
            {loading && <RefreshCw size={18} className="animate-spin" aria-hidden="true" />}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <p className="text-xs text-center text-gray-500 mt-4">
            Access is restricted to invited users only
          </p>
        </div>
      </div>
    </main>
  );
};

export default LoginPage;
