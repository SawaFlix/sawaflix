'use client';
import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../../lib/apiConfig';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  LayoutGrid,
  Upload,
  BarChart2,
  MessageSquare,
  Film,
  Music,
  User,
  FileText,
  Workflow,
  Wallet,
  Heart,
  Tv,
  MonitorPlay,
  BookOpen,
  Download,
  Clapperboard
} from 'lucide-react';
import Image from 'next/image';
import { createClient } from '../../utils/supabase/client';
import { usePathname } from 'next/navigation';
import { useAuthSession } from '../../hooks/useAuthSession';
import { useAuthModal } from '../../contexts/AuthModalContext';

// Define a type for the user profile data from your 'users' table
type UserProfileData = {
  username: string | null;
  email: string | null;
  profile_image_url: string | null;
};

export default function LeftSidebar({ 
  onNavigate, 
  verificationStatus: propStatus,
  userRole: propUserRole,
  userProfile: propProfile
}: { 
  onNavigate?: () => void;
  verificationStatus?: string;
  userRole?: string;
  userProfile?: any;
}) {
  const pathname = usePathname();
  const { isAuthenticated } = useAuthSession();
  const { openAuthModal } = useAuthModal();
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(propProfile || null);
  const [verificationStatus, setVerificationStatus] = useState<string>(propStatus || 'none');
  const [userRole, setUserRole] = useState<string | null>(propUserRole || null);
  const [loading, setLoading] = useState(!propProfile);

  // Update local state if props change
  useEffect(() => {
    if (propStatus) setVerificationStatus(propStatus);
  }, [propStatus]);

  useEffect(() => {
    if (propUserRole) setUserRole(propUserRole);
  }, [propUserRole]);

  useEffect(() => {
    if (propProfile) {
      setUserProfile(propProfile);
      setLoading(false);
    }
  }, [propProfile]);

  // Fallback fetching if props are missing (e.g. standalone usage)
  useEffect(() => {
    if (propStatus && propProfile) return; // Skip if we have props

    const fetchUserData = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (user && session) {
        if (!propProfile) {
            const { data: profileData } = await supabase
              .from('users')
              .select('username, email, profile_image_url')
              .eq('id', user.id)
              .single<UserProfileData>();

            if (profileData) {
              setUserProfile(profileData);
            }
        }

        if (!propStatus) {
            try {
              const res = await fetch(`${BACKEND_URL}/api/creator/profile`, {
                headers: {
                  'Authorization': `Bearer ${session.access_token}`
                }
              });
              if (res.ok) {
                const data = await res.json();
                setVerificationStatus(data.verificationStatus);
              }
            } catch (err) {
              console.error('Error fetching verification status:', err);
            }
        }
      }
      setLoading(false);
    };

    fetchUserData();
  }, [propStatus, propProfile]);

  const topItems = [
    { name: 'Home', icon: Home, id: 'feed', route: '/dashboard', badge: null },
    { name: 'Reels', icon: Clapperboard, imageUrl: '/logos_and_pwas/loaderLogo.png', id: 'reels', route: '/dashboard/reels', badge: null },
  ];

  const exploreItems = [
    { name: 'Movies', icon: Film, id: 'movies', route: '/dashboard/movie', badge: null, requiresAuth: true },
    { name: 'Music', icon: Music, id: 'music', route: '/dashboard/musicpage', badge: 'New', requiresAuth: true },
    { name: 'Live TV', icon: Tv, id: 'livetv', route: '/dashboard/livetv', badge: 'Live', requiresAuth: true },
    { name: 'Series', icon: MonitorPlay, id: 'series', route: '/dashboard/series', badge: null, requiresAuth: true },
    { name: 'Education', icon: BookOpen, id: 'education', route: '/dashboard/education', badge: null, requiresAuth: true },
    { name: 'Artists', icon: User, id: 'artists', route: '/dashboard/artists', badge: null, requiresAuth: true },
    { name: 'Area Tory', icon: FileText, id: 'blogs', route: '/dashboard/blogs', badge: null, requiresAuth: true },
  ];

  const youItems: any[] = [
    {
      name: 'Your profile',
      icon: userProfile?.profile_image_url ? null : User,
      imageUrl: userProfile?.profile_image_url,
      id: 'profile',
      route: '/dashboard/profile',
      badge: null,
      requiresAuth: true,
    },
    { name: 'Favorites', icon: Heart, id: 'favorites', route: '/dashboard/favorites', badge: null, requiresAuth: true },
    { name: 'Downloads', icon: Download, id: 'downloads', route: '/dashboard/downloads', badge: null, requiresAuth: true },
    { name: 'Wallet', icon: Wallet, id: 'wallet', route: '/dashboard/wallet', badge: null, requiresAuth: true },
    { name: 'SawaSmart', icon: Workflow, id: 'SawaSmart', route: '/dashboard/sawasmart', badge: null, requiresAuth: true },
  ];

  const creatorItems = [
    { name: 'Post', icon: LayoutGrid, id: 'post', route: '/creator-dashboard', badge: null, requiresAuth: true },
    { name: 'My Content', icon: Film, id: 'my-content', route: '/creator-dashboard/content', badge: null, requiresAuth: true },
    { name: 'Analytics', icon: BarChart2, id: 'analytics', route: '/creator-dashboard/analytics', badge: null, requiresAuth: true },
    { name: 'Comments', icon: MessageSquare, id: 'comments', route: '/creator-dashboard/comments', badge: null, requiresAuth: true },
  ];

  const handleItemClick = () => {
    // Close sidebar on mobile when navigating
    onNavigate?.();
  };

  const renderItem = (item: any) => {
    const Icon = item.icon;
    let isActive = false;
    
    if (item.route === '/dashboard') {
      isActive = pathname === '/dashboard';
    } else if (item.name === 'Music') {
      isActive = pathname?.toLowerCase().includes('/dashboard/music') || pathname?.toLowerCase().includes('/dashboard/artist');
    } else {
      isActive = pathname?.toLowerCase().startsWith(item.route.toLowerCase());
    }

    const needsAuth = item.requiresAuth && !isAuthenticated;

    return (
      <Link
        key={item.id}
        href={item.route}
        onClick={(e) => {
          if (needsAuth) {
            e.preventDefault();
            openAuthModal(`to access ${item.name}`);
            return;
          }
          handleItemClick();
        }}
        className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg transition-all duration-200 group cursor-pointer ${isActive
            ? 'bg-white/10 text-white font-medium'
            : 'text-[#AAAAAA] hover:bg-white/10 hover:text-white'
          }`}
      >
        <div className="flex items-center space-x-4">
          {item.imageUrl ? (
            <div className={`relative shrink-0 ${item.id === 'reels' ? 'h-6 w-6' : 'h-5 w-5 rounded-full overflow-hidden'}`}>
              <Image src={item.imageUrl} alt={item.id === 'reels' ? '' : 'Profile'} fill className={item.id === 'reels' ? 'object-contain' : 'object-cover'} unoptimized />
            </div>
          ) : (
            Icon && <Icon
              size={20}
              className={`transition-colors shrink-0 ${isActive ? 'text-white' : 'text-[#AAAAAA] group-hover:text-white'}`}
            />
          )}
          <span className={`text-sm tracking-tight ${isActive ? 'font-semibold' : ''}`}>
            {item.name}
          </span>
        </div>

        {item.badge && (
          <span className={`px-2 py-0.5 text-[9px] rounded-md font-black uppercase tracking-widest bg-white text-black`}>
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#06080C] border-r border-white/5">
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto scrollbar-none">
        {/* Top Section */}
        <div className="space-y-1 mb-6">
          {topItems.map(renderItem)}
        </div>

        {/* Explore Section */}
        <div className="space-y-1 mb-6">
          <h3 className="px-3 py-2 text-[13px] font-black uppercase tracking-[0.1em] text-zinc-500 mb-2">
            Explore
          </h3>
          {exploreItems.map(renderItem)}
        </div>

        {/* You Section */}
        <div className="space-y-1 mb-6">
          <Link
            href="/dashboard/profile"
            onClick={(e) => {
              if (!isAuthenticated) {
                e.preventDefault();
                openAuthModal('to access your account');
                return;
              }
              onNavigate?.();
            }}
            className="group flex items-center px-3 py-2 hover:bg-white/5 rounded-lg cursor-pointer w-fit mb-2"
          >
            <span className="text-[13px] font-black uppercase tracking-[0.1em] text-zinc-500 group-hover:text-white transition-colors">You</span>
            <ChevronRight size={14} className="ml-1 text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
          </Link>
          {loading ? (
            <div className="space-y-2 px-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4 py-2 animate-pulse">
                  <div className="w-5 h-5 bg-white/5 rounded-full" />
                  <div className="w-24 h-3 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : (
            youItems.map(renderItem)
          )}
        </div>

        {loading ? (
          <div className="space-y-1 mb-6">
            <div className="px-3 py-2 w-24 h-3 bg-white/5 rounded mb-4 animate-pulse ml-3" />
            <div className="space-y-2 px-3">
              {[1, 2].map(i => (
                <div key={i} className="flex items-center gap-4 py-2 animate-pulse">
                  <div className="w-5 h-5 bg-white/5 rounded" />
                  <div className="w-28 h-3 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          userRole?.toLowerCase() === 'creator' && (
            <div className="space-y-1 mb-6">
              <h3 className="px-3 py-2 text-[13px] font-black uppercase tracking-[0.1em] text-zinc-500 mb-2">
                Creator Hub
              </h3>
              {creatorItems.map(renderItem)}
            </div>
          )
        )}


      </nav>
    </div>
  );
}
