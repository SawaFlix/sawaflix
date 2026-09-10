// CommentSidebarContext.tsx – provides a context to open/close YouTube/Reels-style right comment sidebar
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, SlidersHorizontal, MessageCircle } from 'lucide-react';
import StoryCommentsSection from './StoryCommentsSection';

type CommentSidebarContextType = {
  open: (storyId: string, storyTitle: string, initialComments: number) => void;
  close: () => void;
  updateStats?: (storyId: string, updates: Partial<{ likesCount: number; viewsCount: number; commentsCount: number }>) => void;
};

const CommentSidebarContext = createContext<CommentSidebarContextType | undefined>(undefined);

export const useCommentSidebar = () => {
  const ctx = useContext(CommentSidebarContext);
  if (!ctx) throw new Error('useCommentSidebar must be used within CommentSidebarProvider');
  return ctx;
};

export const CommentSidebarProvider = ({
  children,
  onUpdateStats,
}: {
  children: ReactNode;
  onUpdateStats?: (storyId: string, updates: Partial<{ likesCount: number; viewsCount: number; commentsCount: number }>) => void;
}) => {
  const [openStoryId, setOpenStoryId] = useState<string | null>(null);
  const [openStoryTitle, setOpenStoryTitle] = useState<string>('');
  const [openInitialComments, setOpenInitialComments] = useState<number>(0);

  const open = (id: string, title: string, initialComments: number) => {
    setOpenStoryId(id);
    setOpenStoryTitle(title);
    setOpenInitialComments(initialComments);
  };
  const close = () => setOpenStoryId(null);

  return (
    <CommentSidebarContext.Provider
      value={{
        open,
        close,
        updateStats: onUpdateStats,
      }}
    >
      {children}
      <AnimatePresence>
        {openStoryId && (
          <CommentSidebar
            key="comment-sidebar"
            storyId={openStoryId}
            storyTitle={openStoryTitle}
            initialComments={openInitialComments}
            onClose={close}
            onStatsUpdate={onUpdateStats}
          />
        )}
      </AnimatePresence>
    </CommentSidebarContext.Provider>
  );
};

// YouTube-style Right Side Panel with backdrop & animation
type CommentSidebarProps = {
  storyId: string;
  storyTitle: string;
  initialComments: number;
  onClose: () => void;
  onStatsUpdate?: (storyId: string, updates: Partial<{ likesCount: number; viewsCount: number; commentsCount: number }>) => void;
};

const CommentSidebar = ({ storyId, storyTitle, initialComments, onClose, onStatsUpdate }: CommentSidebarProps) => {
  const [liveCount, setLiveCount] = useState(initialComments);

  const handleCommentCountChange = (newCount: number) => {
    setLiveCount(newCount);
    onStatsUpdate?.(storyId, { commentsCount: newCount });
  };

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Subtle translucent backdrop so users can clearly read and view the blog while viewing comments */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/25 backdrop-blur-[2px] pointer-events-auto"
      />

      {/* Slide-out panel from the RIGHT - identical sleek width and styling as ReelComments */}
      <motion.aside
        role="dialog"
        aria-label="Story Comments"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-y-0 right-0 w-full sm:w-[380px] md:w-[410px] bg-[#0F1117] border-l border-white/10 shadow-2xl flex flex-col pointer-events-auto z-[10000]"
      >
        {/* Header - YouTube style */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0F1117]/95 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-black tracking-tight text-white flex items-center gap-2">
              <span>Comments</span>
              <span className="text-xs font-mono font-bold text-zinc-400">
                {liveCount.toLocaleString()}
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close comments panel"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Comments Stream */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
          <StoryCommentsSection
            storyId={storyId}
            storyTitle={storyTitle}
            isSidebarMode={true}
            onCommentCountChange={handleCommentCountChange}
          />
        </div>
      </motion.aside>
    </div>
  );
};

export default CommentSidebar;
