"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Calendar, Loader2, Heart, MessageCircle, Eye } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { formatCount } from "@/utils/formatCount";

import { getStories, getCategories } from "@/lib/sanity/queries";
import { urlFor } from "@/lib/sanity/client";

interface SanityStory {
  _id: string;
  title: string;
  slug: { current: string };
  excerpt: string;
  mainImage: any;
  publishedAt: string;
  readTime: string;
  featured: boolean;
  likes: number;
  views: number;
  category: {
    _id: string;
    title: string;
    slug: { current: string };
    color: string;
  };
  author: {
    _id: string;
    name: string;
    avatar: any;
    role: string;
  };
}

interface SanityCategory {
  _id: string;
  title: string;
  slug: { current: string };
  color: string;
}

// Fallback static stories for when Sanity is unavailable
const fallbackStories = [
  {
    _id: "fallback-1",
    title: "The Sacred Ngondo Festival: Spirits of the Wouri",
    slug: { current: "ngondo-festival" },
    category: { _id: "c1", title: "Culture", slug: { current: "culture" }, color: "#E50914" },
    author: { _id: "a1", name: "Sawaflix Heritage Team", avatar: null, role: "Editorial" },
    publishedAt: "2024-12-12T10:00:00Z",
    mainImage: null,
    excerpt: "Exploring the sacred communication with water spirits (Miengu) on the banks of the Wouri River.",
    readTime: "6 min read",
    featured: true,
    likes: 1200,
    views: 8900,
  },
  {
    _id: "fallback-2",
    title: "Sawaflix Originals: New Creators Program Launch",
    slug: { current: "creators-program" },
    category: { _id: "c2", title: "Announcement", slug: { current: "announcement" }, color: "#3B82F6" },
    author: { _id: "a1", name: "Sawaflix Heritage Team", avatar: null, role: "Editorial" },
    publishedAt: "2025-01-05T10:00:00Z",
    mainImage: null,
    excerpt: "We're investing in local talent to bring more authentic African stories to your screen.",
    readTime: "4 min read",
    featured: false,
    likes: 890,
    views: 5600,
  },
];

export default function StoryGrid() {
  const [stories, setStories] = useState<SanityStory[]>([]);
  const [categories, setCategories] = useState<SanityCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(6);

  useEffect(() => {
    let isMounted = true;
    console.log("[StoryGrid] Mounting and fetching data...");

    async function fetchData() {
      try {
        setLoading(true);
        
        // Fetch stories and categories with a timeout fallback
        const storiesPromise = getStories();
        const categoriesPromise = getCategories();
        
        const [storiesData, categoriesData] = await Promise.all([
          storiesPromise,
          categoriesPromise,
        ]);

        console.log(`[StoryGrid] Fetched ${storiesData?.length || 0} stories and ${categoriesData?.length || 0} categories.`);

        if (isMounted) {
          if (storiesData && storiesData.length > 0) {
            setStories(storiesData);
          } else {
            console.warn("[StoryGrid] No stories found in Sanity, using fallbacks.");
            setStories(fallbackStories);
          }
          
          if (categoriesData) {
            setCategories(categoriesData);
          }
        }
      } catch (error) {
        console.error("[StoryGrid] Error during fetch:", error);
        if (isMounted) setStories(fallbackStories);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchData();
    return () => { isMounted = false; };
  }, []);

  // Filter stories by active category
  const filteredStories =
    activeCategory === "all"
      ? stories
      : stories.filter(
          (s) => s.category?.slug?.current === activeCategory
        );

  const displayedStories = filteredStories.slice(0, visibleCount);

  // Format date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Get image URL or fallback
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

  return (
    <section className="py-24 bg-[#0B0E14] relative overflow-hidden">
      {/* Abstract Background Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/5 blur-[120px] rounded-full" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-red-600/5 blur-[120px] rounded-full" />

      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6 relative z-30">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-white mb-2 tracking-tighter">
              Latest stories
            </h2>
            <p className="text-gray-500 text-sm font-medium max-w-lg">
              Stay updated with cultural insights, community news, and cinematic releases.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => { setActiveCategory("all"); setVisibleCount(6); }}
              className={`px-4 py-1.5 rounded-lg border text-[10px] font-bold transition-all duration-300 cursor-pointer tracking-widest ${
                activeCategory === "all"
                  ? "border-white text-white bg-white/10"
                  : "border-white/10 text-gray-400 hover:border-white/40 hover:text-white hover:bg-white/5"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat._id}
                onClick={() => { 
                  if (cat.slug?.current) {
                    setActiveCategory(cat.slug.current); 
                    setVisibleCount(6); 
                  }
                }}
                className={`px-4 py-1.5 rounded-lg border text-[10px] font-bold transition-all duration-300 cursor-pointer tracking-widest ${
                  activeCategory === (cat.slug?.current || "")
                    ? "border-white text-white bg-white/10"
                    : "border-white/10 text-gray-400 hover:border-white/40 hover:text-white hover:bg-white/5"
                }`}
              >
                {cat.title}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-red-600 animate-spin" />
            <span className="ml-3 text-gray-400 text-sm font-medium">Loading stories...</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredStories.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500 text-sm">No stories found in this category yet.</p>
          </div>
        )}

        {/* Story Grid */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedStories.map((story, index) => (
              <div
                key={story._id}
                className="group relative bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-red-600/30 transition-all"
              >
                {/* Image Container */}
                <div className="relative h-48 overflow-hidden">
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                    style={{ backgroundImage: `url(${getImageUrl(story.mainImage, index)})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E14] to-transparent opacity-50" />

                  {/* Category Badge */}
                  <div className="absolute top-3 left-3">
                    <span
                      className="px-2 py-0.5 text-white text-[9px] font-bold rounded-md tracking-widest backdrop-blur-md"
                      style={{ backgroundColor: (story.category?.color || "#E50914") + "E6" }}
                    >
                      {story.category?.title || "Uncategorized"}
                    </span>
                  </div>

                  {/* Featured badge */}
                  {story.featured && (
                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-0.5 bg-yellow-500/90 text-black text-[9px] font-bold rounded-md tracking-widest">
                        Featured
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5">
                  <div className="flex items-center gap-3 text-gray-500 text-[9px] font-bold tracking-widest mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {formatDate(story.publishedAt)}
                    </div>
                    <div className="w-1 h-1 rounded-full bg-gray-700" />
                    <span>{story.readTime || "5 min read"}</span>
                  </div>

                  <h3 className="text-base font-bold text-white mb-2 group-hover:text-red-500 transition-colors leading-snug">
                    {story.title}
                  </h3>

                  <p className="text-gray-400 text-[11px] font-medium line-clamp-2 mb-4 leading-relaxed opacity-80">
                    {story.excerpt}
                  </p>

                  {/* Stats Row */}
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
                        <span className="font-mono text-[10px] font-medium text-zinc-300">{formatCount(story.likes)}</span>
                      </span>
                      <span className="flex items-center gap-1 hover:text-white transition-colors" title="Comments">
                        <MessageCircle className="w-3 h-3 text-zinc-400" />
                        <span className="font-mono text-[10px] font-medium text-zinc-300">{formatCount(story.comments)}</span>
                      </span>
                    </div>
                    <span className="flex items-center gap-1 text-zinc-500" title="Views">
                      <Eye className="w-3 h-3 text-zinc-400" />
                      <span className="font-mono text-[10px] font-medium text-zinc-400">{formatCount(story.views)}</span>
                    </span>
                  </div>

                  <Link
                    href={`/dashboard/blogs/${story.slug?.current || story._id}`}
                    className="flex items-center gap-2 text-white font-bold text-[10px] tracking-widest group/link cursor-pointer hover:text-red-500 transition-colors mt-4"
                  >
                    Read story
                    <ArrowUpRight className="w-3 h-3 transition-transform group-hover/link:translate-x-1 group-hover/link:-translate-y-1" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {!loading && filteredStories.length > visibleCount && (
          <div className="flex justify-center mt-12">
            <button
              onClick={() => setVisibleCount((prev) => prev + 6)}
              className="px-8 py-3 bg-white/5 border border-white/10 text-white rounded-xl font-bold text-[10px] tracking-widest hover:bg-white hover:text-black hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
            >
              Load more stories
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
