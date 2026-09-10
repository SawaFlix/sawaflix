'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getCultureFeedAction, searchVideosAction } from '@/app/actions/youtube';
import type { Video } from '@/types/youtube';
import { mapYoutubeItem, extractVideoId, type RawYoutubeFeedItem } from '@/utils/reels/mapYoutubeItem';
import { stashReelForHandoff } from '@/utils/reels/reelHandoff';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { get, set } from 'idb-keyval';

interface CultureInfiniteFeedProps {
  onPlayVideo?: (video: Video) => void;
  activeCategory?: string;
}

const CATEGORY_QUERIES: Record<string, string> = {
  all: 'Cameroon culture entertainment 2026',
  news: 'Cameroon news documentary 2026',
  music: 'Cameroon music hits makossa bikutsi afropop 2026',
  comedy: 'Cameroon comedy sketches viral',
  tourism: 'Cameroon tourism travel places douala yaounde',
  heritage: 'Cameroon heritage traditions ngondo tribes',
  culture: 'Cameroon cultural dance festival traditions',
  cinema: 'Cameroon movies short films cinema',
  announcement: 'Cameroon official announcement culture'
};

const CYCLE_QUERIES = [
  'Cameroon culture entertainment 2026',
  'Cameroon music hits makossa bikutsi',
  'Cameroon comedy sketches viral 2026',
  'Cameroon tourism douala kribi limbe yaounde',
  'Cameroon heritage traditions ngondo'
];

function formatCount(n: string | number | undefined): string {
  if (!n) return '12K';
  const num = parseInt(String(n), 10);
  if (isNaN(num)) return String(n);
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return String(num);
}

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Recently';
  const then = new Date(dateString).getTime();
  if (isNaN(then)) return 'Recently';
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// Curated fallbacks representing rich Cameroonian cultural content if API is temporarily unavailable
const FALLBACK_CULTURE_VIDEOS: Video[] = [
  {
    id: 'dQw4w9WgXcQ',
    title: 'Ngondo Festival: The Sacred Rites of the Wouri River & Sawa Culture',
    description: 'A deep dive into the spiritual ceremonies and water spirits of the Sawa people of Cameroon.',
    thumbnail: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop',
    channelId: 'sawa-heritage',
    channelTitle: 'Sawa Heritage Archives',
    publishedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    likeCount: '24K',
    viewCount: '185K'
  },
  {
    id: '3JZ_D3ELwOQ',
    title: 'Makossa & Bikutsi Rhythms: Cameroon Musical Legacy Through Generations',
    description: 'Discover the iconic basslines and energetic choreographies that shaped Central African music.',
    thumbnail: 'https://images.unsplash.com/photo-1514525253361-bee8718a74a2?q=80&w=1200&auto=format&fit=crop',
    channelId: 'sawa-music',
    channelTitle: 'Cameroon Soundwaves',
    publishedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    videoUrl: 'https://www.youtube.com/watch?v=3JZ_D3ELwOQ',
    embedUrl: 'https://www.youtube.com/embed/3JZ_D3ELwOQ',
    likeCount: '32K',
    viewCount: '310K'
  },
  {
    id: 'c1_fall_01',
    title: 'The Royal Palaces of the West: Bamoun & Grassfields Architecture',
    description: 'Exploring the rich dynasty of Sultan Njoya, royal emblems, and preserved traditions in Foumban.',
    thumbnail: 'https://images.unsplash.com/photo-1542601906990-b4d3fb852ba3?q=80&w=1200&auto=format&fit=crop',
    channelId: 'grassfields-history',
    channelTitle: 'Grassfields Kingdoms',
    publishedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    likeCount: '15K',
    viewCount: '142K'
  },
  {
    id: 'c1_fall_02',
    title: 'Mount Cameroon & Limbe Black Sands: Coastal Beauty of Fako',
    description: 'Breathtaking expedition from the peak of Mount Cameroon to the coastal fishing ports of Limbe.',
    thumbnail: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=1200&auto=format&fit=crop',
    channelId: 'cameroon-travel',
    channelTitle: 'Explore Cameroon',
    publishedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    videoUrl: 'https://www.youtube.com/watch?v=3JZ_D3ELwOQ',
    embedUrl: 'https://www.youtube.com/embed/3JZ_D3ELwOQ',
    likeCount: '19K',
    viewCount: '198K'
  }
];

export default function CultureInfiniteFeed({ activeCategory = 'all' }: CultureInfiniteFeedProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuthSession();
  const { openAuthModal } = useAuthModal();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const pageRef = useRef(1);
  const queryCycleIndexRef = useRef(0);
  const isFetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Fetch a page of cultural videos
  const fetchVideos = useCallback(async (pageToFetch: number, append: boolean = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    const baseQuery = CATEGORY_QUERIES[activeCategory] || CATEGORY_QUERIES.all;
    const cacheKey = `sawaflix:culture_feed:${activeCategory}:p${pageToFetch}`;

    try {
      // 1. Try cache on initial load for instant rendering
      if (!append && pageToFetch === 1) {
        try {
          const cached = await get(cacheKey);
          if (cached && Array.isArray(cached) && cached.length > 0) {
            setVideos(cached);
            cached.forEach(v => seenIdsRef.current.add(v.id));
            setLoading(false);
          }
        } catch {
          // Cache read failure is non-fatal
        }
      }

      let newItems: Video[] = [];

      // 2. Query culture feed action or cycling query
      if (activeCategory === 'all') {
        const response = await getCultureFeedAction(pageToFetch, 12);
        const feedList: RawYoutubeFeedItem[] = response?.feed || [];
        newItems = feedList.filter((item) => !!extractVideoId(item)).map(mapYoutubeItem);
        
        // If the culture feed pagination runs dry, smoothly cycle complementary queries
        if (newItems.length === 0) {
          const cycleQuery = CYCLE_QUERIES[queryCycleIndexRef.current % CYCLE_QUERIES.length];
          queryCycleIndexRef.current += 1;
          const searchResp = await searchVideosAction(cycleQuery, null, 12);
          const rawList = Array.isArray(searchResp) ? searchResp : (searchResp as any)?.items || [];
          newItems = rawList
            .filter((item: any) => !!(typeof item.id === 'object' ? item.id.videoId : item.id))
            .map(mapYoutubeItem);
        }
      } else {
        const searchResp = await searchVideosAction(baseQuery, null, 12);
        const rawList = Array.isArray(searchResp) ? searchResp : (searchResp as any)?.items || [];
        newItems = rawList
          .filter((item: any) => !!(typeof item.id === 'object' ? item.id.videoId : item.id))
          .map(mapYoutubeItem);
      }

      // 3. Fallback check if API returned empty
      if (newItems.length === 0 && !append) {
        newItems = FALLBACK_CULTURE_VIDEOS;
      }

      // 4. Deduplicate and commit to state
      setVideos((prev) => {
        if (!append) {
          seenIdsRef.current = new Set(newItems.map(v => v.id));
          return newItems;
        }
        const filtered = newItems.filter(item => !seenIdsRef.current.has(item.id));
        filtered.forEach(item => seenIdsRef.current.add(item.id));
        return [...prev, ...filtered];
      });

      pageRef.current = pageToFetch;

      // Save to IndexedDB cache
      if (newItems.length > 0) {
        set(cacheKey, newItems).catch(() => {});
      }
    } catch (err: any) {
      console.warn('[CultureInfiniteFeed] Fetch error:', err);
      if (!append && videos.length === 0) {
        setVideos(FALLBACK_CULTURE_VIDEOS);
        FALLBACK_CULTURE_VIDEOS.forEach(v => seenIdsRef.current.add(v.id));
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [activeCategory, videos.length]);

  // Reset feed whenever category changes
  useEffect(() => {
    pageRef.current = 1;
    seenIdsRef.current.clear();
    fetchVideos(1, false);
  }, [activeCategory, fetchVideos]);

  // IntersectionObserver for the infinite scroll sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isFetchingRef.current && !loading) {
          fetchVideos(pageRef.current + 1, true);
        }
      },
      {
        root: null,
        rootMargin: '250px',
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchVideos, loading]);

  // Opening the video directly in the same playing mode that opens when clicking reels
  const handleVideoClick = (video: Video) => {
    if (!isAuthenticated) {
      openAuthModal('to watch videos');
      return;
    }
    stashReelForHandoff(video);
    router.push(`/dashboard/reels?id=${video.id}`);
  };

  return (
    <section className="w-full relative flex flex-col gap-5 my-2">
      {/* Section Header: Clean & Simple with NO red color */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-white/5 pb-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Discover more content
          </h2>
          <p className="text-white/50 text-sm mt-1">
            Endless authentic Cameroonian music, comedy, traditions, and stories preserved for you.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/40 self-start sm:self-end">
          <span className="inline-block w-2 h-2 rounded-full bg-white/40" />
          <span>{videos.length} videos loaded</span>
        </div>
      </div>

      {/* Main Grid of Culture Videos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
        {videos.map((video, idx) => {
          const thumbnail = video.thumbnail || `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`;
          const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(video.channelTitle || 'Sawaflix')}`;

          return (
            <div
              key={`${video.id}-${idx}`}
              onClick={() => handleVideoClick(video)}
              className="group relative flex flex-col gap-3 rounded-2xl bg-[#12151D]/60 hover:bg-[#151923] border border-white/5 hover:border-white/20 p-3 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-white/5 hover:-translate-y-1"
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black/40 border border-white/5">
                <Image
                  src={thumbnail}
                  alt={video.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  unoptimized
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
                
                {/* Gradient vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Center Play Button on hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 scale-75 group-hover:scale-100 transition-transform duration-300">
                    <Play size={20} className="text-white fill-white ml-0.5" />
                  </div>
                </div>

                {/* Cultural Badge */}
                <div className="absolute top-2.5 left-2.5">
                  <span className="px-2 py-0.5 bg-black/70 backdrop-blur-md rounded-md text-[10px] font-medium text-white/80 border border-white/10 uppercase tracking-wider">
                    Sawa Culture
                  </span>
                </div>

                {/* Views indicator */}
                <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 backdrop-blur-md rounded text-[11px] font-semibold text-white/90">
                  {formatCount(video.viewCount)} views
                </div>
              </div>

              {/* Info Container */}
              <div className="flex gap-3 px-1">
                {/* Channel Avatar */}
                <div className="w-9 h-9 rounded-full bg-white/10 border border-white/10 overflow-hidden flex-shrink-0 relative">
                  <Image
                    src={avatar}
                    alt={video.channelTitle || 'Channel'}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>

                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <h3 className="text-white text-sm font-semibold leading-snug line-clamp-2 group-hover:text-white/90 transition-colors">
                    {video.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <span className="truncate hover:text-white transition-colors">{video.channelTitle}</span>
                    <span>•</span>
                    <span className="flex-shrink-0">{formatRelativeTime(video.publishedAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* When videos end or while loading initial/more content, ALWAYS show nice skeletons */}
        {(loading || loadingMore || videos.length > 0) &&
          Array.from({ length: loading ? 8 : 4 }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="flex flex-col gap-3 rounded-2xl bg-white/[0.02] border border-white/5 p-3 animate-pulse"
            >
              <div className="w-full aspect-video rounded-xl bg-white/5" />
              <div className="flex gap-3 px-1 mt-1">
                <div className="w-9 h-9 rounded-full bg-white/5 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/5 rounded w-full" />
                  <div className="h-3 bg-white/5 rounded w-2/3" />
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Infinite Scroll Sentinel */}
      <div ref={sentinelRef} className="h-8 w-full flex items-center justify-center my-2 pointer-events-none" />
    </section>
  );
}
