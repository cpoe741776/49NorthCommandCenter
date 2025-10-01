// src/components/LoginPage.js
import React from 'react';
import { Shield } from 'lucide-react';

const LoginPage = ({ onLogin }) => {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-brand-blue rounded-full mb-4">
            <Shield className="text-white" size={48} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">49 North</h1>
          <p className="text-gray-600 mt-2">Command Center</p>
        </div>
        
        <div className="space-y-4">
          <p className="text-center text-gray-600">
            Secure access to your business operations dashboard
          </p>
          
          <button
            onClick={onLogin}
            className="w-full bg-brand-blue text-white py-3 rounded-lg font-semibold hover:bg-blue-900 transition-colors"
          >
            Sign In
          </button>
          
          <p className="text-xs text-center text-gray-500 mt-4">
            Access is restricted to authorized personnel only
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;