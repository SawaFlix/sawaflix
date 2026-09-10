'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useMusic } from '@/components/MusicContext';
import {
  NowPlayingSection,
  MusicCategoryRow,
  Track,
  MusicCategory,
  formatTime,
  getNextRepeatMode,
} from '@/components/Music';
import { BACKEND_URL } from '@/lib/apiConfig';

/**
 * Music Page
 * Main page component for music streaming and playback
 * Features:
 * - Now playing hero section with video/audio toggle
 * - Dynamic category rows with horizontal scrolling
 * - Full playback controls
 * - Responsive design with loading states
 */

export default function MusicPage(): React.ReactElement {
  // Get music context
  const {
    currentTrack: globalTrack,
    isPlaying,
    togglePlay,
    playNext,
    playPrev,
    playTrack,
    currentTime,
    duration,
    seekTo,
    volume,
    setVolume,
    muted,
    playerRef,
    setCurrentTime,
    setDuration,
    isVideoMode,
    setIsVideoMode,
  } = useMusic();

  // State management
  const [musicCategories, setMusicCategories] = useState<MusicCategory[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('sawa_music_categories');
        const cacheTime = localStorage.getItem('sawa_music_categories_time');
        if (cached && cacheTime && (Date.now() - parseInt(cacheTime)) < 2 * 24 * 60 * 60 * 1000) {
          return JSON.parse(cached);
        }
      } catch (e) {
        console.error("Cache read error", e);
      }
    }
    return [];
  });
  
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('sawa_music_categories');
      const cacheTime = localStorage.getItem('sawa_music_categories_time');
      if (cached && cacheTime && (Date.now() - parseInt(cacheTime)) < 2 * 24 * 60 * 60 * 1000) {
        return false;
      }
    }
    return true;
  });

  const [isFavorite, setIsFavorite] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        let adminCategories: MusicCategory[] = [];
        try {
          const adminUrl = process.env.NEXT_PUBLIC_ADMIN_BACKEND_URL || 'http://localhost:3001';
          const adminRes = await fetch(`${adminUrl}/api/public/music`);
          if (adminRes.ok) {
            const adminData = await adminRes.json();
            if (adminData.categories && Array.isArray(adminData.categories)) {
              adminCategories = adminData.categories;
            }
          }
        } catch (aErr) {
          console.warn('Could not fetch admin music:', aErr);
        }

        let ytCategories: MusicCategory[] = [];
        try {
          const res = await fetch(`${BACKEND_URL}/api/videos/external/youtube/music-categories`);
          if (res.ok) {
            ytCategories = await res.json();
          }
        } catch (yErr) {
          console.warn('Could not fetch youtube music categories:', yErr);
        }

        const merged: MusicCategory[] = [...adminCategories];
        for (const ytCat of ytCategories) {
          const existing = merged.find(
            (m) => m.category.toLowerCase().trim() === ytCat.category.toLowerCase().trim()
          );
          if (existing) {
            const existingIds = new Set(existing.videos.map((v) => String(v.id)));
            ytCat.videos.forEach((v) => {
              if (!existingIds.has(String(v.id))) {
                existing.videos.push(v);
              }
            });
          } else {
            merged.push(ytCat);
          }
        }

        if (merged.length > 0) {
          setMusicCategories(merged);
          try {
            localStorage.setItem('sawa_music_categories', JSON.stringify(merged));
            localStorage.setItem('sawa_music_categories_time', Date.now().toString());
          } catch (e) {}
        }
      } catch (err) {
        console.error('Failed to fetch music categories:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // Default fallback track
  const defaultTrack: Track = {
    id: 0,
    title: 'Select a Song',
    artist: 'Sawaflix Music',
    image: '/music4.jpg',
    src: '',
  };

  const currentTrack = globalTrack || defaultTrack;

  // Event handlers
  const handleShuffleToggle = (): void => {
    setIsShuffled(!isShuffled);
  };

  const handleRepeatToggle = (): void => {
    setRepeatMode(getNextRepeatMode(repeatMode));
  };

  const handleVolumeChange = (newVol: number): void => {
  setVolume(newVol);
};

  // Render skeleton loader
  const renderSkeleton = (): React.ReactElement => (
    <div className="animate-pulse space-y-8">
      <div className="h-64 bg-gray-800 rounded-2xl w-full"></div>
      <div>
        <div className="h-8 bg-gray-800 rounded w-48 mb-4"></div>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex-shrink-0 w-36 sm:w-48 space-y-3">
              <div className="w-full aspect-square bg-gray-800 rounded-lg"></div>
              <div className="h-4 bg-gray-800 rounded w-3/4"></div>
              <div className="h-3 bg-gray-800 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-full bg-gray-900 text-white p-2 xs:p-3 sm:p-6 lg:p-8 pb-32">
      {/* Page Header */}
      <div className="mb-4 sm:mb-8 flex flex-col xs:flex-row items-start xs:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl xs:text-2xl sm:text-3xl font-bold mb-1 truncate">
            Sawa Music
          </h1>
          <p className="text-xs xs:text-sm sm:text-base text-gray-400 truncate">
            Listen or Watch Cameroonian hits
          </p>
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        renderSkeleton()
      ) : (
        <div className="space-y-8">
          {/* Now Playing Section */}
          <NowPlayingSection
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            isVideoMode={isVideoMode}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            playerRef={playerRef}
            isShuffled={isShuffled}
            repeatMode={repeatMode}
            isFavorite={isFavorite}
            onPlayPause={togglePlay}
            onPrev={playPrev}
            onNext={playNext}
            onShuffleToggle={handleShuffleToggle}
            onRepeatToggle={handleRepeatToggle}
            onFavoriteToggle={() => setIsFavorite(!isFavorite)}
            onSeek={seekTo}
            onVolumeChange={handleVolumeChange}
            onVideoModeChange={setIsVideoMode}
            onReplay={() => seekTo(0)}
            onCurrentTimeUpdate={setCurrentTime}
            onDurationUpdate={setDuration}
            onTrackEnd={playNext}
          />

          {/* Category Rows */}
          <div className="space-y-10">
            {musicCategories.map((categoryData, categoryIdx) => (
              <MusicCategoryRow
                key={categoryIdx}
                category={categoryData}
                isPlaying={isPlaying}
                currentTrackId={globalTrack?.id}
                onTrackClick={(track: Track, playlist: Track[]) => {
                  playTrack(track, playlist);
                }}
                onPlayPauseCurrentTrack={togglePlay}
              />
            ))}

            {musicCategories.length === 0 && !isLoading && (
              <div className="text-center py-12 text-gray-400">
                <p className="text-lg font-semibold">No music categories available</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Styles */}
      <style jsx global>{`
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
