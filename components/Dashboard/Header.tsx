'use client';

import React, { useState, useEffect } from 'react';
import { 
  Menu, 
  X, 
  Search, 
  Bell, 
  User, 
  Settings, 
  ChevronDown, 
  ChevronRight, 
  ArrowLeft, 
  CheckCheck, 
  Volume2, 
  VolumeX, 
  UserPlus, 
  LogOut, 
  Video, 
  Film, 
  Bookmark, 
  Edit3, 
  BookOpen, 
  HelpCircle, 
  ShieldCheck 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import { handleSignOut } from '../../app/(auth)/actions';
import SawaflixLogo from '../SawaflixLogo';
import { useAdminNotifications } from '../../contexts/AdminNotificationContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { NotificationDropdown } from '../notifications/NotificationDropdown';
import NotificationPanel from './NotificationPanel';
import { YouTubeApiService } from '../../services/youtubeApi';
import { getStories } from '../../lib/sanity/queries';
import { urlFor } from '../../lib/sanity/client';
import { MOVIES_DATA } from '../Movie/constants';
import { ReelsSearchBar } from '../reels/ReelsSearchBar';
import { useAuthSession } from '../../hooks/useAuthSession';
import { useAuthModal } from '../../contexts/AuthModalContext';
import { mapYoutubeItem } from '@/utils/reels/mapYoutubeItem';
import { useHomeSearchStore } from '@/store/homeSearchStore';
import { stashReelForHandoff } from '@/utils/reels/reelHandoff';
import { useReelsMuteStore } from '@/store/reelsMuteStore';

const youtubeApi = new YouTubeApiService();

type UserProfileData = {
  username: string | null;
  email: string | null;
  profile_image_url: string | null;
};

const Header = ({
  sidebarOpen,
  toggleSidebar,
  hideSearch,
  searchDisabled,
  isReelsRoute,
}: {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  hideSearch?: boolean;
  /** Suppresses the global search UI only — unlike hideSearch, doesn't switch notifications to admin context. Used on /dashboard/reels, which renders its own search (ReelsSearchBar) in this same slot instead. */
  searchDisabled?: boolean;
  /** Renders Reels' own search bar (via the shared store) in the slot the global search normally occupies. */
  isReelsRoute?: boolean;
}) => {
  const [searchValue, setSearchValue] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileSearchBar, setShowMobileSearchBar] = useState(false);
  const { user: currentUser, isAuthenticated } = useAuthSession();
  const { openAuthModal } = useAuthModal();
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<{videos: any[], stories: any[], movies: any[]}>({ videos: [], stories: [], movies: [] });
  const [isSearching, setIsSearching] = useState(false);
  const { isMuted, toggleMute } = useReelsMuteStore();

  // Notifications logic
  const adminNotificationContext = useAdminNotifications();
  const userNotificationContext = useNotifications();
  
  const { 
    notifications, 
    unreadCount, 
    markRead, 
    markAllRead, 
    deleteNotification,
    handleNotificationClick,
    isSubscribed,
    subscribe,
    unsubscribe
  } = hideSearch 
    ? { ...adminNotificationContext, handleNotificationClick: () => {}, isSubscribed: true, subscribe: async () => true, unsubscribe: async () => {}, deleteNotification: () => {} } 
    : userNotificationContext;

  const router = useRouter();

  useEffect(() => {
    if (!currentUser) {
      setUserProfile(null);
      return;
    }

    const fetchUserProfile = async () => {
      const supabase = createClient();
      const { data: profileData, error } = await supabase
        .from('users')
        .select('username, email, profile_image_url')
        .eq('id', currentUser.id)
        .maybeSingle<UserProfileData>();

      if (error) {
        console.error('Error fetching user profile:', error.message);
      } else if (profileData) {
        setUserProfile(profileData);
      }
    };

    fetchUserProfile();
  }, [currentUser]);

  // Debounced Search Effect
  useEffect(() => {
    const fetchSearchResults = async () => {
      if (!searchValue.trim()) {
        setSearchResults({ videos: [], stories: [], movies: [] });
        return;
      }
      setIsSearching(true);
      try {
        const q = searchValue.toLowerCase();
        
        // Fetch videos and stories in parallel
        const [videoRes, allStories] = await Promise.all([
          youtubeApi.searchVideos(`Cameroon ${q}`, null, 5).catch(() => ({ items: [] })),
          getStories().catch(() => [])
        ]);

        const filteredStories = (allStories || []).filter((s: any) => 
          s.title?.toLowerCase().includes(q) || s.excerpt?.toLowerCase().includes(q)
        ).slice(0, 5);

        const filteredMovies = MOVIES_DATA.filter((m: any) =>
          m.title?.toLowerCase().includes(q) || m.genre?.some((g: string) => g.toLowerCase().includes(q))
        ).slice(0, 5);

        setSearchResults({
          videos: videoRes.items || [],
          stories: filteredStories,
          movies: filteredMovies
        });
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(() => {
      fetchSearchResults();
    }, 400);

    return () => clearTimeout(timer);
  }, [searchValue]);

  // Keyboard shortcuts: Escape to close, ⌘K / Ctrl+K to open
  useEffect(() => {
    if (searchDisabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSearchFocused) {
        setIsSearchFocused(false);
        setSearchValue('');
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchFocused(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchFocused, searchDisabled]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      router.push(`/dashboard?q=${encodeURIComponent(searchValue.trim())}`);
      setShowMobileSearchBar(false);
      setIsSearchFocused(false);
    }
  };

  const getImageUrl = (image: any, fallbackIndex: number) => {
    if (image?.asset) return urlFor(image).url();
    const fallbacks = [
      '/images/bg1.jpg', '/images/bg2.jpg', '/images/bg3.jpg',
      '/images/bg4.jpg', '/images/bg5.jpg', '/images/bg6.jpg'
    ];
    return fallbacks[fallbackIndex % fallbacks.length];
  };

  return (
    <>
    <header
      className={
        isReelsRoute
          ? 'fixed top-0 left-0 right-0 z-50 h-14 bg-transparent md:bg-[#0B0E14]/40 md:backdrop-blur-md md:border-b md:border-white/5 md:shadow-2xl'
          : 'fixed top-0 left-0 right-0 z-50 h-14 bg-[#0B0E14]/40 backdrop-blur-md border-b border-white/5 shadow-2xl'
      }
    >
      {/* Phone-only compact bar for Reels (TikTok-style) */}
      {isReelsRoute && (
        <div className="flex md:hidden items-center h-full px-3 gap-1.5">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-white/20"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="flex flex-1 items-center justify-end">
            <ReelsSearchBar floating />
          </div>

          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            aria-pressed={!isMuted}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-white/20"
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      )}

      <div className={`${isReelsRoute ? 'hidden md:flex' : 'flex'} items-center justify-between h-full pl-3 pr-3 sm:pr-5 lg:pr-7`}>
        <div className="flex items-center">
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-1.5 mr-1 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <div className="flex items-center space-x-2 group">
            <Link href="/dashboard" className="flex items-center gap-2">
              <SawaflixLogo />
            </Link>
          </div>
        </div>

        {!hideSearch && !searchDisabled && (
          <div className="hidden md:flex flex-1 max-w-md lg:max-w-lg mx-6 relative">
              <button
                type="button"
                onClick={() => setIsSearchFocused(true)}
                className="w-full flex items-center justify-between pl-3.5 pr-3 py-1.5 bg-black/40 border border-white/10 rounded-xl
                           text-white/50 text-xs hover:border-white/30 hover:bg-black/60 transition-all duration-300 group"
              >
                <div className="flex items-center">
                  <Search className="text-gray-500 mr-2.5 group-hover:text-white transition-colors" size={14} />
                  <span>Search videos, top stories...</span>
                </div>
                <div className="hidden lg:flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[9px] font-semibold text-white/40 bg-white/5 border border-white/10 rounded">⌘</kbd>
                  <kbd className="px-1.5 py-0.5 text-[9px] font-semibold text-white/40 bg-white/5 border border-white/10 rounded">K</kbd>
                </div>
              </button>
            </div>
        )}

        {isReelsRoute && <ReelsSearchBar />}

        <div className="flex items-center space-x-1 sm:space-x-1.5">
          {!hideSearch && !searchDisabled && (
            <button
              onClick={() => setIsSearchFocused(true)}
              className="md:hidden p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              aria-label="Toggle search bar"
            >
              <Search size={17} />
            </button>
          )}

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => {
                if (!isAuthenticated) {
                  openAuthModal('to view notifications');
                  return;
                }
                setShowNotifications(!showNotifications);
              }}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all relative group cursor-pointer"
              aria-label="Notifications"
            >
              <Bell size={18} className="group-hover:scale-110 transition-transform" />
              {isAuthenticated && isSubscribed && unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[14.5px] h-[14.5px] px-0.5 bg-[#E50914] text-white font-black rounded-full flex items-center justify-center text-[8px] shadow-[0_0_10px_rgba(229,9,20,0.7)] animate-in zoom-in duration-300 pointer-events-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <NotificationPanel 
                title={hideSearch ? "Admin Alerts" : "Notifications"}
                subtitle={hideSearch ? `${unreadCount} pending actions` : `${unreadCount} new updates`}
                notifications={notifications.slice(0, 15).map(n => ({
                  id: n.id,
                  type: n.type,
                  title: n.title,
                  message: n.message,
                  read: n.read,
                  timestamp: (n as any).createdAt || (n as any).timestamp,
                  thumbnail: (n as any).thumbnail,
                  contentId: (n as any).contentId,
                  category: (n as any).category
                }))}
                unreadCount={unreadCount}
                onMarkAllRead={markAllRead}
                onClose={() => setShowNotifications(false)}
                onItemClick={(id) => {
                  const notification = notifications.find(n => n.id === id);
                  if (notification) {
                    handleNotificationClick(notification as any);
                  }
                  setShowNotifications(false);
                }}
                onDismissItem={(id) => {
                  deleteNotification(id);
                }}
                isSubscribed={isSubscribed}
                onSubscribe={subscribe}
                onUnsubscribe={unsubscribe}
                accentColor={hideSearch ? "red" : "white"}
                viewAllHref={hideSearch ? undefined : "/dashboard/notification"}
              />
            )}
          </div>

          {isAuthenticated ? (
            <Link href="/dashboard/settings" className="hidden sm:block p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer" aria-label="Settings">
              <Settings size={16} />
            </Link>
          ) : (
            <button
              onClick={() => openAuthModal('to access settings')}
              className="hidden sm:block p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              aria-label="Settings"
            >
              <Settings size={16} />
            </button>
          )}

          {isAuthenticated ? (
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-xl text-gray-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/20 transition-all duration-200 cursor-pointer group"
                aria-label="User profile menu"
              >
                {userProfile?.profile_image_url ? (
                  <div className="relative w-7 h-7 rounded-full overflow-hidden ring-2 ring-white/30 shadow-md flex-shrink-0 group-hover:ring-white/60 transition-all">
                    <Image
                      src={userProfile.profile_image_url}
                      alt="User Avatar"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-white font-bold text-[11px] ring-2 ring-white/20 shadow-md flex-shrink-0">
                    {(userProfile?.username || currentUser?.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-[11.5px] font-semibold text-white group-hover:text-zinc-200 transition-colors leading-none truncate max-w-[100px]">
                    {userProfile?.username || currentUser?.email?.split('@')[0]}
                  </span>
                  <span className="text-[8px] text-zinc-400 font-medium tracking-wider uppercase mt-0.5">
                    Account
                  </span>
                </div>
                <ChevronDown size={12} className={`text-zinc-400 group-hover:text-white transition-transform duration-200 ${showProfileMenu ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showProfileMenu && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-3 w-72 sm:w-80 bg-[#0C0F17]/95 backdrop-blur-2xl rounded-2xl sm:rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.85)] border border-white/10 p-2.5 z-50 overflow-hidden"
                  >
                    {/* Top User Card Header */}
                    <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl sm:rounded-2xl mb-2 flex items-center gap-3">
                      {userProfile?.profile_image_url ? (
                        <div className="relative w-11 h-11 rounded-full overflow-hidden ring-2 ring-white/30 shadow-md flex-shrink-0">
                          <Image
                            src={userProfile.profile_image_url}
                            alt="Avatar"
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-white font-bold text-sm ring-2 ring-white/20 shadow-md flex-shrink-0">
                          {(userProfile?.username || currentUser?.email || 'U')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-white truncate leading-tight">
                            {userProfile?.username || currentUser?.email?.split('@')[0]}
                          </p>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Online" />
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5 font-medium">
                          {currentUser?.email || 'Logged in user'}
                        </p>
                        <div className="mt-1.5 inline-flex items-center px-2 py-0.5 bg-white/10 border border-white/20 rounded-md text-[10px] font-bold text-white tracking-wider uppercase shadow-sm">
                          <span>Community Member</span>
                        </div>
                      </div>
                    </div>

                    {/* Navigation Items */}
                    <div className="space-y-0.5 py-1">
                      <Link 
                        href="/dashboard/profile" 
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-white/[0.04] text-zinc-400 group-hover:text-white group-hover:bg-white/10 transition-colors">
                            <User size={15} />
                          </div>
                          <span>My Profile</span>
                        </div>
                        <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
                      </Link>

                      <Link 
                        href="/dashboard/edit-profile" 
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-white/[0.04] text-zinc-400 group-hover:text-white group-hover:bg-white/10 transition-colors">
                            <Edit3 size={15} />
                          </div>
                          <span>Edit Profile</span>
                        </div>
                        <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
                      </Link>

                      <Link 
                        href="/dashboard/favorites" 
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-white/[0.04] text-zinc-400 group-hover:text-white group-hover:bg-white/10 transition-colors">
                            <Bookmark size={15} />
                          </div>
                          <span>Saved & Favorites</span>
                        </div>
                        <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
                      </Link>

                      <Link 
                        href="/dashboard/blogs" 
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-white/[0.04] text-zinc-400 group-hover:text-white group-hover:bg-white/10 transition-colors">
                            <BookOpen size={15} />
                          </div>
                          <span>Stories & Dev.to Blogs</span>
                        </div>
                        <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
                      </Link>

                      <Link 
                        href="/creator-dashboard" 
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-white/[0.04] text-zinc-400 group-hover:text-white group-hover:bg-white/10 transition-colors">
                            <Video size={15} />
                          </div>
                          <span>Creator Studio</span>
                        </div>
                        <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
                      </Link>

                      <div className="my-1.5 border-t border-white/[0.06]" />

                      <Link 
                        href="/dashboard/settings" 
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-white/[0.04] text-zinc-400 group-hover:text-white group-hover:bg-white/10 transition-colors">
                            <Settings size={15} />
                          </div>
                          <span>Settings</span>
                        </div>
                        <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
                      </Link>

                      <Link 
                        href="/dashboard/support" 
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-white/[0.04] text-zinc-400 group-hover:text-white group-hover:bg-white/10 transition-colors">
                            <HelpCircle size={15} />
                          </div>
                          <span>Help & Support</span>
                        </div>
                        <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
                      </Link>
                    </div>

                    {/* Sign Out Button */}
                    <div className="mt-1 pt-1.5 border-t border-white/[0.06]">
                      <form action={handleSignOut}>
                        <button
                          type="submit"
                          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/15 transition-colors cursor-pointer"
                        >
                          <div className="p-1.5 rounded-lg bg-red-500/15 text-red-400">
                            <LogOut size={15} />
                          </div>
                          <span className="font-bold text-red-400">Sign Out</span>
                        </button>
                      </form>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button
              onClick={() => openAuthModal('to create your account')}
              aria-label="Sign up"
              className="flex items-center justify-center rounded-xl bg-[#CE1126] text-white shadow-sm transition-all duration-200 hover:bg-red-700 cursor-pointer sm:bg-white sm:text-[#CE1126] sm:hover:bg-gray-100 sm:border sm:border-[#CE1126]/20 sm:px-4 sm:py-2.5 sm:shadow-md"
            >
              <UserPlus size={18} className="sm:mr-2" />
              <span className="hidden sm:inline text-sm font-bold">Sign Up</span>
            </button>
          )}
        </div>
      </div>
    </header>

      {showMobileSearchBar && (
        <div className="md:hidden absolute top-16 left-0 right-0 p-4 bg-gray-900/95 backdrop-blur-md border-b border-gray-800 shadow-lg animate-fade-in-down">
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onFocus={() => {
                document.getElementById('discover-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              placeholder="Search titles, people, genres..."
              className="w-full pl-10 pr-4 py-2 bg-black border border-white/60 rounded-sm
                         text-white placeholder-gray-500 focus:outline-none focus:ring-1 
                         focus:ring-white transition-all duration-200"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowMobileSearchBar(false)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              aria-label="Close search bar"
            >
              <X size={16} />
            </button>
          </form>
        </div>
      )}

      {showProfileMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowProfileMenu(false)}
        />
      )}

      {showNotifications && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowNotifications(false);
          }}
        />
      )}
    {/* Global Search Modal — Spotlight Style */}
    <AnimatePresence>
      {isSearchFocused && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => { setIsSearchFocused(false); setSearchValue(''); }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-[6px]"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-[101] flex items-start justify-center pt-[8vh] sm:pt-[12vh] px-3 sm:px-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.97 }}
              transition={{ type: 'spring', damping: 28, stiffness: 350 }}
              className="w-full max-w-[560px] bg-[#12151C] border border-white/[0.08] rounded-xl sm:rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden pointer-events-auto flex flex-col max-h-[70vh] sm:max-h-[65vh]"
            >
              {/* Search Input */}
              <form onSubmit={handleSearchSubmit} className="relative w-full shrink-0">
                <Search className="absolute left-4 sm:left-5 top-1/2 transform -translate-y-1/2 text-white/30" size={18} />
                <input
                  autoFocus
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Search videos, stories, movies..."
                  className="w-full pl-11 sm:pl-13 pr-11 py-3.5 sm:py-4 bg-transparent
                             text-white text-[15px] sm:text-base placeholder-white/25 focus:outline-none tracking-wide"
                />
                {searchValue ? (
                  <button
                    type="button"
                    onClick={() => setSearchValue('')}
                    className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 p-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
                  >
                    <X size={14} />
                  </button>
                ) : (
                  <kbd className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-white/20 bg-white/[0.04] border border-white/[0.06] rounded">
                    ESC
                  </kbd>
                )}
                <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
              </form>

              {/* Results Container */}
              <div className="overflow-y-auto flex-1 overscroll-contain" style={{ scrollbarWidth: 'none' }}>
                {searchValue.trim() ? (
                  isSearching ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-3">
                      <div className="w-5 h-5 border-[1.5px] border-white/20 border-t-white/60 rounded-full animate-spin" />
                      <span className="text-[11px] text-white/20 tracking-widest uppercase font-medium">Searching...</span>
                    </div>
                  ) : searchResults.videos.length === 0 && searchResults.stories.length === 0 && searchResults.movies.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-white/25">
                      <Search size={24} className="mb-2.5 opacity-40" />
                      <p className="text-sm font-medium">No results for &quot;{searchValue}&quot;</p>
                      <p className="text-xs text-white/15 mt-1">Try a different keyword</p>
                    </div>
                  ) : (
                    <div className="py-2">
                      {/* Stories Section */}
                      {searchResults.stories.length > 0 && (
                        <div className="mb-1">
                          <div className="px-4 py-2 text-[10px] font-bold tracking-[0.15em] uppercase text-white/25">Stories</div>
                          {searchResults.stories.map((story: any, idx: number) => (
                            <button
                              key={story._id || idx}
                              onClick={() => {
                                setIsSearchFocused(false);
                                setSearchValue('');
                                router.push(`/dashboard/blogs/${story.slug?.current}`);
                              }}
                              className="flex items-center gap-3 w-full px-4 py-2 hover:bg-white/[0.04] transition-colors text-left group"
                            >
                              <div className="w-9 h-9 sm:w-10 sm:h-10 relative rounded-lg overflow-hidden flex-shrink-0 bg-white/[0.04]">
                                <Image src={getImageUrl(story.mainImage, idx)} alt={story.title} fill className="object-cover" unoptimized />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-[13px] font-semibold text-white/80 truncate group-hover:text-white transition-colors">{story.title}</h4>
                                <p className="text-[11px] text-white/30 truncate mt-0.5">{story.category?.title || 'Story'}</p>
                              </div>
                              <ArrowLeft size={12} className="text-white/10 group-hover:text-white/30 transition-colors rotate-180 flex-shrink-0" />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Videos Section */}
                      {searchResults.videos.length > 0 && (
                        <div className="mb-1">
                          <div className="px-4 py-2 text-[10px] font-bold tracking-[0.15em] uppercase text-white/25">Videos</div>
                          {searchResults.videos.map((video: any, idx: number) => {
                            // Same canonical mapper Reels itself uses — not a
                            // second ad-hoc field-extraction implementation.
                            const mapped = mapYoutubeItem(video);
                            return (
                              <button
                                key={mapped.id || idx}
                                onClick={() => {
                                  setIsSearchFocused(false);
                                  // Doesn't play this video directly — shows
                                  // the whole search's results in the home
                                  // page's own Reels row (DashboardLanding),
                                  // the same card style/location reels
                                  // normally appear in. Picking a card from
                                  // there is what actually opens it into the
                                  // real Reels page.
                                  useHomeSearchStore.setState({
                                    query: searchValue,
                                    results: searchResults.videos.map((v: any) => mapYoutubeItem(v)),
                                  });
                                  setSearchValue('');
                                  // Same handoff the right sidebar uses: hand the
                                  // already-fetched video straight to Reels so it
                                  // opens playing, instead of just filtering the
                                  // dashboard's own feed by title text.
                                  stashReelForHandoff(mapped);
                                  router.push(`/dashboard/reels?id=${encodeURIComponent(mapped.id)}`);
                                }}
                                className="flex items-center gap-3 w-full px-4 py-2 hover:bg-white/[0.04] transition-colors text-left group"
                              >
                                <div className="w-14 h-9 sm:w-16 sm:h-10 relative rounded-lg overflow-hidden flex-shrink-0 bg-white/[0.04]">
                                  <Image src={mapped.thumbnail} alt="Thumbnail" fill className="object-cover" unoptimized />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-[13px] font-semibold text-white/80 line-clamp-1 group-hover:text-white transition-colors">{mapped.title}</h4>
                                  <p className="text-[11px] text-white/30 truncate mt-0.5">{mapped.channelTitle}</p>
                                </div>
                                <ArrowLeft size={12} className="text-white/10 group-hover:text-white/30 transition-colors rotate-180 flex-shrink-0" />
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Movies Section */}
                      {searchResults.movies?.length > 0 && (
                        <div className="mb-1">
                          <div className="px-4 py-2 text-[10px] font-bold tracking-[0.15em] uppercase text-white/25">Movies & Series</div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 px-4 pb-2">
                            {searchResults.movies.map((movie: any, idx: number) => (
                              <button
                                key={movie.id || idx}
                                onClick={() => {
                                  setIsSearchFocused(false);
                                  setSearchValue('');
                                  router.push(`/dashboard/movie`);
                                }}
                                className="group flex flex-col rounded-lg overflow-hidden bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] hover:border-white/[0.1] transition-all"
                              >
                                <div className="w-full aspect-[2/3] relative overflow-hidden">
                                  <Image src={movie.image || '/images/bg1.jpg'} alt={movie.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                                  <div className="absolute bottom-1.5 left-1.5">
                                    <span className="px-1.5 py-0.5 bg-white/10 backdrop-blur-sm rounded text-[9px] font-bold text-white/70">{movie.year}</span>
                                  </div>
                                </div>
                                <div className="p-2">
                                  <h4 className="text-[11px] sm:text-xs font-semibold text-white/70 truncate group-hover:text-white transition-colors">{movie.title}</h4>
                                  <p className="text-[9px] sm:text-[10px] text-white/25 truncate mt-0.5">{movie.genre?.slice(0, 2).join(' · ')}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-white/20">
                    <Search size={20} className="mb-2 opacity-30" />
                    <p className="text-[13px]">Search across SawaFlix</p>
                  </div>
                )}
              </div>
              
              {/* Footer */}
              {searchValue.trim() && (searchResults.videos.length > 0 || searchResults.stories.length > 0 || searchResults.movies?.length > 0) && (
                <button 
                  onClick={handleSearchSubmit}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.06] text-[11px] font-semibold text-white/40 hover:text-white/60 tracking-widest uppercase border-t border-white/[0.06] transition-all shrink-0"
                >
                  <span>View all results</span>
                  <ArrowLeft size={10} className="rotate-180" />
                </button>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
    </>
  );
};

export default Header;