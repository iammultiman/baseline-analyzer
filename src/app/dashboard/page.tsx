'use client';

import { useAuth } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/protected-route';
import { Navigation } from '@/components/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <Navigation />
            
            <Card>
              <CardHeader>
                <CardTitle>Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
              
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-medium text-gray-900 mb-2">Welcome back!</h2>
                  <p className="text-gray-600">
                    You are successfully authenticated as: <strong>{user?.email}</strong>
                  </p>
                  {user?.displayName && (
                    <p className="text-gray-600">
                      Display Name: <strong>{user.displayName}</strong>
                    </p>
                  )}
                  <p className="text-gray-600">
                    Email Verified: <strong>{user?.emailVerified ? 'Yes' : 'No'}</strong>
                  </p>
                </div>

                {!user?.emailVerified && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">
                          Email verification required
                        </h3>
                        <div className="mt-2 text-sm text-yellow-700">
                          <p>Please check your email and click the verification link to access all features.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <h3 className="text-sm font-medium text-blue-800 mb-2">
                    Authentication System Features
                  </h3>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>✅ Email/Password Authentication</li>
                    <li>✅ Google OAuth Integration</li>
                    <li>✅ Email Verification</li>
                    <li>✅ Password Reset</li>
                    <li>✅ Protected Routes</li>
                    <li>✅ Form Validation</li>
                  </ul>
                </div>
              </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}