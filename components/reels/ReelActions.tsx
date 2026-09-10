'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { Heart, MessageCircle, MoreHorizontal, Share2, Bookmark } from 'lucide-react';
import type { Video } from '@/types/youtube';
import { likeYouTubeVideoAction } from '@/app/actions/youtube';
import { formatCount } from '@/utils/formatCount';
import { useFavorites } from '@/contexts/FavoriteContext';
import { likeService } from '@/services/likeService';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useAuthModal } from '@/contexts/AuthModalContext';

interface ReelActionsProps {
  video: Video;
  commentsCount: number;
  realLikeCount?: string | number;
  realIsLiked?: boolean;
  onShowComments: () => void;
}

function parseCount(value: string | number | undefined): number {
  if (value === undefined) return 0;
  const n = typeof value === 'number' ? value : parseInt(value, 10);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Right-side action rail: like, comment, and a "More" menu (share, save).
 * Like/comment/share/save all call the existing server actions and
 * favorites context — nothing here reimplements backend logic.
 */
export function ReelActions({ video, commentsCount, realLikeCount, realIsLiked, onShowComments }: ReelActionsProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(() => parseCount(video.likeCount));
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [, startTransition] = useTransition();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isAuthenticated } = useAuthSession();
  const { openAuthModal } = useAuthModal();

  const saved = isFavorite(video.id);

  // Hydrate liked+likeCount from the server once, the first time real values
  // arrive — locked out permanently once the user taps like (see handleLike),
  // so a late/slow stats response can never undo their optimistic tap.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    if (realIsLiked !== undefined) {
      setLiked(realIsLiked);
      hydratedRef.current = true;
    }
    if (realLikeCount !== undefined) {
      setLikeCount(parseCount(realLikeCount));
    }
  }, [realIsLiked, realLikeCount]);

  const handleLike = () => {
    if (!isAuthenticated) {
      openAuthModal('to like reels');
      return;
    }

    hydratedRef.current = true;
    const nextLiked = !liked;
    // Optimistic update — rolled back if the server action throws.
    setLiked(nextLiked);
    setLikeCount((prev) => prev + (nextLiked ? 1 : -1));

    startTransition(async () => {
      try {
        await likeYouTubeVideoAction(video.id, video.origin ?? 'youtube');
      } catch (err) {
        console.error('[ReelActions] Like failed:', err);
        setLiked(!nextLiked);
        setLikeCount((prev) => prev + (nextLiked ? -1 : 1));
        return;
      }
      // Additive: persist locally too so profile "likes given" stats can
      // count it. The external backend call above is unchanged either way.
      try {
        if (nextLiked) await likeService.like('youtube_video', video.id);
        else await likeService.unlike('youtube_video', video.id);
      } catch (err) {
        console.warn('[ReelActions] local like persistence failed:', err);
      }
    });
  };

  const handleShare = async () => {
    setIsMoreOpen(false);
    const url = video.videoUrl;
    try {
      if (navigator.share) {
        await navigator.share({ title: video.title, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch (err) {
      // User cancelling the native share sheet also rejects — not an error.
      if ((err as Error)?.name !== 'AbortError') {
        console.error('[ReelActions] Share failed:', err);
      }
    }
  };

  const handleSave = () => {
    if (!isAuthenticated) {
      openAuthModal('to save reels to your favorites');
      return;
    }
    toggleFavorite(video);
    setIsMoreOpen(false);
  };

  return (
    <div className="pointer-events-auto absolute bottom-10 right-3 z-20 flex flex-col items-center gap-5">
      <button
        type="button"
        onClick={handleLike}
        aria-label={liked ? 'Unlike' : 'Like'}
        aria-pressed={liked}
        className="group flex flex-col items-center gap-1 text-white"
      >
        <span
          className={`relative flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-md transition-all active:scale-85 ${
            liked
              ? 'bg-red-500/20 ring-2 ring-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] scale-105'
              : 'bg-black/40 hover:bg-black/60'
          }`}
        >
          <Image
            src="/logos_and_pwas/like.png"
            alt="Like"
            width={32}
            height={32}
            priority
            className={`w-7 h-7 object-contain transition-transform duration-200 select-none ${
              liked ? 'scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'opacity-85 group-hover:opacity-100 group-hover:scale-105'
            }`}
          />
        </span>
        <span className="text-xs font-bold drop-shadow font-mono tracking-tight">{formatCount(likeCount)}</span>
      </button>

      <button
        type="button"
        onClick={() => {
          if (!isAuthenticated) {
            openAuthModal('to view and post comments');
            return;
          }
          onShowComments();
        }}
        aria-label="View comments"
        className="flex flex-col items-center gap-1 text-white"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/30 backdrop-blur-md transition-transform active:scale-90">
          <MessageCircle size={24} />
        </span>
        <span className="text-xs font-bold drop-shadow">{formatCount(commentsCount)}</span>
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsMoreOpen((prev) => !prev)}
          aria-label="More options"
          aria-haspopup="menu"
          aria-expanded={isMoreOpen}
          className="flex flex-col items-center gap-1 text-white"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/30 backdrop-blur-md transition-transform active:scale-90">
            <MoreHorizontal size={24} />
          </span>
        </button>

        {isMoreOpen && (
          <>
            {/* Backdrop — closes the menu on any outside tap. */}
            <div className="fixed inset-0 z-10" onClick={() => setIsMoreOpen(false)} aria-hidden="true" />

            <div
              role="menu"
              className="absolute bottom-full right-0 z-20 mb-3 w-44 overflow-hidden rounded-2xl border border-white/10 bg-[#181A20] shadow-2xl"
            >
              <button
                type="button"
                role="menuitem"
                onClick={handleShare}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                <Share2 size={18} />
                Share
              </button>
              <button
                type="button"
                role="menuitemcheckbox"
                onClick={handleSave}
                aria-checked={saved}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                <Bookmark size={18} className={saved ? 'fill-white' : ''} />
                {saved ? 'Saved' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
