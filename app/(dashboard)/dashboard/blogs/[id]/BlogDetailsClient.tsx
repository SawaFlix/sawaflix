"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Heart, MessageCircle, Share2, Eye, Clock, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { PortableText } from "@portabletext/react";
import { sanityFetch, urlFor } from "@/lib/sanity/client";
import StoryInteractionBar from "@/components/AreaTory/StoryInteractionBar";
import { CommentSidebarProvider } from "@/components/AreaTory/CommentSidebarContext";
import StoryCommentsSection from "@/components/AreaTory/StoryCommentsSection";


interface StoryDetail {
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
  body: any[];
  videoUrl?: string;
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
    bio: string;
  };
}

interface RelatedStory {
  _id: string;
  title: string;
  slug: { current: string };
  mainImage: any;
  category: { title: string };
}

// Portable Text custom components
const portableTextComponents = {
  block: {
    normal: ({ children }: any) => (
      <p className="text-gray-300 text-sm font-medium leading-relaxed mb-6 opacity-85">
        {children}
      </p>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-xl font-bold text-white mt-10 mb-4 tracking-tight">{children}</h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-lg font-bold text-white mt-8 mb-3 tracking-tight">{children}</h3>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-2 border-red-600 pl-4 my-6 text-gray-400 italic text-sm">
        {children}
      </blockquote>
    ),
  },
  marks: {
    strong: ({ children }: any) => (
      <strong className="text-white font-bold">{children}</strong>
    ),
    em: ({ children }: any) => (
      <em className="text-gray-300 italic">{children}</em>
    ),
    link: ({ value, children }: any) => (
      <a
        href={value?.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-red-500 hover:text-red-400 underline underline-offset-2 transition-colors"
      >
        {children}
      </a>
    ),
  },
  types: {
    image: ({ value }: any) => {
      if (!value?.asset) return null;
      return (
        <figure className="my-8">
          <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10">
            <Image
              src={urlFor(value).width(1200).height(675).url()}
              alt={value.alt || "Story image"}
              fill
              className="object-cover"
            />
          </div>
          {value.caption && (
            <figcaption className="text-center text-gray-500 text-xs mt-2 italic">
              {value.caption}
            </figcaption>
          )}
        </figure>
      );
    },
  },
};

const fallbackStory: StoryDetail = {
  _id: "fallback",
  title: "The sacred Ngondo festival: Spirits of the Wouri",
  slug: { current: "ngondo-festival" },
  excerpt: "Exploring the sacred communication with water spirits.",
  mainImage: null,
  publishedAt: "2024-12-12T10:00:00Z",
  readTime: "6 min read",
  featured: true,
  likes: 1200,
  views: 8900,
  body: [],
  category: { _id: "c1", title: "Culture", slug: { current: "culture" }, color: "#E50914" },
  author: { _id: "a1", name: "Sawaflix Heritage Team", avatar: null, role: "Editorial", bio: "" },
};

export default function BlogDetailsClient({ slug }: { slug: string }) {
  const router = useRouter();

  const [story, setStory] = useState<StoryDetail | null>(null);
  const [relatedStories, setRelatedStories] = useState<RelatedStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);
  const [isPlayed, setIsPlayed] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [stats, setStats] = useState<{
    likesCount: number;
    viewsCount: number;
    commentsCount: number;
    isLiked: boolean;
  }>({
    likesCount: 0,
    viewsCount: 0,
    commentsCount: 0,
    isLiked: false,
  });


  const getYouTubeID = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const getYouTubeThumbnail = (url: string) => {
    const id = getYouTubeID(url);
    if (!id) return "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=2070";
    return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
  };

  const getYouTubeEmbedUrl = (url: string) => {
    const id = getYouTubeID(url);
    return id ? `https://www.youtube.com/embed/${id}` : url;
  };

  useEffect(() => {
    setHasMounted(true);
    async function fetchStory() {
      try {
        const STORY_QUERY = `*[_type == "story" && slug.current == $slug][0] {
          _id, title, slug, excerpt, mainImage, publishedAt, readTime,
          featured, likes, views, body,
          category->{ _id, title, slug, color },
          author->{ _id, name, avatar, role, bio },
          videoUrl
        }`;

        let data = await sanityFetch(STORY_QUERY, { slug });

        if (!data) {
          const ID_QUERY = `*[_type == "story" && _id == $id][0] {
            _id, title, slug, excerpt, mainImage, publishedAt, readTime,
            featured, likes, views, body,
            category->{ _id, title, slug, color },
            author->{ _id, name, avatar, role, bio },
            videoUrl
          }`;
          data = await sanityFetch(ID_QUERY, { id: slug });
        }

        if (data) {
          setStory(data);
          const storyKey = data._id || slug;

          // Asynchronously register deduplicated view in Neon DB
          fetch(`/api/stories/${encodeURIComponent(storyKey)}/view`, { method: 'POST' })
            .then((r) => r.json())
            .then((res) => {
              if (typeof res?.viewsCount === 'number') {
                setStats((prev) => ({ ...prev, viewsCount: res.viewsCount }));
              }
            })
            .catch(() => {});

          // Fetch consolidated stats from Neon DB
          fetch(`/api/stories/${encodeURIComponent(storyKey)}/stats`)
            .then((r) => r.json())
            .then((res) => {
              if (res && !res.error) {
                setStats({
                  likesCount: res.likesCount ?? data.likes ?? 0,
                  viewsCount: res.viewsCount ?? data.views ?? 0,
                  commentsCount: res.commentsCount ?? 0,
                  isLiked: res.isLiked ?? false,
                });
              }
            })
            .catch(() => {});

          if (typeof window !== 'undefined') {
            localStorage.setItem(`read_sanity_story_${data._id}`, 'true');
            if (data.slug?.current) {
              localStorage.setItem(`read_sanity_story_${data.slug.current}`, 'true');
            }
            if (slug) {
              localStorage.setItem(`read_sanity_story_${slug}`, 'true');
            }
          }

          if (data.category?._id) {
            const RELATED_QUERY = `*[_type == "story" && category._ref == $catId && _id != $currentId] | order(publishedAt desc)[0...3] {
              _id, title, slug, mainImage,
              category->{ title }
            }`;
            const related = await sanityFetch(RELATED_QUERY, {
              catId: data.category._id,
              currentId: data._id,
            });
            setRelatedStories(related || []);
          }
        } else {
          setStory(fallbackStory);
        }
      } catch (error) {
        console.error("Failed to fetch story:", error);
        setStory(fallbackStory);
      } finally {
        setLoading(false);
      }
    }

    fetchStory();
  }, [slug]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const getImageUrl = (image: any, fallback: string) => {
    if (image?.asset) return urlFor(image).width(1600).height(900).fit('crop').url();
    return fallback;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-red-600 animate-spin" />
          <span className="text-gray-400 text-sm font-medium">Loading story...</span>
        </div>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Story not found</h2>
          <p className="text-gray-500 text-sm mb-6">This story may have been moved or deleted.</p>
          <Link href="/dashboard/blogs" className="text-red-500 hover:text-red-400 text-sm font-bold">
            ← Back to stories
          </Link>
        </div>
      </div>
    );
  }

  return (<CommentSidebarProvider>
    <div className="min-h-screen bg-[#0B0E14] text-white">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 mb-6 text-gray-500 hover:text-white transition-all group cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Back to stories</span>
      </button>

      <article className="max-w-3xl mx-auto">
        <div className="mb-8 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
            <span
              className="px-2 py-0.5 text-white text-[8px] font-black rounded-md uppercase tracking-[0.2em]"
              style={{ backgroundColor: story.category?.color || "#E50914" }}
            >
              {story.category?.title || "Culture"}
            </span>
            <div className="flex items-center gap-2 text-gray-500 text-[10px] font-bold uppercase tracking-widest">
              <Clock className="w-3 h-3" />
              {story.readTime || "5 min read"}
            </div>
          </div>

          <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-white mb-4 leading-[1.2]">
            {story.title}
          </h1>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-y border-white/5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center font-black text-white text-xs shadow-lg shadow-red-600/10 overflow-hidden">
                {story.author?.avatar ? (
                  <Image
                    src={urlFor(story.author.avatar).width(80).height(80).url()}
                    alt={story.author.name}
                    width={40}
                    height={40}
                    className="object-cover"
                  />
                ) : (
                  story.author?.name?.[0] || "S"
                )}
              </div>
              <div className="text-left">
                <p className="text-white font-bold text-xs">By {story.author?.name || "Sawaflix"}</p>
                <div className="flex items-center gap-1.5 text-gray-500 text-[10px]">
                  <Calendar className="w-2.5 h-2.5" />
                  {formatDate(story.publishedAt)}
                </div>
              </div>
            </div>

            <StoryInteractionBar
              storyId={story._id || slug}
              storyTitle={story.title}
              initialLikes={stats.likesCount || story.likes || 0}
              initialComments={stats.commentsCount || 0}
              initialIsLiked={stats.isLiked}
            />

          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative aspect-[21/9] w-full rounded-2xl overflow-hidden mb-8 shadow-xl border border-white/5"
        >
          <Image
            src={getImageUrl(
              story.mainImage,
              "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=2070&auto=format&fit=crop"
            )}
            alt={story.mainImage?.alt || story.title}
            fill
            className="object-cover"
            priority
          />
        </motion.div>

        {story.videoUrl && hasMounted && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-16"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-4 bg-white/20 rounded-full" />
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/90">Video Highlight</h3>
            </div>
            
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-zinc-900 border border-white/20 shadow-[0_0_40px_rgba(0,0,0,0.5)] transition-all duration-500 hover:border-white/40">
              {!isPlayed ? (
                <div 
                  className="relative w-full h-full cursor-pointer group/vid"
                  onClick={() => {
                    setIsPlayed(true);
                    setIsVideoLoading(true);
                  }}
                >
                  <Image
                    src={getYouTubeThumbnail(story.videoUrl)}
                    alt="Video Thumbnail"
                    fill
                    className="object-cover transition-transform duration-700 group-hover/vid:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover/vid:bg-black/10 transition-colors" />
                  
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="group/play relative">
                      <div className="absolute inset-0 bg-white/20 blur-2xl rounded-full scale-150 opacity-0 group-hover/play:opacity-100 transition-opacity duration-500" />
                      <div className="relative w-16 h-16 bg-white text-black rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 group-hover/play:scale-110 active:scale-95">
                        <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-black border-b-[8px] border-b-transparent ml-1" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative w-full h-full">
                  {isVideoLoading && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-900">
                      <div className="relative">
                        <div className="w-12 h-12 border-2 border-white/10 rounded-full" />
                        <div className="absolute inset-0 w-12 h-12 border-t-2 border-red-600 rounded-full animate-spin shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
                      </div>
                      <span className="mt-4 text-[10px] font-bold text-white/40 uppercase tracking-[0.3em] animate-pulse">Initializing Video</span>
                    </div>
                  )}
                  <iframe
                    src={`${getYouTubeEmbedUrl(story.videoUrl)}?autoplay=1&modestbranding=1&rel=0`}
                    title="YouTube video player"
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    onLoad={() => setIsVideoLoading(false)}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}

        <div className="prose prose-invert prose-sm max-w-none px-4 md:px-0">
          {story.body && story.body.length > 0 ? (
            <PortableText value={story.body} components={portableTextComponents} />
          ) : (
            <div className="text-gray-400 font-medium leading-relaxed space-y-6 text-sm">
              <p className="opacity-80">{story.excerpt}</p>
            </div>
          )}
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Share story:</span>
            <div className="flex gap-2">
              {["Facebook", "Twitter", "WhatsApp"].map((platform) => (
                <button
                  key={platform}
                  className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-[9px] font-bold hover:bg-white hover:text-black transition-all cursor-pointer"
                >
                  {platform}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-gray-500 text-[10px] font-bold uppercase tracking-widest">
            <Eye className="w-3.5 h-3.5" />
            {(stats.viewsCount || story.views || 0).toLocaleString()} Views
          </div>
        </div>

        {/* Threaded Discussions / Comments Section backed by Neon DB */}
        <StoryCommentsSection
          storyId={story._id || slug}
          storyTitle={story.title}
          onCommentCountChange={(count) =>
            setStats((prev) => ({ ...prev, commentsCount: count }))
          }
        />


        {relatedStories.length > 0 && (
          <div className="mt-20 mb-12">
            <h3 className="text-lg font-bold text-white mb-6 tracking-tight">Related stories</h3>
            <div className="grid md:grid-cols-2 gap-6">
              {relatedStories.map((related) => (
                <Link
                  key={related._id}
                  href={`/dashboard/blogs/${related.slug?.current || related._id}`}
                  className="group cursor-pointer"
                >
                  <div className="relative aspect-[16/9] rounded-xl overflow-hidden mb-3 border border-white/10">
                    <Image
                      src={getImageUrl(
                        related.mainImage,
                        "https://images.unsplash.com/photo-1542601906990-b4d3fb852ba3?q=80&w=2070"
                      )}
                      alt={related.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <h4 className="text-sm font-bold text-white group-hover:text-red-600 transition-colors">
                    {related.title}
                  </h4>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
    </CommentSidebarProvider>
  );
}
