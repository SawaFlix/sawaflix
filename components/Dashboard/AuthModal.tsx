'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { createClient } from '@/utils/supabase/client';
import Image from 'next/image';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional contextual message, e.g. "to like this video" */
  promptMessage?: string;
}

export default function AuthModal({ isOpen, onClose, promptMessage = 'to continue on SawaFlix' }: AuthModalProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleCredential = async (credentialResponse: CredentialResponse) => {
    setError(null);

    if (!credentialResponse.credential) {
      setError('Unable to continue with Google right now. Please try again.');
      return;
    }

    setIsGoogleLoading(true);
    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: credentialResponse.credential,
      });

      if (signInError || !data.user) {
        throw signInError || new Error('No user returned from Supabase');
      }

      // Enrich public.users row with metadata from Google OAuth ID token
      const meta = data.user.user_metadata ?? {};
      const { error: syncError } = await supabase.from('users').upsert(
        {
          id: data.user.id,
          email: data.user.email,
          username: meta.full_name || meta.name || data.user.email?.split('@')[0] || 'User',
          profile_image_url: meta.avatar_url || meta.picture || null,
          verification_status: 'approved',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
      if (syncError) console.error('Profile sync warning:', syncError.message);

      router.refresh();
      onClose();
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      setError(err?.message || 'Unable to continue with Google right now. Please try again.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            key="auth-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md cursor-pointer"
          />

          {/* Modal Card */}
          <motion.div
            key="auth-modal-card"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            className="relative z-10 w-full max-w-[390px] bg-[#0E121A]/95 border border-white/10 rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.85)] p-6 sm:p-7 flex flex-col items-center backdrop-blur-2xl overflow-hidden"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer z-30"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            {/* Logo */}
            <div className="relative w-32 h-10 mb-5 flex items-center justify-center">
              <Image 
                src="/logos_and_pwas/headerLogo..png" 
                alt="SawaFlix" 
                width={160}
                height={40}
                className="h-8 w-auto object-contain" 
                priority
              />
            </div>

            {/* Heading & Subtitle */}
            <div className="text-center space-y-2 mb-6">
              <h2 className="text-white font-bold text-xl sm:text-[22px] tracking-tight">
                Sign in {promptMessage}
              </h2>
              <p className="text-zinc-400 text-xs sm:text-[13px] leading-relaxed max-w-[280px] mx-auto">
                Join thousands watching and sharing authentic Cameroonian entertainment.
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div className="w-full mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-medium">
                {error}
              </div>
            )}

            {/* Google Sign In Button — GIS Client-Side Popup with ID Token */}
            <div className="relative w-full mb-5 overflow-hidden rounded-xl">
              {/* Styled visible button */}
              <div className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl bg-white text-[#0E121A] font-bold text-sm shadow-md transition-all duration-200 pointer-events-none border border-white/20">
                {isGoogleLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-zinc-600" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 18 18" fill="none" className="shrink-0">
                      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908C16.612 14.417 17.64 12 17.64 9.2z" fill="#4285F4" />
                      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853" />
                      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A9.009 9.009 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
                      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335" />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </div>

              {/* Real Google Identity Services interactive button on top, scaled to cover entire button bounds */}
              {!isGoogleLoading && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 cursor-pointer overflow-hidden z-20 transform scale-[1.35] origin-center [&>div]:w-full! [&_iframe]:cursor-pointer">
                  <GoogleLogin
                    onSuccess={handleGoogleCredential}
                    onError={() => setError('Unable to continue with Google right now. Please try again.')}
                    width="400"
                    theme="filled_black"
                    shape="rectangular"
                  />
                </div>
              )}
            </div>

            {/* Terms and Privacy Footer */}
            <p className="text-zinc-500 text-[11px] text-center leading-relaxed">
              By continuing, you agree to our{' '}
              <a href="/terms" className="text-zinc-300 hover:text-white underline transition-colors" target="_blank" rel="noreferrer">
                Terms
              </a>{' '}
              and{' '}
              <a href="/privacy" className="text-zinc-300 hover:text-white underline transition-colors" target="_blank" rel="noreferrer">
                Privacy Policy
              </a>
              .
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
