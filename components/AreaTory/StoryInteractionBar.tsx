'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Share2, Check } from 'lucide-react';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useCommentSidebar } from './CommentSidebarContext';
import { useAuthModal } from '@/contexts/AuthModalContext';

interface StoryInteractionBarProps {
  storyId: string;
  storyTitle: string;
  initialLikes: number;
  initialComments: number;
  initialIsLiked?: boolean;
}

export default function StoryInteractionBar({
  storyId,
  storyTitle,
  initialLikes,
  initialComments,
  initialIsLiked = false,
}: StoryInteractionBarProps) {
  const { isAuthenticated } = useAuthSession();
  const { openAuthModal } = useAuthModal();

  const [liked, setLiked] = useState(initialIsLiked);
  const [likesCount, setLikesCount] = useState(initialLikes);
  const [isLiking, setIsLiking] = useState(false);
  const [copied, setCopied] = useState(false);

  // Synchronize state if initialLikes or initialIsLiked changes on props
  useEffect(() => {
    setLiked(initialIsLiked);
    setLikesCount(initialLikes);
  }, [initialLikes, initialIsLiked]);

  const handleToggleLike = async () => {
    if (!isAuthenticated) {
      openAuthModal('to like this story on Area Tory');
      return;
    }

    if (isLiking) return;
    setIsLiking(true);

    const nextLiked = !liked;
    const nextCount = Math.max(0, likesCount + (nextLiked ? 1 : -1));

    // Optimistic UI update
    setLiked(nextLiked);
    setLikesCount(nextCount);

    try {
      const res = await fetch(`/api/stories/${encodeURIComponent(storyId)}/like`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (typeof data.liked === 'boolean') setLiked(data.liked);
      if (typeof data.likesCount === 'number') setLikesCount(data.likesCount);
    } catch (err) {
      console.error('[StoryInteractionBar] Like failed:', err);
      // Revert optimistic update
      setLiked(!nextLiked);
      setLikesCount(likesCount);
    } finally {
      setIsLiking(false);
    }
  };

  // Open comment sidebar via context
  const { open } = useCommentSidebar();
  const handleOpenComments = () => {
    open(storyId, storyTitle, initialComments);
  };

  const handleShare = async () => {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (navigator.share) {
        await navigator.share({
          title: storyTitle,
          text: `Check out "${storyTitle}" on SawaFlix Area Tory!`,
          url: currentUrl,
        });
      } else {
        await navigator.clipboard.writeText(currentUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      // User cancelled share sheet
    }
  };

  return (
    <div className="flex items-center gap-2 sm:gap-3 select-none flex-wrap">
      {/* Primary Like Button with Custom Cameroon Like icon */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={handleToggleLike}
        className={`group flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border transition-all duration-300 cursor-pointer shadow-sm ${
          liked
            ? 'bg-red-500/15 border-red-500/40 text-red-500 shadow-[0_0_15px_rgba(229,9,20,0.25)] ring-1 ring-red-500/30'
            : 'bg-white/5 border-white/10 text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20'
        }`}
        aria-label={liked ? 'Unlike story' : 'Like story'}
        title="Like story"
      >
        <motion.div
          animate={liked ? { scale: [1, 1.35, 0.92, 1] } : { scale: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="flex items-center gap-1.5"
        >
          <Image
            src="/logos_and_pwas/like.png"
            alt="Like with Cameroon Flag"
            width={24}
            height={24}
            priority
            className={`w-5 h-5 object-contain transition-transform duration-200 select-none ${
              liked
                ? 'scale-110 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                : 'opacity-85 group-hover:opacity-100 group-hover:scale-105'
            }`}
          />
        </motion.div>
        <span className="text-xs font-bold font-mono tracking-tight text-white/90">
          {likesCount.toLocaleString()}
        </span>
      </motion.button>

      {/* Jump to Comments Button (Opens YouTube/Reels-style right sidebar) */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        onClick={handleOpenComments}
        className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer shadow-sm"
        aria-label="View comments"
        title="Open comments sidebar"
      >
        <MessageCircle className="w-4 h-4 text-gray-400 group-hover:text-white" />
        <span className="text-xs font-bold font-mono tracking-tight text-white/90">
          {initialComments.toLocaleString()}
        </span>
      </motion.button>

      {/* Native / Clipboard Share Button */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        onClick={handleShare}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer shadow-sm"
        title="Share this story"
        aria-label="Share story"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px] font-bold text-emerald-400">Copied!</span>
          </>
        ) : (
          <Share2 className="w-4 h-4 text-gray-400 hover:text-white" />
        )}
      </motion.button>
    </div>
  );
}
