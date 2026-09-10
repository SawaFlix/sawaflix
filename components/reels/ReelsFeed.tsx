'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, Film } from 'lucide-react';
import type { Video } from '@/types/youtube';
import { useReels } from '@/hooks/reels/useReels';
import { useReelsSearch } from '@/hooks/reels/useReelsSearch';
import { useActiveReel } from '@/hooks/reels/useActiveReel';
import { useIntersection } from '@/hooks/reels/useIntersection';
import { useReelsSearchStore } from '@/store/reelsSearchStore';
import { useReelsMuteStore } from '@/store/reelsMuteStore';
import { consumeReelHandoff } from '@/utils/reels/reelHandoff';
import { ReelCard } from './ReelCard';
import { ReelHeader } from './ReelHeader';
import { ReelLoading } from './ReelLoading';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useAuthModal } from '@/contexts/AuthModalContext';

const MUTE_STORAGE_KEY = 'sawaflix_reels_muted';

interface ReelsFeedProps {
  initialVideos: Video[];
  initialHasMore: boolean;
  initialVideoId?: string;
}

export function ReelsFeed({ initialVideos, initialHasMore, initialVideoId }: ReelsFeedProps) {
  // Right-sidebar "open this reel" links stash the full Video object (from a
  // different query than the culture feed below) right before navigating
  // here — consumed exactly once, on the very first render, via useState's
  // lazy initializer. Only used if it actually matches this page's ?id=, so
  // a stale/mismatched handoff (or none at all — direct visits/reloads)
  // just falls through to the normal server-fetched feed.
  const [seededVideos] = useState<Video[]>(() => {
    const handoff = consumeReelHandoff();
    if (handoff && handoff.id === initialVideoId && !initialVideos.some((v) => v.id === handoff.id)) {
      return [handoff, ...initialVideos];
    }
    return initialVideos;
  });

  const feed = useReels({ initialVideos: seededVideos, initialHasMore });
  const search = useReelsSearch();

  const isSearching = search.isActive;

  // Which search video (if any) the user has opened into the swipeable
  // viewer. null while browsing the results dropdown or when search isn't
  // active at all — see `searchMode` below for the three states this drives.
  const [selectedSearchVideoId, setSelectedSearchVideoId] = useState<string | null>(null);

  // idle: normal autoplay feed.
  // searching: results dropdown open (in the top navbar) — the feed stays
  // exactly as it was underneath (same video, same scroll position), just
  // paused, instead of vanishing behind a blank screen while typing.
  // viewingSearchResult: swipeable/autoplay list sourced from search.videos
  // and scrolled to the selected result.
  const searchMode: 'idle' | 'searching' | 'viewingSearchResult' = !isSearching
    ? 'idle'
    : selectedSearchVideoId
    ? 'viewingSearchResult'
    : 'searching';

  // Only actually switch what's on screen once a result has been opened —
  // merely typing/browsing the dropdown keeps showing the normal feed.
  const isViewingSearchResult = searchMode === 'viewingSearchResult';
  const videos = isViewingSearchResult ? search.videos : feed.videos;
  const loading = isViewingSearchResult ? search.loading : feed.loading;
  const error = isViewingSearchResult ? search.error : feed.error;
  const hasMore = isViewingSearchResult ? search.hasMore : feed.hasMore;
  const loadMore = isViewingSearchResult ? search.loadMore : feed.loadMore;
  const retry = isViewingSearchResult ? search.retry : feed.retry;

  const { containerRef, activeIndex, setItemRef } = useActiveReel({ threshold: 0.8 });
  const [sentinelRef, sentinelVisible] = useIntersection<HTMLDivElement>({ threshold: 0.1 });

  const { isAuthenticated } = useAuthSession();
  const { openAuthModal } = useAuthModal();
  const GUEST_PREVIEW_LIMIT = 4;

  const [isMuted, setIsMuted] = useState(true);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  // Enforce guest preview limit (free preview of up to 4 reels)
  useEffect(() => {
    if (!isAuthenticated && activeIndex >= GUEST_PREVIEW_LIMIT) {
      setManuallyPaused(true);
      openAuthModal('to watch more reels and explore SawaFlix');
      const container = containerRef.current;
      if (container) {
        container.scrollTo({ top: (GUEST_PREVIEW_LIMIT - 1) * container.clientHeight, behavior: 'smooth' });
      }
    }
  }, [activeIndex, isAuthenticated, openAuthModal, containerRef]);

  // Remembers where the feed was scrolled to right before opening a search
  // result into the viewer, so leaving that viewer can put the user back
  // where they left off instead of snapping to the top.
  const savedFeedScrollTopRef = useRef(0);
  const wasViewingSearchResultRef = useRef(false);

  // True from the moment a search result is picked until the swipeable list
  // has actually scrolled to it and IntersectionObserver has confirmed that
  // card as active — covers the "which reel is even active yet" gap that
  // ReelCard's own per-reel spinner (isActive && !isPlayerReady) can't,
  // since that gap happens before any card is confirmed active at all.
  const [isOpeningResult, setIsOpeningResult] = useState(false);

  const handleSearchChange = useCallback(
    (value: string) => {
      // Editing the query again always drops back to showing the feed (with
      // the dropdown open) for whatever the new results turn out to be —
      // never straight back into an autoplay viewer for a stale selection.
      setSelectedSearchVideoId(null);
      setIsOpeningResult(false);
      search.setQuery(value);
    },
    [search]
  );

  const handleClearSearch = useCallback(() => {
    setSelectedSearchVideoId(null);
    setIsOpeningResult(false);
    search.clear();
  }, [search]);

  const handleSelectSearchResult = useCallback(
    (video: Video) => {
      // The feed's scroll position is never disturbed just by typing/
      // browsing the dropdown (it stays the visible content the whole
      // time) — the only moment it's actually about to change is right
      // here, switching to search.videos for the viewer.
      if (containerRef.current) {
        savedFeedScrollTopRef.current = containerRef.current.scrollTop;
      }
      setSelectedSearchVideoId(video.id);
      setIsOpeningResult(true);
    },
    [containerRef]
  );

  // Restore the feed's scroll position once the search-result viewer closes
  // (query edited again, or search cleared entirely) — mirrors the snapshot
  // taken in handleSelectSearchResult above.
  useEffect(() => {
    if (wasViewingSearchResultRef.current && !isViewingSearchResult && containerRef.current) {
      containerRef.current.scrollTop = savedFeedScrollTopRef.current;
    }
    wasViewingSearchResultRef.current = isViewingSearchResult;
  }, [isViewingSearchResult, containerRef]);

  // Entering viewingSearchResult: jump the swipeable list straight to the
  // row the user picked from the dropdown, once (not on every render — the
  // ref guard keyed to the id itself, not a boolean, so re-selecting after
  // a query change still scrolls correctly). The dropdown never mounts this
  // container at all, so there's no prior scroll position to preserve here.
  const scrolledToSelectionRef = useRef<string | null>(null);
  useEffect(() => {
    if (searchMode !== 'viewingSearchResult' || !selectedSearchVideoId) return;
    if (scrolledToSelectionRef.current === selectedSearchVideoId) return;
    const container = containerRef.current;
    if (!container) return;
    const index = videos.findIndex((v) => v.id === selectedSearchVideoId);
    if (index < 0) return;
    container.scrollTo({ top: index * container.clientHeight, behavior: 'auto' });
    scrolledToSelectionRef.current = selectedSearchVideoId;
  }, [searchMode, selectedSearchVideoId, videos, containerRef]);

  // Clears the "opening" overlay once activeIndex genuinely matches the
  // selected result — not just once the scroll above is issued, since the
  // IntersectionObserver still needs a moment to actually confirm it.
  useEffect(() => {
    if (!isOpeningResult || !selectedSearchVideoId) return;
    const targetIndex = videos.findIndex((v) => v.id === selectedSearchVideoId);
    if (targetIndex === activeIndex) {
      setIsOpeningResult(false);
    }
  }, [isOpeningResult, selectedSearchVideoId, videos, activeIndex]);

  // A fresh reel always starts playing — reset any manual pause from the
  // previous card when the active index changes.
  useEffect(() => {
    setManuallyPaused(false);
  }, [activeIndex]);

  // Deep link support (?id=VIDEO_ID): jump straight to that reel on mount.
  // The target card starts out as an inert placeholder (outside the ±1
  // mount window), but it's still observed — scrolling to it lets the
  // IntersectionObserver pick it up as active, which mounts a real
  // ReelCard there on the next render. Guarded by a ref (not just the
  // dependency array) so entering/leaving search mode later — which also
  // changes `videos` — can never re-trigger this a second time.
  const hasAppliedDeepLinkRef = useRef(false);
  useEffect(() => {
    if (hasAppliedDeepLinkRef.current || isSearching || !initialVideoId || videos.length === 0) return;
    hasAppliedDeepLinkRef.current = true;
    const index = videos.findIndex((v) => v.id === initialVideoId);
    const container = containerRef.current;
    if (index <= 0 || !container) return;
    container.scrollTo({ top: index * container.clientHeight, behavior: 'auto' });
  }, [videos, isSearching, initialVideoId, containerRef]);

  // Bridges this component's real search state/handlers up to the shared
  // dashboard Header (the top navbar), which is a sibling in the tree, not
  // a parent/child of this page — it can't read this via props. Header's
  // ReelsSearchBar only ever reads from and calls into this store; no
  // search logic lives there. No dependency array: cheap to run every
  // render, and it keeps the store honest without an exhaustive-deps list.
  useEffect(() => {
    useReelsSearchStore.setState({
      active: true,
      query: search.query,
      results: search.videos,
      loading: search.loading,
      error: search.error,
      hasMore: search.hasMore,
      showResults: searchMode === 'searching',
      setQuery: handleSearchChange,
      clear: handleClearSearch,
      loadMore: search.loadMore,
      retry: search.retry,
      selectResult: handleSelectSearchResult,
    });
  });

  // Reset the store on unmount (navigating away from Reels) so the navbar
  // never renders stale results or calls handlers from an unmounted page.
  useEffect(() => {
    return () => {
      useReelsSearchStore.setState({
        active: false,
        query: '',
        results: [],
        loading: false,
        error: null,
        hasMore: false,
        showResults: false,
        setQuery: () => {},
        clear: () => {},
        loadMore: async () => {},
        retry: async () => {},
        selectResult: () => {},
      });
    };
  }, []);

  // Bridges mute state up to the header the same way search is bridged
  // above — see store/reelsMuteStore.ts. Header's phone-only compact bar
  // renders its own mute button reading from this store; ReelHeader (the
  // in-video overlay) stays desktop-only.
  useEffect(() => {
    useReelsMuteStore.setState({ active: true, isMuted, toggleMute });
  });

  useEffect(() => {
    return () => {
      useReelsMuteStore.setState({ active: false, isMuted: true, toggleMute: () => {} });
    };
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MUTE_STORAGE_KEY);
      if (saved !== null) setIsMuted(saved === 'true');
    } catch {
      // localStorage unavailable (privacy mode, etc.) — default mute stands.
    }
  }, []);

  useEffect(() => {
    const checkIsDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkIsDesktop();
    window.addEventListener('resize', checkIsDesktop);
    return () => window.removeEventListener('resize', checkIsDesktop);
  }, []);

  // Infinite scroll: fetch the next page once the sentinel near the end
  // of the list scrolls into view.
  useEffect(() => {
    if (sentinelVisible && hasMore && !loading) {
      loadMore();
    }
  }, [sentinelVisible, hasMore, loading, loadMore]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (e.key === ' ') {
        e.preventDefault();
        setManuallyPaused((prev) => !prev);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // TikTok-style auto-advance: called by a card when its video ends.
  const goToNext = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!isAuthenticated && activeIndex >= GUEST_PREVIEW_LIMIT - 1) {
      setManuallyPaused(true);
      openAuthModal('to watch more reels and explore SawaFlix');
      return;
    }
    const nextIndex = Math.min(activeIndex + 1, videos.length - 1);
    container.scrollTo({ top: nextIndex * container.clientHeight, behavior: 'smooth' });
  }, [activeIndex, videos.length, containerRef, isAuthenticated, openAuthModal]);

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MUTE_STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Search itself now lives in the top navbar (components/Dashboard/Header.tsx's
  // ReelsSearchBar, via the store above) — ReelHeader here is just the mute
  // toggle. Always mounted, including through loading/error, so it stays
  // sticky. The feed below keeps rendering the whole time a search is open
  // (forced-paused via searchMode === 'searching' below) — it only swaps to
  // showing something else if a specific search result gets opened.
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#0B0E14]">
      <ReelHeader isMuted={isMuted} onToggleMute={toggleMute} />

      {isOpeningResult ? (
        // Between picking a search result and the swipeable list actually
        // confirming it active (scroll + IntersectionObserver) — once this
        // clears, the now-active ReelCard's own spinner takes over for the
        // remaining "player initializing" stretch.
        <ReelLoading />
      ) : loading && videos.length === 0 ? (
        <ReelLoading />
      ) : error && videos.length === 0 ? (
        // viewingSearchResult can never have 0 videos (it only ever opens
        // from an already-populated dropdown row), so this is always the
        // normal feed's own error state — same one shown whether or not a
        // search happens to be open above it.
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[#0B0E14] px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <Film size={24} className="text-white/40" />
          </div>
          <h2 className="text-lg font-bold text-white">{error}</h2>
          <button
            type="button"
            onClick={retry}
            disabled={loading}
            className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw size={16} />
            Retry
          </button>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="relative h-full w-full snap-y snap-mandatory overflow-y-scroll scroll-smooth
                     lg:h-full lg:w-auto lg:aspect-[9/16] lg:max-h-full
                     lg:rounded-[1.75rem] lg:ring-1 lg:ring-white/10 lg:shadow-[0_25px_80px_-20px_rgba(0,0,0,0.85)]"
          style={{ scrollbarWidth: 'none' }}
        >
          {videos.map((video, index) => {
            const distance = Math.abs(index - activeIndex);
            const isActive = index === activeIndex;

            return (
              <div key={video.id} className="h-full w-full shrink-0 snap-start">
                {distance > 1 ? (
                  // Outside the mount window — an inert placeholder keeps
                  // scroll-snap geometry correct without a real player.
                  <div ref={setItemRef(index)} className="h-full w-full bg-black" />
                ) : (
                  <ReelCard
                    video={video}
                    isActive={isActive}
                    isPaused={!isActive || manuallyPaused || searchMode === 'searching'}
                    isMuted={isMuted}
                    isDesktop={isDesktop}
                    hasNext={index < videos.length - 1}
                    itemRef={setItemRef(index)}
                    onTogglePlay={() => setManuallyPaused((prev) => !prev)}
                    onEnded={goToNext}
                    onResume={() => setManuallyPaused(false)}
                  />
                )}
              </div>
            );
          })}

          {/* Loading the next page (append) — a full skeleton slot so
              swiping all the way to the current end during a fetch lands on
              a loading card instead of an abrupt stop with nothing there. */}
          {loading && hasMore && videos.length > 0 && (
            <div className="h-full w-full shrink-0 snap-start">
              <ReelLoading />
            </div>
          )}

          {/* Infinite-scroll trigger, placed a couple cards before the end so
              the next page has time to arrive before the user gets there. */}
          {hasMore && videos.length > 0 && <div ref={sentinelRef} className="h-1 w-full" />}
        </div>
      )}
    </div>
  );
}
