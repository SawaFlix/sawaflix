'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Heart,
  CornerDownRight,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useAuthModal } from '@/contexts/AuthModalContext';
import Image from 'next/image';

interface CommentReply {
  id: string;
  storyId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  userRole?: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  likesCount: number;
  isLikedByMe: boolean;
}

interface CommentItem {
  id: string;
  storyId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  userRole?: string;
  content: string;
  parentId: string | null;
  isPinned: boolean;
  createdAt: string;
  likesCount: number;
  isLikedByMe: boolean;
  replies: CommentReply[];
  repliesCount: number;
}

interface StoryCommentsSectionProps {
  storyId: string;
  storyTitle: string;
  isSidebarMode?: boolean;
  onCommentCountChange?: (count: number) => void;
}

const CULTURAL_REACTIONS = [
  { emoji: '🇨🇲', label: 'Cameroon Pride', text: '🇨🇲 Proud Cameroon culture! ' },
  { emoji: '🔥', label: 'Fire Tory', text: '🔥 This Tory is straight fire! ' },
  { emoji: '👏', label: 'Pure Gold', text: '👏 Incredible storytelling! ' },
  { emoji: '❤️', label: 'Respect', text: '❤️ Deep respect to the creators. ' },
  { emoji: '🍿', label: 'Sweet Story', text: '🍿 Story sweet die! ' },
];

function formatTimeAgo(dateString: string): string {
  try {
    const diff = Date.now() - new Date(dateString).getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'Just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

export default function StoryCommentsSection({
  storyId,
  storyTitle,
  isSidebarMode = false,
  onCommentCountChange,
}: StoryCommentsSectionProps) {
  const { user, isAuthenticated } = useAuthSession();
  const { openAuthModal } = useAuthModal();

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [sortBy, setSortBy] = useState<'top' | 'newest'>('top');

  // Replying state: stores the parent comment ID
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  // Accordion state for replies visibility
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const draftStorageKey = `sawa_draft_comment_${storyId}`;

  // Restore draft if any saved from guest attempt
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDraft = sessionStorage.getItem(draftStorageKey);
      if (savedDraft) {
        setNewComment(savedDraft);
      }
    }
  }, [draftStorageKey]);

  // Fetch comments
  const fetchComments = async (sortOrder = sortBy) => {
    try {
      const res = await fetch(`/api/stories/${encodeURIComponent(storyId)}/comments?sort=${sortOrder}`);
      const data = await res.json();
      if (data.comments) {
        setComments(data.comments);
        const total = data.comments.reduce(
          (acc: number, c: CommentItem) => acc + 1 + (c.repliesCount || 0),
          0
        );
        onCommentCountChange?.(total);
      }
    } catch (err) {
      console.error('[StoryComments] Error fetching comments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchComments(sortBy);

    // Real-time synchronization: poll in background every 6 seconds for new comments and replies
    const pollInterval = setInterval(() => {
      // Background silent refresh without triggering full loading skeleton
      fetch(`/api/stories/${encodeURIComponent(storyId)}/comments?sort=${sortBy}`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.comments) {
            setComments(data.comments);
            const total = data.comments.reduce(
              (acc: number, c: CommentItem) => acc + 1 + (c.repliesCount || 0),
              0
            );
            onCommentCountChange?.(total);
          }
        })
        .catch(() => {});
    }, 6000);

    return () => clearInterval(pollInterval);
  }, [storyId, sortBy]);

  // Handle posting a root comment
  const handleSubmitComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = newComment.trim();
    if (!content) return;

    if (!isAuthenticated) {
      // Save draft so user doesn't lose what they typed
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(draftStorageKey, content);
      }
      openAuthModal('to join the discussion on Area Tory');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/stories/${encodeURIComponent(storyId)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to post comment');

      // Prepend newly created comment
      setComments((prev) => [data.comment, ...prev]);
      setNewComment('');
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(draftStorageKey);
      }
      onCommentCountChange?.(comments.length + 1);
    } catch (err: any) {
      alert(err?.message || 'Unable to post comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle posting a reply
  const handlePostReply = async (parentId: string) => {
    const content = replyText.trim();
    if (!content) return;

    if (!isAuthenticated) {
      openAuthModal('to reply to comments on Area Tory');
      return;
    }

    setReplySubmitting(true);
    try {
      const res = await fetch(`/api/stories/${encodeURIComponent(storyId)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, parentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to post reply');

      // Append reply to corresponding parent comment
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === parentId) {
            return {
              ...c,
              replies: [...c.replies, data.comment],
              repliesCount: c.repliesCount + 1,
            };
          }
          return c;
        })
      );

      // Auto expand replies for this parent
      setExpandedReplies((prev) => ({ ...prev, [parentId]: true }));
      setReplyingToId(null);
      setReplyText('');
    } catch (err: any) {
      alert(err?.message || 'Unable to post reply. Please try again.');
    } finally {
      setReplySubmitting(false);
    }
  };

  // Handle liking a comment
  const handleToggleCommentLike = async (commentId: string, isReply = false, parentId?: string) => {
    if (!isAuthenticated) {
      openAuthModal('to like comments on Area Tory');
      return;
    }

    // Optimistic toggle
    setComments((prev) =>
      prev.map((c) => {
        if (!isReply && c.id === commentId) {
          const nextLiked = !c.isLikedByMe;
          return {
            ...c,
            isLikedByMe: nextLiked,
            likesCount: Math.max(0, c.likesCount + (nextLiked ? 1 : -1)),
          };
        }
        if (isReply && c.id === parentId) {
          return {
            ...c,
            replies: c.replies.map((r) => {
              if (r.id === commentId) {
                const nextLiked = !r.isLikedByMe;
                return {
                  ...r,
                  isLikedByMe: nextLiked,
                  likesCount: Math.max(0, r.likesCount + (nextLiked ? 1 : -1)),
                };
              }
              return r;
            }),
          };
        }
        return c;
      })
    );

    try {
      const res = await fetch(
        `/api/stories/${encodeURIComponent(storyId)}/comments/${encodeURIComponent(commentId)}/like`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
    } catch (err) {
      console.error('[StoryComments] Like comment failed:', err);
      // Revert if needed by refetching
      fetchComments();
    }
  };

  const handleAppendReaction = (text: string) => {
    setNewComment((prev) => prev + text);
    textareaRef.current?.focus();
  };

  const totalDiscussionsCount = comments.reduce(
    (acc, c) => acc + 1 + (c.repliesCount || 0),
    0
  );

  return (
    <section
      id="story-comments"
      className={
        isSidebarMode
          ? 'w-full scale-[0.9] origin-top pb-6'
          : 'mt-16 pt-12 border-t border-white/10 scroll-mt-20 scale-[0.9] origin-top'
      }
    >
      {/* Header & Controls - in sidebar mode, compact header with sort tabs */}
      {!isSidebarMode ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-600/10 border border-red-600/20 flex items-center justify-center text-red-500">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2.5">
                Discussions
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-zinc-300 font-mono font-bold">
                  {totalDiscussionsCount}
                </span>
              </h3>
              <p className="text-xs text-zinc-400 font-medium">
                Share your perspective and connect with fellow readers.
              </p>
            </div>
          </div>

          {/* Sorting Pills */}
          <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setSortBy('top')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                sortBy === 'top'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Top Discussions
            </button>
            <button
              type="button"
              onClick={() => setSortBy('newest')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                sortBy === 'newest'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Latest First
            </button>
          </div>
        </div>
      ) : (
        /* Sidebar sort filter row */
        <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-white/5">
          <span className="text-xs text-zinc-400 font-medium truncate max-w-[200px]">
            {storyTitle}
          </span>
          <div className="flex items-center gap-1 p-0.5 bg-white/5 border border-white/10 rounded-lg">
            <button
              type="button"
              onClick={() => setSortBy('top')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                sortBy === 'top'
                  ? 'bg-white text-black font-extrabold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Top
            </button>
            <button
              type="button"
              onClick={() => setSortBy('newest')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                sortBy === 'newest'
                  ? 'bg-white text-black font-extrabold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Newest
            </button>
          </div>
        </div>
      )}

      {/* Cultural Quick-Reaction Chips */}
      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 shrink-0">
          Quick vibe:
        </span>
        {CULTURAL_REACTIONS.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => handleAppendReaction(item.text)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-500/30 text-xs text-zinc-300 hover:text-white transition-all shrink-0 cursor-pointer active:scale-95 shadow-sm"
          >
            <span>{item.emoji}</span>
            <span className="font-medium text-[11px]">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Main Comment Composer */}
      <div className="relative mb-10 bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-5 backdrop-blur-xl transition-all focus-within:border-red-600/40 focus-within:bg-white/[0.05]">
        <div className="flex items-start gap-3.5">
          <div className="relative w-10 h-10 rounded-full bg-red-600/20 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
            {user?.user_metadata?.avatar_url || user?.user_metadata?.picture ? (
              <Image
                src={user.user_metadata.avatar_url || user.user_metadata.picture}
                alt="Your Avatar"
                fill
                className="object-cover"
              />
            ) : (
              <UserIcon className="w-5 h-5 text-zinc-400" />
            )}
          </div>

          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={
                isAuthenticated
                  ? 'Join the conversation on this story… (Max 1500 chars)'
                  : 'What are your thoughts on this story? Sign in to post.'
              }
              rows={3}
              maxLength={1500}
              className="w-full bg-transparent text-white text-sm placeholder-zinc-500 resize-none outline-none leading-relaxed"
            />

            <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-2">
              <span className="text-[11px] font-mono text-zinc-500">
                {newComment.length}/1500
              </span>

              <div className="flex items-center gap-2">
                {newComment.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setNewComment('')}
                    className="text-xs text-zinc-500 hover:text-zinc-300 font-bold px-3 py-1.5 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSubmitComment()}
                  disabled={submitting || !newComment.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed text-[#0B0E14] font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-sm active:scale-95"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                      <span>Posting…</span>
                    </>
                  ) : (
                    <>
                      <span>Post Comment</span>
                      <Send className="w-3 h-3 text-black" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading Skeletons */}
      {loading && (
        <div className="space-y-4 py-8">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse flex items-start gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-white/10 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="w-32 h-3 bg-white/10 rounded" />
                <div className="w-full h-3 bg-white/5 rounded" />
                <div className="w-3/4 h-3 bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && comments.length === 0 && (
        <div className="text-center py-16 px-4 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl my-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-600/10 border border-red-600/20 flex items-center justify-center text-red-500 text-2xl">
            🇨🇲
          </div>
          <h4 className="text-base font-bold text-white mb-1">
            Be the First to Share Your Thoughts
          </h4>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-5 leading-relaxed">
            No one has commented on &quot;{storyTitle}&quot; yet. Spark the discussion for the SawaFlix community!
          </p>
          <button
            type="button"
            onClick={() => textareaRef.current?.focus()}
            className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white hover:text-black font-bold text-xs transition-all cursor-pointer"
          >
            Drop a comment
          </button>
        </div>
      )}

      {/* Comments List */}
      {!loading && comments.length > 0 && (
        <div className="space-y-6">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="p-5 sm:p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all duration-300"
            >
              {/* Comment Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="relative w-9 h-9 rounded-full bg-gradient-to-tr from-red-600 to-amber-600 flex items-center justify-center font-black text-white text-xs shrink-0 overflow-hidden shadow-md">
                    {comment.userAvatar ? (
                      <Image
                        src={comment.userAvatar}
                        alt={comment.userName}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      comment.userName?.[0]?.toUpperCase() || 'U'
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-white">
                        {comment.userName}
                      </span>
                      {comment.userRole && comment.userRole !== 'member' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-600/20 border border-red-500/30 text-[9px] font-black uppercase text-red-400">
                          <ShieldCheck className="w-2.5 h-2.5" />
                          {comment.userRole}
                        </span>
                      )}
                      {comment.isPinned && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-[9px] font-black uppercase text-amber-400">
                          Pinned
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-zinc-500 font-medium">
                      {formatTimeAgo(comment.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Comment Body */}
              <p className="text-zinc-200 text-sm leading-relaxed mb-4 whitespace-pre-wrap">
                {comment.content}
              </p>

              {/* Comment Actions Row */}
              <div className="flex items-center gap-4 text-xs">
                {/* Like Button */}
                <button
                  type="button"
                  onClick={() => handleToggleCommentLike(comment.id, false)}
                  className={`flex items-center gap-1.5 transition-colors cursor-pointer px-2 py-1 rounded-full ${
                    comment.isLikedByMe
                      ? 'text-red-400 bg-red-500/10 font-bold'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                  aria-label={comment.isLikedByMe ? 'Unlike comment' : 'Like comment'}
                >
                  <Image
                    src="/logos_and_pwas/like.png"
                    alt="Like"
                    width={16}
                    height={16}
                    className={`w-4 h-4 object-contain transition-transform ${
                      comment.isLikedByMe ? 'scale-110 drop-shadow-[0_0_6px_rgba(239,68,68,0.5)]' : 'opacity-70 hover:opacity-100'
                    }`}
                  />
                  <span className="font-mono text-[11px]">{comment.likesCount > 0 ? comment.likesCount : 'Like'}</span>
                </button>

                {/* Reply Button */}
                <button
                  type="button"
                  onClick={() => {
                    setReplyingToId(replyingToId === comment.id ? null : comment.id);
                    setReplyText('');
                  }}
                  className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <CornerDownRight className="w-3.5 h-3.5" />
                  <span>Reply</span>
                </button>

                {/* Replies Accordion Toggle */}
                {comment.repliesCount > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedReplies((prev) => ({
                        ...prev,
                        [comment.id]: !prev[comment.id],
                      }))
                    }
                    className="flex items-center gap-1 text-zinc-300 hover:text-white font-bold text-xs ml-auto transition-colors cursor-pointer"
                  >
                    {expandedReplies[comment.id] ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        <span>Hide {comment.repliesCount} {comment.repliesCount === 1 ? 'reply' : 'replies'}</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        <span>View {comment.repliesCount} {comment.repliesCount === 1 ? 'reply' : 'replies'}</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Inline Reply Composer */}
              <AnimatePresence>
                {replyingToId === comment.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 pt-4 border-t border-white/5 overflow-hidden"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                        <UserIcon className="w-4 h-4 text-zinc-400" />
                      </div>
                      <div className="flex-1">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={`Replying to @${comment.userName}…`}
                          rows={2}
                          maxLength={1000}
                          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-xs placeholder-zinc-500 resize-none outline-none focus:border-red-600/40"
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingToId(null);
                              setReplyText('');
                            }}
                            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white font-bold transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePostReply(comment.id)}
                            disabled={replySubmitting || !replyText.trim()}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-white/90 disabled:opacity-30 text-[#0B0E14] font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95"
                          >
                            {replySubmitting ? (
                              <Loader2 className="w-3 h-3 animate-spin text-black" />
                            ) : (
                              <span>Reply</span>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Nested Replies Section (1-Level Indentation) */}
              <AnimatePresence>
                {expandedReplies[comment.id] && comment.replies?.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 pt-4 border-l-2 border-white/10 pl-4 sm:pl-6 ml-2 sm:ml-4 space-y-4 overflow-hidden"
                  >
                    {comment.replies.map((reply) => (
                      <div
                        key={reply.id}
                        className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5"
                      >
                        <div className="flex items-center gap-2.5 mb-2">
                          <div className="relative w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-[10px] text-zinc-300 shrink-0 overflow-hidden">
                            {reply.userAvatar ? (
                              <Image
                                src={reply.userAvatar}
                                alt={reply.userName}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              reply.userName?.[0]?.toUpperCase() || 'U'
                            )}
                          </div>
                          <span className="font-bold text-xs text-white">
                            {reply.userName}
                          </span>
                          {reply.userRole && reply.userRole !== 'member' && (
                            <span className="px-1.5 py-0.2 rounded bg-red-600/20 text-[8px] font-black uppercase text-red-400">
                              {reply.userRole}
                            </span>
                          )}
                          <span className="text-[10px] text-zinc-500">
                            {formatTimeAgo(reply.createdAt)}
                          </span>
                        </div>

                        <p className="text-zinc-300 text-xs leading-relaxed mb-2 whitespace-pre-wrap">
                          {reply.content}
                        </p>

                        <div className="flex items-center gap-3 text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleToggleCommentLike(reply.id, true, comment.id)}
                            className={`flex items-center gap-1.5 transition-colors cursor-pointer px-2 py-0.5 rounded-full ${
                              reply.isLikedByMe ? 'text-red-400 bg-red-500/10 font-bold' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                            }`}
                            aria-label={reply.isLikedByMe ? 'Unlike reply' : 'Like reply'}
                          >
                            <Image
                              src="/logos_and_pwas/like.png"
                              alt="Like"
                              width={14}
                              height={14}
                              className={`w-3.5 h-3.5 object-contain transition-transform ${
                                reply.isLikedByMe ? 'scale-110 drop-shadow-[0_0_6px_rgba(239,68,68,0.5)]' : 'opacity-70 hover:opacity-100'
                              }`}
                            />
                            <span className="font-mono text-[10px]">{reply.likesCount > 0 ? reply.likesCount : 'Like'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
