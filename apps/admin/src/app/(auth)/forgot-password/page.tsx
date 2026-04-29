'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('auth/forgot-password', { json: { email } });
    } catch {
      // The endpoint never reveals whether the address exists; treat
      // any error as success too (validation only).
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted p-6">
        <div className="w-full max-w-sm space-y-3 rounded-2xl border bg-background p-8 shadow">
          <h1 className="text-xl font-semibold">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            If <strong>{email}</strong> is registered with us, a password reset link is on the way.
            The link expires in 30 minutes.
          </p>
          <Link href="/login" className="text-sm text-brand hover:underline">
            ← Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border bg-background p-8 shadow"
      >
        <header>
          <h1 className="text-xl font-semibold">Forgot password?</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We'll email you a reset link.
          </p>
        </header>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Email</span>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </Button>
        <Link href="/login" className="block text-center text-sm text-muted-foreground hover:text-brand">
          ← Back to sign in
        </Link>
      </form>
    </main>
  );
}
