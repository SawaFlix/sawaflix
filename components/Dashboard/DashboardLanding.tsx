'use client'
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { Play, ChevronRight, ChevronLeft, Film, Search, TrendingUp, BookOpen, Video as VideoIcon, Heart, MessageCircle, Eye } from 'lucide-react';

import { MOVIES_DATA } from '../Movie/constants';
import { sanityFetch, urlFor } from '@/lib/sanity/client';
import { getStories, getCategories } from '@/lib/sanity/queries';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { useHomeSearchStore } from '@/store/homeSearchStore';
import { stashReelForHandoff } from '@/utils/reels/reelHandoff';
import CultureInfiniteFeed from './CultureInfiniteFeed';

const PILL_TABS = [
  { id: 'all',          label: 'For You' },
  { id: 'news',         label: 'News' },
  { id: 'music',        label: 'Music' },
  { id: 'comedy',       label: 'Comedy' },
  { id: 'tourism',      label: 'Tourism' },
  { id: 'heritage',     label: 'Heritage' },
  { id: 'culture',      label: 'Culture' },
  { id: 'cinema',       label: 'Cinema' },
  { id: 'announcement', label: 'Announcement' }
];

function formatCount(n: string | number | undefined): string {
  if (!n) return '0';
  const num = parseInt(String(n), 10);
  if (isNaN(num)) return '0';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return String(num);
}

function formatRelativeTime(dateString: string): string {
  if (!dateString) return 'Recently';
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
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

interface DashboardLandingProps {
  onPlayReel: (video: any) => void;
  reels: any[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export default function DashboardLanding({ onPlayReel, reels, activeCategory, onCategoryChange }: DashboardLandingProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuthSession();
  const { openAuthModal } = useAuthModal();
  const { query: homeSearchQuery, results: homeSearchResults, clear: clearHomeSearch } = useHomeSearchStore();
  const [heroItem, setHeroItem] = useState<{
    id: string;
    type: 'admin_video' | 'youtube' | 'blog' | 'movie';
    title: string;
    subtitle?: string;
    image: string;
    badge: string;
    targetUrl: string;
  } | null>(null);
  const [adminVideos, setAdminVideos] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [storyCategories, setStoryCategories] = useState<any[]>([]);
  const [loadingStories, setLoadingStories] = useState(true);
  const [storyStatsMap, setStoryStatsMap] = useState<Record<string, { likesCount: number; viewsCount: number; commentsCount: number }>>({});


  const moviesScrollRef = useRef<HTMLDivElement>(null);
  const longFormScrollRef = useRef<HTMLDivElement>(null);
  const reelsPreviewScrollRef = useRef<HTMLDivElement>(null);

  // Fetch admin uploaded content for the banner pool
  useEffect(() => {
    async function fetchAdminContent() {
      try {
        const adminUrl = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:3001';
        const res = await fetch(`${adminUrl}/api/public/featured`, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json?.data && Array.isArray(json.data) && json.data.length > 0) {
            setAdminVideos(json.data);
            return;
          }
        }
      } catch (e) {}

      // Direct fallback to Supabase contents table
      try {
        const { createClient } = await import('@/utils/supabase/client');
        const supabase = createClient();
        const { data } = await supabase
          .from('contents')
          .select('*')
          .eq('visibility', 'public')
          .order('created_at', { ascending: false })
          .limit(5);

        if (data && data.length > 0) {
          setAdminVideos(data.map((c: any) => ({
            id: c.id,
            type: 'admin_video',
            title: c.title,
            description: c.description,
            image: c.cover_url || c.thumbnail_url || 'https://i.ibb.co/WWhx2c0g/sawaflixmusic-cover.png',
            badge: 'SawaFlix Original',
            action_url: `/dashboard/reels?id=${c.id}`
          })));
        }
      } catch (sbErr) {}
    }
    fetchAdminContent();
  }, []);

  // Multi-source pool: Admin Videos, YouTube Videos, Blog Articles, and Movies
  const heroPool = useMemo(() => {
    const pool: Array<{
      id: string;
      type: 'admin_video' | 'youtube' | 'blog' | 'movie';
      title: string;
      subtitle?: string;
      image: string;
      badge: string;
      targetUrl: string;
    }> = [];

    // 1. Admin Uploaded Videos
    adminVideos.forEach((v: any) => {
      pool.push({
        id: v.id || v._id,
        type: 'admin_video',
        title: v.title || 'SawaFlix Original',
        subtitle: v.description || 'Watch now exclusively on SawaFlix',
        image: v.image || v.thumbnail_url || v.cover_url || 'https://i.ibb.co/WWhx2c0g/sawaflixmusic-cover.png',
        badge: 'SawaFlix Original',
        targetUrl: v.action_url || `/dashboard/reels?id=${v.id || v._id}`
      });
    });

    // 2. YouTube Culture Videos from reels
    (reels || []).slice(0, 6).forEach((r: any) => {
      pool.push({
        id: r.id,
        type: 'youtube',
        title: r.title || 'Trending Culture',
        subtitle: r.channelTitle || 'Watch on SawaFlix Reels',
        image: r.thumbnail || `https://i.ytimg.com/vi/${r.id}/maxresdefault.jpg`,
        badge: 'Trending Culture',
        targetUrl: `/dashboard/reels?id=${r.id}`
      });
    });

    // 3. Blog Stories from Sanity
    (stories || []).slice(0, 6).forEach((s: any) => {
      let imgUrl = 'https://i.ibb.co/27LNPd8v/sawaflixmusic-cover.png';
      try {
        if (s.mainImage) imgUrl = urlFor(s.mainImage).width(1200).height(600).url();
      } catch (e) {}

      pool.push({
        id: s._id,
        type: 'blog',
        title: s.title || 'Area Tory Story',
        subtitle: s.excerpt || 'Read the full cultural story on SawaFlix',
        image: imgUrl,
        badge: 'Area Tory Story',
        targetUrl: `/dashboard/blogs/${s.slug?.current || s._id}`
      });
    });

    // 4. Movies from MOVIES_DATA
    MOVIES_DATA.slice(0, 3).forEach((m: any) => {
      pool.push({
        id: String(m.id),
        type: 'movie',
        title: m.title,
        subtitle: m.genre || 'Sawa Cinema Highlight',
        image: m.image,
        badge: 'Sawa Cinema',
        targetUrl: '/dashboard/movie'
      });
    });

    return pool;
  }, [adminVideos, reels, stories]);

  // Pick random banner item and rotate every 3 minutes
  useEffect(() => {
    if (heroPool.length === 0) return;
    const getRandomItem = () => heroPool[Math.floor(Math.random() * heroPool.length)];
    setHeroItem(getRandomItem());
    const interval = setInterval(() => {
      setHeroItem(getRandomItem());
    }, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [heroPool]);

  // Handle banner play/read navigation
  const handleBannerClick = () => {
    if (!heroItem) return;
    if (!isAuthenticated) {
      const reason = heroItem.type === 'blog' 
        ? 'to read this story' 
        : heroItem.type === 'movie' 
        ? 'to watch this movie' 
        : 'to watch this video';
      openAuthModal(reason);
      return;
    }
    router.push(heroItem.targetUrl);
  };

  // Fetch Sanity Stories using getStories() like StoryGrid does
  useEffect(() => {
    const fetchStories = async () => {
      setLoadingStories(true);
      try {
        const [storiesData, categoriesData] = await Promise.all([
          getStories(),
          getCategories()
        ]);
        if (storiesData) {
          setStories(storiesData);
          const ids = storiesData.map((s: any) => s._id || s.slug?.current).filter(Boolean);
          if (ids.length > 0) {
            fetch('/api/stories/batch-stats', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ storyIds: ids }),
            })
              .then((r) => r.json())
              .then((res) => {
                if (res?.stats) setStoryStatsMap(res.stats);
              })
              .catch(() => {});
          }
        }
        if (categoriesData) setStoryCategories(categoriesData);

      } catch (err) {
        console.error('Failed to fetch stories:', err);
      } finally {
        setLoadingStories(false);
      }
    };
    fetchStories();
  }, []);

  // Filter stories by global activeCategory
  const filteredStories = useMemo(() => {
    if (activeCategory === 'all') return stories;
    return stories.filter(
      (s) => s.category?.slug?.current === activeCategory || s.category?.title?.toLowerCase() === activeCategory
    );
  }, [stories, activeCategory]);

  // Image fallback logic from StoryGrid
  const getImageUrl = (image: any, fallbackIndex: number) => {
    if (image?.asset) {
      return urlFor(image).width(800).height(500).fit('crop').url();
    }
    const fallbacks = [
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=2070&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=2070&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1542601906990-b4d3fb852ba3?q=80&w=2070&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1514525253361-bee8718a74a2?q=80&w=1964&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1526218626217-dc65a29bb444?q=80&w=1974&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=2059&auto=format&fit=crop",
    ];
    return fallbacks[fallbackIndex % fallbacks.length];
  };

  const scrollLeft = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) ref.current.scrollBy({ left: -300, behavior: 'smooth' });
  };
  const scrollRight = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) ref.current.scrollBy({ left: 300, behavior: 'smooth' });
  };



  // Sample of the same feed, shown as a row of vertical reel cards linking
  // into the real Reels page (/dashboard/reels?id=...) — deep-link support
  // there jumps straight to the tapped video. When a home-page search has
  // results (see store/homeSearchStore.ts), this row shows those instead —
  // picking a card is a search result, still opening into the real Reels
  // page rather than playing in place.
  const reelsPreview = useMemo(
    () => (homeSearchResults.length > 0 ? homeSearchResults : (reels || []).slice(0, 10)),
    [reels, homeSearchResults]
  );

  // Long-form videos (news, comedy, etc.) — filter for non-short content
  const longFormVideos = useMemo(() => {
    return (reels || []).filter((v: any) => {
      const title = (v.title || '').toLowerCase();
      return title.includes('news') || title.includes('comedy') || title.includes('interview')
        || title.includes('documentary') || title.includes('movie') || title.includes('film')
        || title.includes('report') || title.includes('show');
    }).slice(0, 10);
  }, [reels]);

  // Trending news — random subset of stories
  const trendingNews = useMemo(() => {
    if (!stories.length) return [];
    const shuffled = [...stories].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  }, [stories]);

  // Deterministic progress values for continue watching (pure function avoids SSR hydration mismatch)
  const progressValues = useMemo(() => {
    return MOVIES_DATA.slice(0, 8).map((_, i) => ((i * 37 + 13) % 60) + 20);
  }, []);

  const reelsRef = useRef<HTMLDivElement>(null);

  // Handle scroll for reels
  const handleScrollToReels = () => {
    reelsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };



  return (
    <div className="w-full pb-12" style={{ zoom: 0.9 }}>
      {/* Navigation Pills — sticky */}
      <div className="sticky top-0 z-40 bg-[#0B0E14]/95 backdrop-blur-xl py-3 mb-6 flex items-center gap-3 overflow-x-auto no-scrollbar border-b border-white/5 px-2 sm:px-6 lg:px-8">
        {PILL_TABS.slice(0, 1).map((tab, idx) => (
          <button
            key={`${tab.id}-${idx}`}
            onClick={() => onCategoryChange(tab.id)}
            className={`px-5 py-1.5 rounded-full text-sm font-medium tracking-tight transition-all duration-300 flex-shrink-0 ${
              activeCategory === tab.id
                ? 'bg-white text-[#0B0E14] shadow-[0_0_15px_rgba(255,255,255,0.18)]'
                : 'bg-transparent text-white/70 hover:bg-white/10 hover:text-white border border-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}

        {/* Reels navigates to its own page rather than filtering in-page content. */}
        <Link
          href="/dashboard/reels"
          className="px-5 py-1.5 rounded-full text-sm font-medium tracking-tight transition-all duration-300 flex-shrink-0 bg-transparent text-white/70 hover:bg-white/10 hover:text-white border border-white/10"
        >
          Reels
        </Link>

        {PILL_TABS.slice(1).map((tab, idx) => (
          <button
            key={`${tab.id}-${idx}`}
            onClick={() => onCategoryChange(tab.id)}
            className={`px-5 py-1.5 rounded-full text-sm font-medium tracking-tight transition-all duration-300 flex-shrink-0 ${
              activeCategory === tab.id
                ? 'bg-white text-[#0B0E14] shadow-[0_0_15px_rgba(255,255,255,0.18)]'
                : 'bg-transparent text-white/70 hover:bg-white/10 hover:text-white border border-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-2 sm:px-6 lg:px-8 flex flex-col gap-10">

        {/* ═══ Dynamic Multi-Source Hero Banner (Admin Video, YouTube, Blog, Movie) ═══ */}
        {heroItem && (
          <section 
            onClick={handleBannerClick}
            className="relative w-full aspect-[16/9] sm:aspect-[21/9] rounded-2xl sm:rounded-[2rem] overflow-hidden group shadow-2xl border border-white/5 bg-black cursor-pointer"
          >
            <Image
              src={heroItem.image}
              alt={heroItem.title}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              unoptimized
              priority
              sizes="100vw"
            />
            {/* Dark gradient for high contrast reading */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E14] via-[#0B0E14]/40 to-transparent" />

            {/* Top-right item type badge */}
            <div className="absolute top-4 right-4 z-10">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase border bg-white/30 text-black border-white/20">
                {heroItem.badge}
              </span>
            </div>

            {/* Center Play / Read button */}
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
              <div
                className="w-16 h-16 sm:w-20 sm:h-20 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-500"
              >
                <div className="absolute inset-0 bg-[#CE1126] rounded-full scale-0 group-hover:scale-100 transition-transform duration-500" />
                {heroItem.type === 'blog' ? (
                  <BookOpen size={28} className="text-white relative z-10" />
                ) : (
                  <Play size={32} className="text-white relative z-10 ml-2 fill-current" />
                )}
              </div>
            </div>

            {/* Bottom-left metadata overlay */}
            <div className="absolute bottom-5 left-5 sm:bottom-8 sm:left-8 z-10 max-w-xl">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-md bg-white/15 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider border border-white/15">
                  {heroItem.type === 'admin_video' ? 'Featured Video' : heroItem.type === 'blog' ? 'Featured Story' : heroItem.type === 'youtube' ? 'Trending Culture' : 'Featured Cinema'}
                </span>
              </div>
              <h1 className="text-xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight line-clamp-2 drop-shadow-md">
                {heroItem.title}
              </h1>
              {heroItem.subtitle && (
                <p className="text-xs sm:text-sm text-white/80 font-medium line-clamp-1 mt-1 drop-shadow-sm">
                  {heroItem.subtitle}
                </p>
              )}
            </div>
          </section>
        )}

        {/* ═══ Reels Preview — links into the real /dashboard/reels feed, or
            a home-page search's results while one is active ═══ */}
        {reelsPreview.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 relative">
                  <Image src="/logos_and_pwas/loaderLogo.png" alt="" fill sizes="24px" className="object-contain" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {homeSearchQuery ? `Search results for "${homeSearchQuery}"` : 'Reels'}
                </h2>
              </div>
              {homeSearchQuery ? (
                <button
                  type="button"
                  onClick={clearHomeSearch}
                  className="text-[#CE1126] text-sm font-bold hover:text-red-400 transition-colors"
                >
                  Clear
                </button>
              ) : (
                <Link href="/dashboard/reels" className="text-[#CE1126] text-sm font-bold hover:text-red-400 transition-colors">
                  View all
                </Link>
              )}
            </div>

            <div className="relative group/slider">
              <div
                ref={reelsPreviewScrollRef}
                className="flex overflow-x-auto gap-4 snap-x snap-mandatory no-scrollbar pb-4"
              >
                {reelsPreview.map((reel: any) => (
                  <Link
                    key={reel.id}
                    href={`/dashboard/reels?id=${reel.id}`}
                    // Hands the already-fetched video straight to the Reels
                    // page (same mechanism the right sidebar and home search
                    // use) — needed for search results specifically, since
                    // they usually won't be in the Reels page's own
                    // server-fetched culture feed for a plain ?id= lookup
                    // to find on its own.
                    onClick={() => stashReelForHandoff(reel)}
                    className="relative w-[140px] sm:w-[180px] aspect-[9/16] flex-shrink-0 snap-start rounded-xl overflow-hidden cursor-pointer group/card border border-white/5 hover:border-white/20 transition-colors"
                  >
                    <Image
                      src={reel.thumbnail || `https://i.ytimg.com/vi/${reel.id}/maxresdefault.jpg`}
                      alt={reel.title}
                      fill
                      className="object-cover group-hover/card:scale-105 transition-transform duration-500"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity duration-300">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
                        <Play size={24} className="text-white fill-white ml-1" />
                      </div>
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 flex flex-col gap-1">
                      <h3 className="text-white text-sm font-bold line-clamp-2 leading-tight drop-shadow-md">
                        {reel.title}
                      </h3>
                      <p className="text-white/70 text-xs truncate">{reel.channelTitle}</p>
                    </div>
                  </Link>
                ))}
              </div>

              <button onClick={() => scrollLeft(reelsPreviewScrollRef)} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/60 backdrop-blur-md text-white rounded-full opacity-0 group-hover/slider:opacity-100 transition-opacity z-10">
                <ChevronLeft size={20} />
              </button>
              <button onClick={() => scrollRight(reelsPreviewScrollRef)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/60 backdrop-blur-md text-white rounded-full opacity-0 group-hover/slider:opacity-100 transition-opacity z-10">
                <ChevronRight size={20} />
              </button>
            </div>
          </section>
        )}

        {/* ═══ Long-Form Videos (News, Comedy, etc.) ═══ */}
        {longFormVideos.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Film className="w-5 h-5 text-[#CE1126]" />
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">News & Comedy</h2>
              </div>
              <button onClick={() => onCategoryChange('news')} className="text-[#CE1126] text-sm font-bold hover:text-red-400 transition-colors">View all</button>
            </div>

            <div className="relative group/slider">
              <div
                ref={longFormScrollRef}
                className="flex overflow-x-auto gap-4 snap-x snap-mandatory no-scrollbar pb-4"
              >
                {longFormVideos.map((video: any) => (
                  <div
                    key={video.id}
                    onClick={() => {
                      if (!isAuthenticated) {
                        openAuthModal('to watch videos');
                        return;
                      }
                      onPlayReel(video);
                    }}
                    className="relative w-[260px] sm:w-[300px] flex-shrink-0 snap-start flex flex-col gap-3 cursor-pointer group/card"
                  >
                    <div className="relative aspect-video rounded-xl overflow-hidden border border-white/5 group-hover/card:border-white/20 transition-colors">
                      <Image
                        src={video.thumbnail || `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`}
                        alt={video.title}
                        fill
                        className="object-cover group-hover/card:scale-105 transition-transform duration-500"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-black/20 group-hover/card:bg-black/40 transition-colors" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity duration-300">
                        <div className="w-12 h-12 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
                          <Play size={24} className="text-white fill-white ml-1" />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 px-1">
                      <h3 className="text-white text-sm font-bold truncate">{video.title}</h3>
                      <p className="text-white/50 text-xs truncate">{video.channelTitle}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => scrollLeft(longFormScrollRef)} className="absolute left-2 top-[40%] -translate-y-1/2 p-2 bg-black/60 backdrop-blur-md text-white rounded-full opacity-0 group-hover/slider:opacity-100 transition-opacity z-10">
                <ChevronLeft size={20} />
              </button>
              <button onClick={() => scrollRight(longFormScrollRef)} className="absolute right-2 top-[40%] -translate-y-1/2 p-2 bg-black/60 backdrop-blur-md text-white rounded-full opacity-0 group-hover/slider:opacity-100 transition-opacity z-10">
                <ChevronRight size={20} />
              </button>
            </div>
          </section>
        )}

        {/* ═══ Top Stories Section ═══ */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-4 gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Top Stories</h2>
              <p className="text-white/50 text-sm">Stay updated with what matters in our culture, community and country.</p>
            </div>
          </div>

          <div className="flex overflow-x-auto gap-4 snap-x snap-mandatory no-scrollbar pb-4 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-6 sm:overflow-visible">
            {loadingStories ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-[260px] sm:w-auto flex-shrink-0 aspect-[4/5] rounded-xl bg-white/5 animate-pulse snap-start" />
              ))
            ) : filteredStories.length > 0 ? (
              filteredStories.slice(0, 8).map((story: any, index: number) => {
                const dateText = formatRelativeTime(story.publishedAt);
                const storyKey = story._id || story.slug?.current;
                const neonStats = storyStatsMap[storyKey];
                const likes = neonStats ? neonStats.likesCount : (story.likes ?? 0);
                const views = neonStats ? neonStats.viewsCount : (story.views ?? 0);
                const comments = neonStats ? neonStats.commentsCount : 0;
                
                return (
                  <div
                    key={story._id}
                    className="w-[260px] sm:w-auto flex-shrink-0 snap-start group relative bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-red-600/30 transition-all flex flex-col"
                  >
                    <div className="relative h-40 sm:h-48 overflow-hidden flex-shrink-0">
                      <div
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                        style={{ backgroundImage: `url(${getImageUrl(story.mainImage, index)})` }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E14] to-transparent opacity-50" />

                      <div className="absolute top-3 left-3">
                        <span
                          className="px-2 py-0.5 text-white text-[9px] font-bold rounded-md tracking-widest backdrop-blur-md uppercase"
                          style={{ backgroundColor: (story.category?.color || "#E50914") + "E6" }}
                        >
                          {story.category?.title || "Story"}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 sm:p-5 flex-1 flex flex-col">
                      <h3 className="text-sm sm:text-base font-bold text-white mb-2 group-hover:text-red-500 transition-colors leading-snug line-clamp-2">
                        {story.title}
                      </h3>

                      <div className="flex items-center gap-2 text-gray-500 text-[10px] font-bold tracking-widest mt-auto pt-2">
                        <span>{dateText}</span>
                        <div className="w-1 h-1 rounded-full bg-gray-700" />
                        <span>{story.readTime || "3 min read"}</span>
                      </div>

                      {/* Clean & Professional Stats Row */}
                      <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-white/5 text-zinc-400">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1.5 hover:text-red-400 transition-colors" title="Likes">
                            <Image
                              src="/logos_and_pwas/like.png"
                              alt="Likes"
                              width={14}
                              height={14}
                              className="w-3.5 h-3.5 object-contain"
                            />
                            <span className="font-mono text-[10px] font-medium text-zinc-300">{formatCount(likes)}</span>
                          </span>
                          <span className="flex items-center gap-1 hover:text-white transition-colors" title="Comments">
                            <MessageCircle className="w-3 h-3 text-zinc-400" />
                            <span className="font-mono text-[10px] font-medium text-zinc-300">{formatCount(comments)}</span>
                          </span>
                        </div>
                        <span className="flex items-center gap-1 text-zinc-500" title="Views">
                          <Eye className="w-3 h-3 text-zinc-400" />
                          <span className="font-mono text-[10px] font-medium text-zinc-400">{formatCount(views)}</span>
                        </span>
                      </div>

                      
                      {/* Button that covers the card for clicking with auth check */}
                      <button
                        type="button"
                        onClick={() => {
                          if (!isAuthenticated) {
                            openAuthModal('to read stories');
                            return;
                          }
                          router.push(`/dashboard/blogs/${story.slug?.current || story._id}`);
                        }}
                        className="absolute inset-0 z-10 w-full h-full cursor-pointer opacity-0"
                        aria-label={story.title}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full py-10 text-center text-white/40 bg-white/5 rounded-xl border border-white/5 w-full">
                No stories found for this category.
              </div>
            )}
          </div>
        </section>
 
        {/* ═══ Cameroonian Culture Infinite Feed ═══ */}
        <CultureInfiniteFeed
          onPlayVideo={onPlayReel}
          activeCategory={activeCategory}
        />

        {/* ═══ Continue Watching Section ═══ */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Film className="w-5 h-5 text-amber-500" />
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Continue Watching</h2>
            </div>
            <button onClick={() => onCategoryChange('cinema')} className="text-[#CE1126] text-sm font-bold hover:text-red-400 transition-colors">View all</button>
          </div>

          <div className="relative group/slider">
            <div
              ref={moviesScrollRef}
              className="flex overflow-x-auto gap-4 snap-x snap-mandatory no-scrollbar pb-4"
            >
              {MOVIES_DATA.slice(0, 8).map((movie: any, idx: number) => (
                <div
                  key={movie.id}
                  onClick={() => {
                    if (!isAuthenticated) {
                      openAuthModal('to watch movies');
                      return;
                    }
                    router.push('/dashboard/movie');
                  }}
                  className="relative w-[260px] sm:w-[300px] flex-shrink-0 snap-start flex flex-col gap-3 cursor-pointer group/card"
                >
                  <div className="relative aspect-video rounded-xl overflow-hidden border border-white/5 group-hover/card:border-white/20 transition-colors">
                    <Image
                      src={movie.image}
                      alt={movie.title}
                      fill
                      className="object-cover group-hover/card:scale-105 transition-transform duration-500"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover/card:bg-black/40 transition-colors" />

                    {/* Red progress bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                      <div className="h-full bg-[#CE1126]" style={{ width: progressValues[idx] ? `${progressValues[idx]}%` : '0%' }} />
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity duration-300">
                      <div className="w-12 h-12 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
                        <Play size={24} className="text-white fill-white ml-1" />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 px-1">
                    <h3 className="text-white text-sm font-bold truncate group-hover/card:text-white/80 transition-colors">{movie.title}</h3>
                    <div className="flex items-center gap-2 text-white/50 text-xs">
                      <span>{movie.genres[0]}</span>
                      <span>•</span>
                      <span>{movie.duration}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => scrollLeft(moviesScrollRef)} className="absolute left-2 top-[40%] -translate-y-1/2 p-2 bg-black/60 backdrop-blur-md text-white rounded-full opacity-0 group-hover/slider:opacity-100 transition-opacity z-10">
              <ChevronLeft size={20} />
            </button>
            <button onClick={() => scrollRight(moviesScrollRef)} className="absolute right-2 top-[40%] -translate-y-1/2 p-2 bg-black/60 backdrop-blur-md text-white rounded-full opacity-0 group-hover/slider:opacity-100 transition-opacity z-10">
              <ChevronRight size={20} />
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
