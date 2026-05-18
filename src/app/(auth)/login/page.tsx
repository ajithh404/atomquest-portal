'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message === 'Invalid login credentials'
          ? 'Invalid email or password. Please try again.'
          : authError.message
        );
        return;
      }

      if (data.user) {
        // Fetch user profile to determine redirect
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        if (profile?.role === 'admin') {
          router.push('/dashboard');
        } else if (profile?.role === 'manager') {
          router.push('/team');
        } else {
          router.push('/goals');
        }
        router.refresh();
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  function fillDemoCredentials(role: 'employee' | 'manager' | 'admin') {
    setEmail(`${role}@demo.com`);
    setPassword('Demo@1234');
    setError(null);
  }

  return (
    <>
      {/* Login Card */}
      <Card className="w-full rounded-[24px] border border-white/10 bg-white/[0.06] px-2 py-5 shadow-[0_28px_90px_rgba(2,6,23,0.42)] backdrop-blur-2xl sm:px-4">
        <CardHeader className="items-center space-y-4 pb-5 text-center">
          <div className="flex h-[70px] w-[70px] items-center justify-center rounded-[22px] border border-emerald-400/35 bg-emerald-400/10 shadow-[0_0_34px_rgba(16,185,129,0.24)]">
            <Image src="/logo.png" width={46} height={46} alt="AtomQuest logo" className="h-11 w-11 rounded-2xl bg-white object-cover" priority />
          </div>
          <div>
            <CardTitle className="text-[24px] font-extrabold tracking-[-0.5px] text-white">Welcome back</CardTitle>
            <CardDescription className="mt-1 text-sm text-white/56">
            Sign in to your account to continue
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-5 sm:px-6">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-[10px] border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[13px] font-medium text-white/75">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="h-12 rounded-2xl border-white/10 bg-white/10 text-sm text-white placeholder:text-white/35 focus:border-emerald-500 focus:ring-emerald-500/15"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[13px] font-medium text-white/75">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-12 rounded-2xl border-white/10 bg-white/10 pr-10 text-sm text-white placeholder:text-white/35 focus:border-emerald-500 focus:ring-emerald-500/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 transition-colors hover:text-white/75"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="mt-1 h-12 w-full rounded-2xl bg-[#059669] text-base font-bold text-white shadow-[0_16px_34px_rgba(5,150,105,0.32)] transition-all duration-150 hover:bg-[#047857]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          {/* Demo credentials section */}
          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="mb-3 text-center text-xs text-white/40">Quick login with demo accounts</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fillDemoCredentials('employee')}
                className="rounded-[10px] border border-emerald-400/20 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 transition-colors hover:bg-emerald-500/15 hover:text-emerald-200"
              >
                Employee
              </button>
              <button
                type="button"
                onClick={() => fillDemoCredentials('manager')}
                className="rounded-[10px] border border-emerald-400/20 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 transition-colors hover:bg-emerald-500/15 hover:text-emerald-200"
              >
                Manager
              </button>
              <button
                type="button"
                onClick={() => fillDemoCredentials('admin')}
                className="rounded-[10px] border border-emerald-400/20 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 transition-colors hover:bg-emerald-500/15 hover:text-emerald-200"
              >
                Admin
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="mt-6 text-center text-sm text-white/44">
        Your data is encrypted and secure
      </p>
    </>
  );
}
