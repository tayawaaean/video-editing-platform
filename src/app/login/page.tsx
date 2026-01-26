'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Development mode - bypass Supabase auth

      if (DEV_MODE) {
        const response = await fetch('/api/auth/dev-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();
        if (!response.ok) {
          setError(data.error || 'Invalid credentials');
          return;
        }

        // Redirect based on role
        if (data.data?.role === 'admin') {
          router.replace('/admin/dashboard');
        } else if (data.data?.role === 'reviewer') {
          router.replace('/reviewer/dashboard');
        } else if (data.data?.role === 'submitter') {
          router.replace('/submitter/dashboard');
        } else {
          router.replace('/dashboard');
        }
        router.refresh();
        return;
      }

      // Production mode - use Supabase
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white">
      <div className="w-full max-w-4xl bg-transparent p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/90 backdrop-blur rounded-xl shadow-2xl overflow-hidden">
          <aside className="hidden md:flex flex-col justify-center items-start p-8 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white relative overflow-hidden">
            {/* Decorative video elements */}
            <div className="absolute top-8 right-8 opacity-10">
              <svg width="120" height="120" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="5" width="20" height="14" rx="2" stroke="white" strokeWidth="1.5" />
                <path d="M8 9l6 3-6 3V9z" fill="white" />
              </svg>
            </div>
            <div className="absolute bottom-12 right-12 opacity-10">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.5" />
                <path d="M10 8l6 4-6 4V8z" fill="white" />
              </svg>
            </div>

            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="bg-white/10 backdrop-blur-sm p-2 rounded-lg">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <rect x="3" y="6" width="18" height="12" rx="2" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  <path d="M9 10l6 3-6 3V10z" fill="white" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-semibold">{process.env.NEXT_PUBLIC_APP_NAME || 'Video Review'}</h1>
                <p className="text-sm opacity-90">Collaborative video review platform</p>
              </div>
            </div>

            <div className="space-y-4 relative z-10">
              <p className="text-sm opacity-90">Streamline your video workflow with powerful review tools</p>
              
              <div className="flex items-start gap-3 text-sm">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-shrink-0">
                  <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10m0-10l8-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
                </svg>
                <span className="opacity-90">Frame-accurate comments & annotations</span>
              </div>

              <div className="flex items-start gap-3 text-sm">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-shrink-0">
                  <circle cx="12" cy="8" r="3" stroke="white" strokeWidth="2" opacity="0.7" />
                  <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
                </svg>
                <span className="opacity-90">Role-based access & dashboards</span>
              </div>

              <div className="flex items-start gap-3 text-sm">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-shrink-0">
                  <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
                </svg>
                <span className="opacity-90">Real-time collaboration tools</span>
              </div>
            </div>
          </aside>

          <section className="p-8">
            <div className="max-w-md mx-auto">
              <div className="text-center mb-6">
                {/* Video play icon accent */}
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 5v14l11-7L8 5z" fill="#2563eb" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Sign in to your account</h2>
                <p className="mt-1 text-sm text-gray-600">Enter your credentials to continue</p>
              </div>

              <form className="mt-6 space-y-4" onSubmit={handleLogin} noValidate aria-label="Sign in form">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                    {error}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      aria-required
                      aria-invalid={!!error}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                      Password
                    </label>
                    <div className="relative mt-1">
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full px-3 py-2 pr-10 border border-gray-200 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 3l18 18M10.5 10.677a2 2 0 002.823 2.823M7.362 7.561C5.68 8.74 4.279 10.42 3 12c1.889 2.991 5.282 6 9 6 1.55 0 3.043-.523 4.395-1.575M17 17c1.306-1.108 2.292-2.517 3-4-1.889-2.991-5.282-6-9-6-.927 0-1.821.119-2.699.338" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                      <span className="text-gray-600">Remember me</span>
                    </label>

                    <a href="#" className="text-sm text-blue-600 hover:underline">Forgot password?</a>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Signing in...
                      </span>
                    ) : (
                      'Sign in'
                    )}
                  </button>
                </div>
              </form>

              {DEV_MODE && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-xs font-medium text-yellow-800 mb-2">🔧 Development Mode</p>
                  <p className="text-xs text-yellow-700 mb-1">Password: <code className="bg-yellow-100 px-1 rounded">123password</code></p>
                  <p className="text-xs text-yellow-700">Test accounts:</p>
                  <ul className="text-xs text-yellow-700 ml-3 list-disc">
                    <li>admin@example.com</li>
                    <li>reviewer@example.com</li>
                    <li>submitter@example.com</li>
                  </ul>
                </div>
              )}

              <p className="mt-6 text-center text-xs text-gray-500">This is an internal tool. Contact your administrator for access.</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
