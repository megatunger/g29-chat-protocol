'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useKeys } from '@/contexts/KeyContext';

interface LoginPageProps {
  onLoginSuccess: (userId: string) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [serverId, setServerId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const { generateKeysAuto, isGenerating } = useKeys();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim() || !password.trim()) {
      setError('Both User ID and password are required');
      return;
    }

    setIsConnecting(true);
    setError('');

    try {
      // First, authenticate with server
      const authResponse = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: userId,
          password: password,
        }),
      });

      if (!authResponse.ok) {
        throw new Error('Authentication failed');
      }

      const authData = await authResponse.json();
      const { sessionToken, userID, challenge } = authData;

      // Generate keys automatically after successful authentication
      await generateKeysAuto(userID);
      
      // Store secure session data
      sessionStorage.setItem('sessionToken', sessionToken);
      sessionStorage.setItem('userID', userID);
      sessionStorage.setItem('challenge', challenge);
      
      onLoginSuccess(userID);
    } catch (error) {
      console.error('Login failed:', error);
      setError('Invalid credentials. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const isLoading = isConnecting || isGenerating;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Secure Chat Login
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your credentials to join the secure chat network
          </p>
        </div>
        
        <div className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-gray-700">
                User ID
              </label>
              <Input
                id="userId"
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter your unique user ID"
                className="mt-1"
                disabled={isLoading}
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="mt-1"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="serverId" className="block text-sm font-medium text-gray-700">
                Server ID
              </label>
              <Input
                id="serverId"
                type="text"
                value={serverId}
                onChange={(e) => setServerId(e.target.value)}
                placeholder="Enter server ID to connect to"
                className="mt-1"
                disabled={isLoading}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <Button
              onClick={handleLogin}
              disabled={isLoading || !userId.trim() || !password.trim() || !serverId.trim()}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isGenerating ? 'Generating Keys...' : 'Authenticating...'}
                </span>
              ) : (
                'Secure Login'
              )}
            </Button>
          </div>

          {isLoading && (
            <div className="text-center text-sm text-gray-600">
              <p>🔐 Automatically generating RSA-4096 keys...</p>
              <p>This may take a moment for security purposes.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}