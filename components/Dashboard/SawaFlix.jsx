'use client'
import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import {
  Play, Pause, ChevronLeft, ChevronRight,
  Volume2, VolumeX, MessageCircle, Share2, Heart, Loader2,
  X, Send, ThumbsUp, ThumbsDown, RotateCcw, Maximize, Minimize, MoreHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useVideos } from '@/hooks/useVideos';
import { useComments } from '@/hooks/useComments';
import { useVideoStats } from '@/hooks/useVideoStats';
import { YouTubePlayer } from '../YoutubePlayer';
import { youtubeApi } from '@/services/youtubeApi';
import SawaflixLogo from '../SawaflixLogo';
import { useMusic } from '../MusicContext';
import FavoriteButton from '../common/FavoriteButton';
import { playbackService } from '@/services/playbackService';
import { PremiumPaywall } from '../PremiumPaywall';
import DashboardLanding from './DashboardLanding';
import { useAuthModal } from '../../contexts/AuthModalContext';

const CATEGORIES = [
  { id: "all", label: "All", query: "Cameroon shorts viral 2026" },
  { id: "news", label: "News", query: "Cameroon news shorts today" },
  { id: "comedy", label: "Comedy", query: "Cameroon comedy shorts" },
  { id: "tourism", label: "Tourism", query: "Cameroon tourism travel shorts" },
  { id: "music", label: "Music", query: "Cameroon music shorts hits" },
  { id: "heritage", label: "Heritage", query: "Cameroon heritage history shorts" },
  { id: "culture", label: "Culture", query: "Cameroon culture tradition shorts" },
  { id: "cinema", label: "Cinema", query: "Cameroon cinema movies shorts" },
  { id: "announcement", label: "Announcement", query: "Cameroon news announcement shorts" },
];

const HERO_IMAGES = [
  "https://i.ibb.co/WWhx2c0g/sawaflixmusic-cover.png",
  "https://i.ibb.co/k2B50hDM/sawaflixcomedy.png",
  "https://i.ibb.co/j9c5rNnH/Chat-GPT-Image-May-6-2026-02-01-09-PM.png"
];

function formatCount(n) {
  if (!n) return '0';
  const num = parseInt(n, 10);
  if (isNaN(num)) return '0';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return String(num);
}

function fmtTime(secs) {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Search Result Card ───────────────────────
const SearchResultCard = ({ video, onPlay, isShort = false }) => (
  <div
    onClick={() => onPlay(video)}
    className="group flex flex-col gap-3 cursor-pointer transition-all duration-300"
  >
    {/* Thumbnail Container */}
    <div className={`relative ${isShort ? 'aspect-[9/16]' : 'aspect-video'} rounded-2xl overflow-hidden bg-[#12141a] border border-white/5 group-hover:border-white/20 transition-all duration-300`}>
      <Image
        src={video.thumbnail || `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`}
        alt={video.title}
        fill
        className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
        unoptimized
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />

      {/* Play Icon */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 scale-75 group-hover:scale-100 transition-transform duration-500">
          <Play size={24} className="text-white fill-white ml-1" />
        </div>
      </div>

      {/* Duration/Status Badge */}
      <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-1.5 py-0.5 bg-black/80 backdrop-blur-sm rounded text-[10px] font-bold text-white tracking-wider">
        {video.restriction?.mustPay && <Lock size={10} className="text-yellow-500 fill-yellow-500" />}
        {isShort ? 'Saw' : (video.duration || '4:20')}
      </div>
    </div>

    {/* Info Container */}
    <div className="flex gap-3 px-0.5">
      {/* Channel Avatar Placeholder */}
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex-shrink-0 overflow-hidden relative">
        <Image
          src={video.channelThumbnail || `https://api.dicebear.com/7.x/initials/svg?seed=${video.channelTitle}`}
          alt="Avatar"
          fill
          className="object-cover"
        />
      </div>

      <div className="flex flex-col gap-1 min-w-0">
        <h3 className="text-white text-sm font-semibold line-clamp-2 leading-tight group-hover:text-white transition-colors">
          {video.title}
        </h3>
        <div className="flex flex-col text-[12px] text-[#AAAAAA] leading-snug">
          <span className="hover:text-white transition-colors">{video.channelTitle}</span>
          <span className="text-white/40">{formatCount(video.viewCount || Math.floor(Math.random() * 1000000))} views • 2 days ago</span>
        </div>
      </div>
    </div>
  </div>
);

const SkeletonCard = ({ isShort }) => (
  <div className="flex flex-col gap-3 animate-pulse">
    <div className={`w-full rounded-2xl bg-white/5 ${isShort ? 'aspect-[9/16]' : 'aspect-video'}`} />
    <div className="flex gap-3 px-1">
      <div className="w-9 h-9 rounded-full bg-white/5 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-white/5 rounded w-full" />
        <div className="h-3 bg-white/5 rounded w-2/3" />
      </div>
    </div>
  </div>
);

// ─── HTML5 Player ─────────────────────────────────────────────────────────────
const HTML5Player = ({ videoId, videoUrl, isActive, isPaused, isMuted, restriction, onProgress, onPlayerReady, onRestrictionReached }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    // Provide the YouTube-like API to the parent
    if (onPlayerReady) {
      onPlayerReady({
        seekTo: (time) => {
          // Seek protection
          if (restriction?.mustPay && time > restriction.limitSeconds) {
            el.currentTime = restriction.limitSeconds;
          } else {
            el.currentTime = time;
          }
        },
        playVideo: () => { el.play().catch(() => { }); },
        pauseVideo: () => { el.pause(); },
        getCurrentTime: () => el.currentTime,
        getDuration: () => el.duration || 0,
        mute: () => { el.muted = true; },
        unMute: () => { el.muted = false; }
      });
    }
  }, [onPlayerReady, restriction]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (isActive && !isPaused) {
      // Check restriction before playing
      if (restriction?.mustPay && el.currentTime >= restriction.limitSeconds) {
        onRestrictionReached?.();
        return;
      }
      el.play().catch(() => { });
    } else {
      el.pause();
    }
  }, [isActive, isPaused, restriction, onRestrictionReached]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = isMuted;
  }, [isMuted]);

  return (
    <video
      ref={videoRef}
      src={videoUrl}
      className="w-full h-full object-cover"
      playsInline
      loop
      onTimeUpdate={(e) => {
        const ct = e.target.currentTime;
        const dur = e.target.duration || 1;

        // Enforce restriction
        if (restriction?.mustPay && ct >= restriction.limitSeconds) {
          e.target.pause();
          e.target.currentTime = restriction.limitSeconds;
          onRestrictionReached?.();
          return;
        }

        if (onProgress) {
          const remaining = Math.max(0, Math.floor(dur - ct));
          const mins = Math.floor(remaining / 60);
          const secs = remaining % 60;
          const timeLeft = `${mins}:${String(secs).padStart(2, '0')}`;
          onProgress((ct / dur) * 100, timeLeft, ct, dur);
        }
      }}
    />
  );
};

// ─── Video Feed Item ──────────────────────────────────────────────────────────
const VideoFeedItem = ({ video, isActive, isMuted, setIsMuted, isFullscreen, onToggleFullscreen, isAuthenticated, onRequestAuth }) => {
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const [isPaused, setIsPaused] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(parseInt(video.likeCount) || 0);
  const [tapFlash, setTapFlash] = useState(null);
  const [shareToast, setShareToast] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  // Fullscreen state is now passed from parent

  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const scrubberRef = useRef(null);

  // Playback Monetization State
  const [playbackInfo, setPlaybackInfo] = useState(null);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [isPlaybackLoading, setIsPlaybackLoading] = useState(false);

  const playerRef = useRef(null);
  const lastTapRef = useRef({ time: 0, side: null });
  const flashTimer = useRef(null);

  const { stats } = useVideoStats(isActive ? video.id : null);
  const { comments, loading: commentsLoading, isOpen: commentOpen, setIsOpen: setCommentOpen, addComment }
    = useComments(isActive ? video.id : null);

  // Determine if this is a Sawaflix-origin video or YouTube.
  // Every YouTube-sourced object is reliably tagged origin:'youtube' at
  // construction (mapYouTubeItem in useVideos.ts, the /api/videos/[id]
  // route, the direct-fetch path in this file) — but native Sawaflix
  // content isn't always guaranteed to carry the tag. Defaulting to
  // 'youtube' meant any native video missing that field got handed to
  // YouTubePlayer with its Supabase UUID as the videoId, which the
  // YouTube IFrame API rejects as invalid. Default to the platform's own
  // content type instead, since that's the safer assumption here.
  const videoOrigin = video.origin === 'youtube' ? 'youtube' : 'sawaflix';

  // Fetch Playback Source through Gatekeeper when video becomes active
  useEffect(() => {
    if (isActive) {
      const fetchPlayback = async () => {
        setIsPlaybackLoading(true);
        try {
          // Provide fallback URL for YouTube or local Sawaflix content
          const fallback = video.videoUrl || (videoOrigin === 'youtube' ? `https://www.youtube.com/watch?v=${video.id}` : null);
          const info = await playbackService.getPlaybackSource(video.id, fallback);
          setPlaybackInfo(info);
        } catch (err) {
          console.error('[Playback] Gatekeeper Error:', err);
        } finally {
          setIsPlaybackLoading(false);
        }
      };
      fetchPlayback();
    }
  }, [isActive, video.id, video.videoUrl, videoOrigin]);

  const handleUnlock = async (method) => {
    // In a real app, you'd initiate the payment with the provider here.
    // We'll simulate a successful payment after 3 seconds.
    try {
      // Simulate verification after a delay
      const info = await playbackService.verifyPayment(video.id, `sim-${Date.now()}`);
      setPlaybackInfo(info);
      setIsPaywallOpen(false);
      setIsPaused(false); // Resume playback
    } catch (err) {
      console.error('Unlock failed:', err);
    }
  };

  const displayLikes = isActive && stats ? (parseInt(stats.likeCount) || likeCount) : likeCount;
  const displayComments = isActive && stats ? stats.commentCount : video.commentCount;

  const flash = (type) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setTapFlash(type);
    flashTimer.current = setTimeout(() => setTapFlash(null), 800);
  };
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  const seekToPercent = useCallback((pct) => {
    const player = playerRef.current;
    if (!player || !duration) return;
    const newTime = Math.max(0, Math.min((pct / 100) * duration, duration));
    player.seekTo(newTime, true);
    setProgress(pct);
    setCurrentTime(newTime);
  }, [duration]);

  const getPercentFromEvent = (e) => {
    const bar = scrubberRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    return pct;
  };

  const onScrubStart = (e) => {
    e.stopPropagation();
    setIsDragging(true);
    seekToPercent(getPercentFromEvent(e));
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e) => seekToPercent(getPercentFromEvent(e));
    const onEnd = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [isDragging, seekToPercent]);

  const handleVideoTap = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const side = x < rect.width / 2 ? 'left' : 'right';
    const now = Date.now();
    const last = lastTapRef.current;

    if (now - last.time < 300 && last.side === side) {
      lastTapRef.current = { time: 0, side: null };
      const player = playerRef.current;
      if (player && typeof player.getCurrentTime === 'function') {
        const cur = player.getCurrentTime();
        if (side === 'right') { player.seekTo(cur + 10, true); flash('fwd'); }
        else { player.seekTo(Math.max(cur - 10, 0), true); flash('bwd'); }
      } else {
        flash(side === 'right' ? 'fwd' : 'bwd');
      }
    } else {
      lastTapRef.current = { time: now, side };
      setTimeout(() => {
        if (Date.now() - lastTapRef.current.time >= 290) {
          setIsPaused(p => { flash(p ? 'play' : 'pause'); return !p; });
        }
      }, 300);
    }
  };

  const handleLike = (e) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      localStorage.setItem('sawaflix_pending_action', JSON.stringify({ type: 'like', videoId: video.id, videoOrigin }));
      onRequestAuth('to like this video');
      return;
    }

    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikeCount(c => nextLiked ? c + 1 : Math.max(c - 1, 0));

    // Call the server action completely outside the state updater function
    youtubeApi.likeVideo(video.id, videoOrigin).catch(() => {
      setIsLiked(!nextLiked);
      setLikeCount(c => !nextLiked ? c + 1 : Math.max(c - 1, 0));
    });
  };

  const handleComment = (e) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      localStorage.setItem('sawaflix_pending_action', JSON.stringify({ type: 'comment', videoId: video.id, videoOrigin }));
      onRequestAuth('to comment on this video');
      return;
    }
    setCommentOpen(true);
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    const url = `https://www.youtube.com/watch?v=${video.id}`;
    try {
      if (navigator.share) { await navigator.share({ title: video.title, url }); }
      else { await navigator.clipboard.writeText(url); setShareToast(true); setTimeout(() => setShareToast(false), 2500); }
    } catch { }
  };

  const handlePlayerReady = useCallback((p) => {
    playerRef.current = p;
    setDuration(p.getDuration());
    if (isActive) p.playVideo();
  }, [isActive]);

  const handleRestrictionReached = useCallback(() => {
    setIsPaywallOpen(true);
    setIsPaused(true);
  }, []);

  useEffect(() => {
    const onChange = () => { }; // Sync handled by parent
  }, []);

  return (
    <div className="relative w-full h-full sm:h-[calc(100vh-80px)] sm:max-w-[450px] mx-auto bg-black overflow-hidden group/vid flex flex-col">
      {/* ── Main Video Area ── */}
      <motion.div
        animate={{
          width: '100%',
          scale: commentOpen && !isDesktop ? 0.85 : 1,
          y: commentOpen && !isDesktop ? '-20%' : '0%'
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative h-full overflow-hidden flex-1"
      >
        <motion.div
          animate={{
            scale: 1,
            x: '0%'
          }}
          className="absolute inset-0 z-0 flex items-center justify-center bg-black"
          onClick={() => setIsPaused(!isPaused)}
        >
          {videoOrigin === 'youtube' ? (
            <YouTubePlayer
              videoId={video.id}
              isActive={isActive}
              isPaused={isPaused || isPaywallOpen}
              isMuted={isMuted}
              restriction={playbackInfo?.restriction}
              onRestrictionReached={handleRestrictionReached}
              onPlayerReady={handlePlayerReady}
              onProgress={(pct, _tLeft, ct, dur) => {
                if (!isDragging) {
                  setProgress(pct);
                  setCurrentTime(ct);
                  setDuration(dur);
                }
              }}
            />
          ) : (
            <HTML5Player
              videoId={video.id}
              videoUrl={playbackInfo?.playbackUrl || video.videoUrl}
              isActive={isActive}
              isPaused={isPaused || isPaywallOpen}
              isMuted={isMuted}
              restriction={playbackInfo?.restriction}
              onRestrictionReached={handleRestrictionReached}
              onPlayerReady={handlePlayerReady}
              onProgress={(pct, _tLeft, ct, dur) => {
                if (!isDragging) {
                  setProgress(pct);
                  setCurrentTime(ct);
                  setDuration(dur);
                }
              }}
            />
          )}
        </motion.div>

        {/* Tap overlay */}
        <div onClick={handleVideoTap} className="absolute inset-0 z-10 cursor-pointer" />

        {/* Tap flash feedback */}
        {tapFlash && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            {(tapFlash === 'play' || tapFlash === 'pause') && (
              <div className="w-20 h-20 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center animate-ping-once">
                {tapFlash === 'pause'
                  ? <div className="flex gap-1.5"><div className="w-3 h-9 bg-white rounded-sm" /><div className="w-3 h-9 bg-white rounded-sm" /></div>
                  : <Play size={38} className="text-white ml-1" fill="currentColor" />
                }
              </div>
            )}
            {(tapFlash === 'fwd' || tapFlash === 'bwd') && (
              <div className={`absolute top-1/2 -translate-y-1/2 ${tapFlash === 'fwd' ? 'right-10' : 'left-10'} flex flex-col items-center gap-1 animate-ping-once`}>
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <span className="text-white text-2xl font-black">{tapFlash === 'fwd' ? '▶▶' : '◀◀'}</span>
                </div>
                <span className="text-white text-xs font-black bg-black/40 rounded-full px-2 py-0.5">
                  {tapFlash === 'fwd' ? '+10s' : '-10s'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Overlay Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/10 to-transparent pointer-events-none z-10" />

        {shareToast && (
          <div className="absolute top-5 left-1/2 -translate-x-1/2 z-40 px-6 py-2.5 bg-white/10 backdrop-blur-xl rounded-full text-white text-[10px] font-black uppercase tracking-[0.2em] border border-white/10 pointer-events-none shadow-2xl">
            Link copied!
          </div>
        )}

        {/* Sawaflix Watermark */}
        <div className="absolute top-6 left-6 z-30 pointer-events-none opacity-50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 relative">
              <Image src="/sawaplay.png" alt="Sawa" fill className="object-contain" />
            </div>
            <span className="text-white font-black text-xs uppercase tracking-[0.3em]">Sawaflix</span>
          </div>
        </div>

        {/* Mute toggle */}
        <button
          onClick={e => { e.stopPropagation(); setIsMuted(!isMuted); }}
          className="absolute top-5 right-5 p-2.5 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 z-30 pointer-events-auto"
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        {/* Video Info & Controls Overlay */}
        <AnimatePresence>
          {(!commentOpen || isDesktop) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute inset-x-0 bottom-0 z-30 flex flex-col pointer-events-none p-6"
            >
              <div className="flex items-end justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-white/60 font-bold text-xs uppercase tracking-widest truncate mb-0.5">{video.channelTitle}</p>
                  <h3 className="text-white text-base font-bold leading-snug line-clamp-2">{video.title}</h3>
                </div>
                <div className="flex flex-col items-center gap-4 shrink-0 pointer-events-auto relative">
                  <button onClick={handleLike} className="flex flex-col items-center group/btn">
                    <div className={`p-2.5 rounded-full transition-all duration-300 ${isLiked ? 'bg-red-600' : 'bg-black/40 backdrop-blur-xl border border-white/10 group-hover/btn:bg-white/20'}`}>
                      <Heart size={22} className={isLiked ? 'text-white fill-white' : 'text-white'} />
                    </div>
                    <span className="text-[11px] font-bold text-white drop-shadow-lg mt-1.5 leading-none">{formatCount(displayLikes)}</span>
                  </button>

                  <button onClick={handleComment} className="flex flex-col items-center group/btn">
                    <div className="p-2.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 group-hover/btn:bg-white/20 transition-all duration-300">
                      <MessageCircle size={22} className="text-white fill-white" />
                    </div>
                    <span className="text-[11px] font-bold text-white drop-shadow-lg mt-1.5 leading-none">{formatCount(displayComments)}</span>
                  </button>

                  <button onClick={handleShare} className="flex flex-col items-center group/btn">
                    <div className="p-2.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 group-hover/btn:bg-white/20 transition-all duration-300">
                      <Share2 size={22} className="text-white fill-white" />
                    </div>
                    <span className="text-[11px] font-bold text-white drop-shadow-lg mt-1.5 leading-none">Share</span>
                  </button>

                  <div className="relative">
                    <button onClick={(e) => { e.stopPropagation(); setShowMoreMenu(!showMoreMenu); }} className="flex flex-col items-center group/btn">
                      <div className="p-2.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 group-hover/btn:bg-white/20 transition-all duration-300">
                        <MoreHorizontal size={22} className="text-white" />
                      </div>
                    </button>

                    <AnimatePresence>
                      {showMoreMenu && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowMoreMenu(false); }} />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            className="absolute bottom-full right-0 mb-4 bg-[#161922]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex flex-col gap-1 z-50 min-w-[140px] shadow-2xl"
                          >
                            <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 rounded-xl cursor-pointer transition-colors" onClick={(e) => { e.stopPropagation(); setShowMoreMenu(false); }}>
                              <FavoriteButton content={video} iconSize={16} showLabel={false} />
                              <span className="text-xs font-bold text-white">Favorite</span>
                            </div>
                            <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 rounded-xl cursor-pointer transition-colors" onClick={(e) => { e.stopPropagation(); setShowMoreMenu(false); }}>
                              <ThumbsDown size={16} className="text-white" />
                              <span className="text-xs font-bold text-white">Not Interested</span>
                            </div>
                            <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 rounded-xl cursor-pointer transition-colors" onClick={(e) => { e.stopPropagation(); setShowMoreMenu(false); }}>
                              <RotateCcw size={16} className="text-white" />
                              <span className="text-xs font-bold text-white">Remix</span>
                            </div>
                            <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 rounded-xl cursor-pointer transition-colors" onClick={(e) => { e.stopPropagation(); onToggleFullscreen(e); setShowMoreMenu(false); }}>
                              {isFullscreen ? <Minimize size={16} className="text-white" /> : <Maximize size={16} className="text-white" />}
                              <span className="text-xs font-bold text-white">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Scrubber */}
              <div onClick={e => e.stopPropagation()} className="w-full pt-4 pointer-events-auto">
                <div ref={scrubberRef} className="relative w-full h-4 flex items-center cursor-pointer group/scrub" onMouseDown={onScrubStart} onTouchStart={onScrubStart}>
                  <div className="absolute inset-x-0 h-0.5 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-red-600 rounded-full transition-none shadow-[0_0_8px_rgba(220,38,38,0.5)]" style={{ width: `${progress}%` }} />
                  </div>
                  <div className={`absolute w-3 h-3 bg-red-600 rounded-full shadow-lg -translate-x-1/2 transition-all ${isDragging ? 'opacity-100 scale-125' : 'opacity-0 group-hover/scrub:opacity-100'}`} style={{ left: `${progress}%` }} />
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <button onClick={() => setIsPaused(p => !p)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white/80 hover:text-white">
                    {isPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
                  </button>
                  <span className="text-white/60 text-[10px] font-black tracking-widest tabular-nums uppercase">{fmtTime(currentTime)} / {fmtTime(duration)}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Comment Section ── */}
      <AnimatePresence>
        {commentOpen && (
          <>
            {!isDesktop && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setCommentOpen(false)}
                className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
              />
            )}

            <motion.div
              initial={isDesktop ? { x: '100%' } : { y: '100%' }}
              animate={isDesktop ? { x: 0 } : { y: 0 }}
              exit={isDesktop ? { x: '100%' } : { y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              drag={isDesktop ? false : "y"}
              dragConstraints={{ top: 0 }}
              dragElastic={0.1}
              onDragEnd={(_, info) => { if (info.offset.y > 150) setCommentOpen(false); }}
              className={`fixed z-50 bg-[#0F1117]/95 backdrop-blur-xl border-white/10 flex flex-col shadow-2xl ${isDesktop ? 'inset-y-0 right-0 w-[400px] border-l' : 'bottom-0 left-0 right-0 rounded-t-[2.5rem] border-t h-[75vh]'
                }`}
            >
              {!isDesktop && (
                <div className="w-full flex justify-center py-3">
                  <div className="w-10 h-1.5 bg-white/20 rounded-full" />
                </div>
              )}

              <div className="flex items-center justify-between px-6 pb-4 pt-2 border-b border-white/5">
                <h3 className="text-white font-black text-lg">Comments</h3>
                <button onClick={() => setCommentOpen(false)} className="text-gray-500 hover:text-white transition-colors"><X size={24} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                {commentsLoading ? (
                  <div className="flex items-center justify-center py-10"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>
                ) : comments.length > 0 ? comments.map(c => (
                  <div key={c.id} className="flex gap-4">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 bg-white/10 ring-2 ring-white/5">
                      <Image src={c.authorProfileImage} alt={c.author} fill className="object-cover" unoptimized />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-bold text-sm">{c.author}</span>
                        <span className="text-white/40 text-xs">{formatCount(c.likeCount)} likes</span>
                      </div>
                      <p className="text-gray-300 text-sm leading-relaxed">{c.text}</p>
                    </div>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center py-10 text-white/20">
                    <MessageCircle size={40} className="mb-2 opacity-30" />
                    <p className="text-sm">No comments yet. Be first!</p>
                  </div>
                )}
              </div>

              <div className="p-6 bg-[#161922] border-t border-white/5 pb-10 lg:pb-6">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Share your thoughts..."
                    className="flex-1 bg-white/5 text-white rounded-full px-5 py-3 outline-none focus:ring-2 ring-white/20 text-sm border border-white/10"
                  />
                  <button
                    onClick={async () => {
                      const text = newComment.trim();
                      if (!text) return;
                      setNewComment('');
                      // Optimistic update — show comment immediately in UI
                      if (addComment) {
                        addComment({
                          id: `local-${Date.now()}`,
                          author: 'You',
                          authorProfileImage: '/default-avatar.png',
                          text,
                          likeCount: '0',
                          publishedAt: new Date().toISOString()
                        });
                      }
                      try {
                        await youtubeApi.commentOnVideo(video.id, text, videoOrigin);
                      } catch (err) {
                        console.error('Comment failed:', err);
                      }
                    }}
                    disabled={!newComment.trim()}
                    className="bg-blue-600 text-white p-3 rounded-full font-bold hover:bg-blue-500 active:scale-95 transition-all disabled:opacity-40 shadow-lg shadow-blue-600/20"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Playback Loading Skeleton - Removed opaque background to keep video visible like TikTok */}
      <AnimatePresence>
        {isPlaybackLoading && (
          <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center pointer-events-none">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [0.8, 1.1, 1], opacity: 1 }}
              transition={{ duration: 1.5, repeat: Infinity, repeatType: 'reverse' }}
              className="flex flex-col items-center gap-4 drop-shadow-2xl"
            >
              <div className="flex gap-1 mt-2">
                <span className="w-2 h-2 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Paywall Modal */}
      <PremiumPaywall
        isOpen={isPaywallOpen}
        onClose={() => setIsPaywallOpen(false)}
        movie={{
          title: video.title,
          image: video.thumbnail || `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`,
          id: video.id
        }}
        limitSeconds={playbackInfo?.restriction?.limitSeconds || 0}
        onUnlockSuccess={handleUnlock}
      />
    </div>
  );
};

// ─── Main Dashboard Content ───────────────────────────────────────────────────────────
function SawaFlixContent({ videoId: videoIdProp }) {
  const searchParams = useSearchParams();
  const catParam = searchParams.get('cat');
  const videoIdParam = searchParams.get('videoId');
  const videoId = videoIdProp || videoIdParam;

  const loginRequired = searchParams.get('loginRequired');
  const redirectedFrom = searchParams.get('redirectedFrom');

  const [activeCategory, setActiveCategory] = useState(catParam || "all");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { openAuthModal } = useAuthModal();

  const handleRequestAuth = (promptMessage = '') => {
    openAuthModal(promptMessage);
  };

  useEffect(() => {
    if (loginRequired === 'true' && !isAuthenticated) {
      const feature = redirectedFrom ? `to access ${redirectedFrom.replace('/dashboard/', '')}` : 'to access this page';
      openAuthModal(feature);
    }
  }, [loginRequired, redirectedFrom, isAuthenticated, openAuthModal]);

  useEffect(() => {
    import('@/utils/supabase/client').then(({ createClient }) => {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        const auth = !!session;
        setIsAuthenticated(auth);
        if (auth) {
          const pendingStr = localStorage.getItem('sawaflix_pending_action');
          if (pendingStr) {
            try {
              const action = JSON.parse(pendingStr);
              console.log('[ActionReplay] Replaying pending action:', action);
              if (action.type === 'like' && action.videoId) {
                // Fire the actual like API call silently in the background
                youtubeApi.likeVideo(action.videoId, action.videoOrigin || 'youtube')
                  .then(() => console.log('[ActionReplay] LIKE replayed successfully for video', action.videoId))
                  .catch(err => console.error('[ActionReplay] LIKE replay failed:', err));
              }
              // For comments we just clear — comment replay requires a UI interaction
              localStorage.removeItem('sawaflix_pending_action');
            } catch (e) {
              console.error('[ActionReplay] Failed to parse pending action:', e);
            }
          }
        }
      });
    });
  }, []);

  useEffect(() => {
    if (catParam && catParam !== activeCategory) {
      setActiveCategory(catParam);
    }
  }, [catParam]);
  const [isMuted, setIsMuted] = useState(true);
  const [activeVideoId, setActiveVideoId] = useState(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPlaying, setHeroPlaying] = useState(false);
  const [isHeroMuted, setIsHeroMuted] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showShorts, setShowShorts] = useState(true);
  const [heroImgIndex, setHeroImgIndex] = useState(0);
  const { currentTrack } = useMusic();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const feedContainerRef = useRef(null);

  const handleToggleFullscreen = (e) => {
    if (e) e.stopPropagation();
    const el = feedContainerRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      const requestMethod = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (requestMethod) requestMethod.call(el);
    } else {
      const exitMethod = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (exitMethod) exitMethod.call(document);
    }
  };

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    ));
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    document.addEventListener('mozfullscreenchange', onChange);
    document.addEventListener('MSFullscreenChange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
      document.removeEventListener('mozfullscreenchange', onChange);
      document.removeEventListener('MSFullscreenChange', onChange);

      // Exit fullscreen unconditionally on unmount
      try {
        if (
          document.fullscreenElement ||
          document.webkitFullscreenElement ||
          document.mozFullScreenElement ||
          document.msFullscreenElement
        ) {
          const exitMethod =
            document.exitFullscreen ||
            document.webkitExitFullscreen ||
            document.mozCancelFullScreen ||
            document.msExitFullscreen;
          if (exitMethod) exitMethod.call(document);
        }
      } catch (e) {
        console.error("Error exiting fullscreen on unmount:", e);
      }
    };
  }, []);



  const observerRef = useRef(null);
  const videoRefs = useRef(new Map());
  const discoverRef = useRef(null);
  const feedScrollRef = useRef(null);
  const lastAutoSelectedId = useRef(null);

  const router = useRouter();
  const urlQuery = searchParams.get('q') || '';

  const currentCategoryObj = CATEGORIES.find(c => c.id === activeCategory);
  const fetchQuery = urlQuery || currentCategoryObj?.query || CATEGORIES[0].query;

  const { videos, loading, error, loadMore, hasMore, isRefreshing } = useVideos(fetchQuery);

  const heroSource = videos.length > 0 ? videos.slice(0, 5) : [];
  const currentHeroVideo = heroSource[heroIndex % Math.max(heroSource.length, 1)];

  useEffect(() => {
    if (urlQuery) {
      setShowShorts(true);
      const t = setTimeout(() => {
        if (discoverRef.current) {
          discoverRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 250);
      return () => clearTimeout(t);
    }
  }, [urlQuery]);

  useEffect(() => { setSelectedVideo(null); }, [urlQuery]);

  const handlePlayNow = () => {
    scrollToDiscover();
  };

  useEffect(() => {
    const handleOpenReel = (e) => {
      const video = e.detail;
      if (video && video.id !== activeVideoId) {
        setShowShorts(true);
        setSelectedVideo(video);
        setActiveVideoId(video.id);
        setTimeout(() => {
          const el = videoRefs.current.get(video.id);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    };
    window.addEventListener('openSawaReel', handleOpenReel);
    return () => window.removeEventListener('openSawaReel', handleOpenReel);
  }, [activeVideoId]);

  useEffect(() => {
    if (selectedVideo && feedScrollRef.current) {
      feedScrollRef.current.scrollTop = 0;
    }
  }, [selectedVideo]);

  useEffect(() => {
    if (!videos.length) return;
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          const id = e.target.getAttribute('data-video-id');
          if (id) setActiveVideoId(id);

          // Infinite Scroll: If this is the last video, load more!
          if (id === videos[videos.length - 1]?.id && hasMore) {
            loadMore();
          }
        }
      }),
      {
        root: feedScrollRef.current,
        threshold: 0.6
      }
    );
    videoRefs.current.forEach(el => { if (el) observerRef.current.observe(el); });
    return () => observerRef.current?.disconnect();
  }, [videos, hasMore, loadMore, showShorts]);

  const handleHeroNext = useCallback(() => {
    if (!heroSource.length) return;
    setHeroIndex(prev => (prev + 1) % heroSource.length);
  }, [heroSource.length]);
  const handleHeroPrev = useCallback(() => {
    setHeroIndex(prev => (prev === 0 ? Math.max(heroSource.length - 1, 0) : prev - 1));
  }, [heroSource.length]);

  useEffect(() => {
    const t = setInterval(() => {
      setHeroImgIndex(prev => (prev + 1) % HERO_IMAGES.length);
    }, 8000);
    return () => clearInterval(t);
  }, []);

  const scrollToDiscover = () => {
    setHeroPlaying(false);
    setShowShorts(true);
    // Auto-select first video to enter feed mode immediately
    if (videos.length > 0) {
      setSelectedVideo(videos[0]);
      setActiveVideoId(videos[0].id);
    }
    setTimeout(() => {
      if (discoverRef.current) {
        discoverRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  };

  const handleCardClick = (video) => {
    setSelectedVideo(video);
    setActiveVideoId(video.id);
    setShowShorts(true);
    setTimeout(() => {
      // Auto-fullscreen request removed

      if (discoverRef.current) {
        discoverRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  };

  // Handle direct video navigation from videoId prop
  useEffect(() => {
    if (!videoId || selectedVideo?.id === videoId || lastAutoSelectedId.current === videoId) return;

    const selectVideo = async () => {
      // 1. Check if the video is already in the loaded feed
      const found = videos.find(v => v.id === videoId);
      if (found) {
        handleCardClick(found);
        return;
      }

      // 2. If not found and it looks like a YouTube ID (11 chars), fetch details
      if (videoId.length === 11) {
        if (!loading) {
          try {
            const details = await youtubeApi.getVideoDetails(videoId);
            if (details) {
              const videoObj = {
                id: details.id,
                title: details.title,
                thumbnail: `https://i.ytimg.com/vi/${details.id}/maxresdefault.jpg`,
                channelTitle: details.channelTitle || 'YouTube',
                origin: 'youtube',
                viewCount: details.viewCount,
                likeCount: details.likeCount,
                commentCount: details.commentCount,
                publishedAt: details.publishedAt,
                videoUrl: `https://www.youtube.com/watch?v=${details.id}`,
                embedUrl: `https://www.youtube.com/embed/${details.id}`,
              };
              handleCardClick(videoObj);
            }
          } catch (err) {
            console.error('Failed to fetch YouTube video details:', err);
          }
        }
      } else {
        // 3. It's a SawaFlix Native ID. Fetch it from our new API.
        try {
          const res = await fetch(`/api/videos/${videoId}`);
          if (res.ok) {
            const videoObj = await res.json();
            handleCardClick(videoObj);
          } else {
            console.warn(`[SawaFlix] Native video ${videoId} not found via API.`);
          }
        } catch (err) {
          console.error('Failed to fetch native video details:', err);
        }
      }
    };

    selectVideo();
    lastAutoSelectedId.current = videoId;
  }, [videoId, videos, loading, selectedVideo?.id]);

  const isSearchMode = !!urlQuery;

  const feedVideos = (() => {
    let list = videos;

    // If a video is selected (via click or notification), ensure it's at the top
    if (selectedVideo) {
      const rest = videos.filter(v => v.id !== selectedVideo.id);
      list = [selectedVideo, ...rest];
    }

    // If a track is selected from sidebar (via MusicContext), ensure it's in the feed
    if (currentTrack && !list.find(v => v.id === currentTrack.id)) {
      list = [currentTrack, ...list];
    }

    return list;
  })();

  return (
    <div className="flex flex-col relative">
      {/* YouTube-style Top Loading Bar */}
      <AnimatePresence>
        {isRefreshing && (
          <motion.div
            initial={{ scaleX: 0, opacity: 1 }}
            animate={{
              scaleX: 0.94,
              opacity: 1,
              transition: {
                duration: 30, // Slow crawl to 94% over 30 seconds
                ease: [0.1, 0.05, 0.03, 0.01]
              }
            }}
            exit={{
              scaleX: 1,
              opacity: 0,
              transition: { duration: 0.4, ease: "easeOut" }
            }}
            className="fixed top-16 left-0 right-0 h-[3.5px] bg-gradient-to-r from-red-700 via-red-500 to-red-600 z-[9999] origin-left shadow-[0_0_20px_rgba(220,38,38,0.3)]"
          >
            {/* The "Peg" / Glow at the tip (Premium YouTube Detail) */}
            <div className="absolute right-0 top-0 h-full w-[120px] shadow-[0_0_15px_#ff0000,0_0_8px_#ff0000] opacity-100 rotate-[2deg] translate-y-[-4px]" />

            {/* Moving shine effect for extra polish */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: '200%' }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`flex-1 pt-0 sm:pt-2 ${selectedVideo ? 'p-0' : 'p-2 sm:p-6 lg:p-8'}`} style={!selectedVideo ? { zoom: 0.9 } : undefined}>
        {!selectedVideo && (
          <DashboardLanding
            onPlayReel={handleCardClick}
            reels={videos}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
        )}

        {showShorts && selectedVideo && (
          <section id="discover-section" ref={feedContainerRef} className="h-[calc(100vh-64px)] flex flex-col overflow-hidden bg-black">
            <div className="flex flex-row items-center justify-between gap-4 shrink-0 mb-4 px-4">
              <div className="flex items-center">
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tighter">
                  {isSearchMode
                    ? <div className="flex items-center gap-3">
                      <span className="w-1.5 h-9 bg-red-600 rounded-full" />
                      <>Watching <span className="text-white/60 font-medium">"{urlQuery}"</span></>
                    </div>
                    : (
                      <div className="flex items-center gap-3">
                        <div className="relative w-8 h-8 sm:w-10 sm:h-10">
                          <Image src="/sawaplay.png" alt="Sawa" fill className="object-contain" />
                        </div>
                        <span className="text-white font-black text-lg sm:text-[26px] tracking-tight leading-none opacity-90">
                          {currentCategoryObj?.label || 'For You'}
                        </span>
                      </div>
                    )
                  }
                </h2>
              </div>

              <button
                onClick={() => {
                  if (videoId) {
                    router.push('/dashboard');
                  } else {
                    setSelectedVideo(null);
                  }
                  if (
                    document.fullscreenElement ||
                    document.webkitFullscreenElement ||
                    document.mozFullScreenElement ||
                    document.msFullscreenElement
                  ) {
                    const exitMethod =
                      document.exitFullscreen ||
                      document.webkitExitFullscreen ||
                      document.mozCancelFullScreen ||
                      document.msExitFullscreen;
                    if (exitMethod) exitMethod.call(document);
                  }
                }}
                className="flex items-center gap-2 px-5 py-3.5 bg-white/5 hover:bg-white/10 rounded-2xl text-white/50 hover:text-white text-xs font-black uppercase tracking-widest border border-white/5 transition-all shadow-lg active:scale-95"
              >
                <ChevronLeft size={14} /> Back
              </button>
            </div>

            <div
              ref={feedScrollRef}
              className="w-full flex-1 min-h-0 overflow-y-auto snap-y snap-mandatory no-scrollbar scroll-smooth bg-black sm:bg-transparent"
            >
              {feedVideos.map(video => (
                <div
                  key={video.id}
                  ref={el => videoRefs.current.set(video.id, el)}
                  data-video-id={video.id}
                  className="h-full w-full snap-start snap-always flex items-center justify-center bg-black sm:bg-transparent"
                >
                  <VideoFeedItem
                    video={video}
                    isActive={activeVideoId === video.id}
                    isMuted={isMuted}
                    setIsMuted={setIsMuted}
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={handleToggleFullscreen}
                    isAuthenticated={isAuthenticated}
                    onRequestAuth={handleRequestAuth}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        @keyframes ping-once {
          0%   { transform: scale(0.6); opacity: 1; }
          70%  { transform: scale(1.15); opacity: 0.5; }
          100% { transform: scale(1.3); opacity: 0; }
        }
        .animate-ping-once { animation: ping-once 0.7s ease-out forwards; }
      `}</style>
    </div>
  );
}

export default function SawaFlix({ videoId }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-white/40 animate-spin" />
      </div>
    }>
      <SawaFlixContent videoId={videoId} />
    </Suspense>
  );
}
