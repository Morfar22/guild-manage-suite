import React, { useState, useEffect, useRef } from 'react';
import { Navigate } from '@tanstack/react-router';
import { useSearchParams } from '@/hooks/useSearchParams';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bot, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Helmet } from 'react-helmet-async';
import { z } from 'zod';
import { invokeFunction } from '@/lib/functions-client';

const DISCORD_ORIGIN = 'https://bot.nethost-solutions.dk';
const DISCORD_REDIRECT_URI = `${DISCORD_ORIGIN}/auth`;

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const DiscordIcon = React.forwardRef<SVGSVGElement, { className?: string }>(
  ({ className }, ref) => (
    <svg ref={ref} className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
);
DiscordIcon.displayName = 'DiscordIcon';

export default function Auth() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const processingCodeRef = useRef(false);

  useEffect(() => {
    const code = searchParams.get('code');
    if (code && !processingCodeRef.current) {
      processingCodeRef.current = true;
      window.history.replaceState({}, document.title, '/auth');
      handleDiscordCallback(code);
      return;
    }

    if (searchParams.get('startDiscord') === 'true') {
      window.history.replaceState({}, document.title, '/auth');
      handleDiscordLogin();
    }
  }, [searchParams]);

  const handleDiscordCallback = async (code: string) => {
    setDiscordLoading(true);
    setError(null);
    try {
      const redirectUri = DISCORD_REDIRECT_URI;
      const response = await invokeFunction('discord-oauth?action=callback', {
        body: { code, redirectUri },
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.error) throw new Error(response.error.message || 'Discord OAuth failed');
      const data = response.data;
      if (data.error) throw new Error(data.error);
      if (data.token_hash) {
        const { error: signInError } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
        if (signInError) {
          await supabase.auth.signInWithOtp({ email: data.user.email });
          toast.success(`Welcome ${data.user.discord_username}! Check your email to complete sign in.`);
        } else {
          toast.success(`Welcome ${data.user.discord_username}! ${data.guilds} servers synced.`);
        }
      } else {
        await supabase.auth.signInWithOtp({ email: data.user.email });
        toast.success(`Welcome ${data.user.discord_username}! Check your email to complete sign in.`);
      }
    } catch (err: any) {
      console.error('Discord OAuth error:', err);
      setError(err.message || 'Failed to complete Discord login');
    } finally {
      setDiscordLoading(false);
      processingCodeRef.current = false;
    }
  };

  const handleDiscordLogin = async () => {
    if (window.location.origin !== DISCORD_ORIGIN) {
      window.location.assign(`${DISCORD_REDIRECT_URI}?startDiscord=true`);
      return;
    }

    setDiscordLoading(true);
    setError(null);
    try {
      const redirectUri = DISCORD_REDIRECT_URI;
      const response = await invokeFunction('discord-oauth?action=authorize', {
        body: { redirectUri },
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.error) throw new Error(response.error.message || 'Failed to start Discord login');
      const data = response.data;
      if (data.error) throw new Error(data.error);
      window.location.assign(data.url);
    } catch (err: any) {
      console.error('Discord login error:', err);
      setError(err.message || 'Failed to start Discord login');
      setDiscordLoading(false);
    }
  };

  if (loading || discordLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          {discordLoading && (
            <p className="mt-4 text-muted-foreground">
              {searchParams.get('code') ? t('auth.completingDiscord') : t('auth.redirectingDiscord')}
            </p>
          )}
        </div>
      </main>
    );
  }

  if (user) return <Navigate to="/guilds" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) { setError(validation.error.errors[0].message); return; }
    setSubmitting(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success(t('auth.welcome'));
      } else {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/` } });
        if (error) throw error;
        toast.success(t('auth.accountCreated'));
        setIsLogin(true);
      }
    } catch (err: any) {
      if (err.message === 'User already registered') setError(t('auth.emailRegistered'));
      else if (err.message === 'Invalid login credentials') setError(t('auth.invalidCredentials'));
      else setError(err.message || t('auth.genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Helmet>
        <title>Log ind — Paranox Discord Bot Platform</title>
        <meta name="description" content="Log ind på Paranox med Discord for at administrere din server: moderation, tickets, AI, leveling og meget mere." />
        <link rel="canonical" href="https://bot.nethost-solutions.dk/auth" />
        <meta property="og:url" content="https://bot.nethost-solutions.dk/auth" />
        <meta property="og:title" content="Log ind — Paranox Discord Bot Platform" />
        <meta property="og:description" content="Log ind på Paranox med Discord for at administrere din server." />
      </Helmet>
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl gradient-blurple shadow-glow" aria-hidden="true">
            <Bot className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Paranox — Discord Bot Management</h1>
          <p className="mt-2 text-muted-foreground">{t('auth.subtitle')}</p>
        </div>

        <div className="mb-6">
          <Button onClick={handleDiscordLogin} disabled={discordLoading} className="w-full bg-[#5865F2] text-white hover:bg-[#4752C4] h-12 text-base font-medium">
            {discordLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <DiscordIcon className="mr-2 h-5 w-5" />}
            {t('auth.continueDiscord')}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">{t('auth.discordRecommended')}</p>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">{t('auth.orEmail')}</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" /><p>{error}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:ring-primary" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:ring-primary" required />
            </div>
            <Button type="submit" variant="secondary" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isLogin ? t('auth.login') : t('auth.signup')}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button type="button" onClick={() => { setIsLogin(!isLogin); setError(null); }} className="text-sm text-muted-foreground hover:text-primary transition-colors">
              {isLogin ? t('auth.noAccount') : t('auth.hasAccount')}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">{t('auth.terms')}</p>
      </div>
    </main>
  );
}
