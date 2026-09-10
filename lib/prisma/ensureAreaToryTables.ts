import { prisma } from '@/lib/prisma/prisma';

let tablesEnsured = false;

export async function ensureAreaToryTables() {
  if (tablesEnsured) return;

  try {
    // 1. StoryLike table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StoryLike" (
        "id" TEXT NOT NULL,
        "storyId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "StoryLike_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "StoryLike_storyId_idx" ON "StoryLike"("storyId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "StoryLike_userId_idx" ON "StoryLike"("userId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "StoryLike_storyId_userId_key" ON "StoryLike"("storyId", "userId");
    `);

    // 2. StoryView table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StoryView" (
        "id" TEXT NOT NULL,
        "storyId" TEXT NOT NULL,
        "userId" TEXT,
        "viewHash" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "StoryView_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "StoryView_storyId_idx" ON "StoryView"("storyId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "StoryView_storyId_viewHash_key" ON "StoryView"("storyId", "viewHash");
    `);

    // 3. StoryComment table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StoryComment" (
        "id" TEXT NOT NULL,
        "storyId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "userName" TEXT NOT NULL,
        "userAvatar" TEXT,
        "userRole" TEXT DEFAULT 'member',
        "content" TEXT NOT NULL,
        "parentId" TEXT,
        "isPinned" BOOLEAN NOT NULL DEFAULT false,
        "isDeleted" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "StoryComment_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "StoryComment_storyId_idx" ON "StoryComment"("storyId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "StoryComment_parentId_idx" ON "StoryComment"("parentId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "StoryComment_userId_idx" ON "StoryComment"("userId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "StoryComment_createdAt_idx" ON "StoryComment"("createdAt");
    `);

    // 4. StoryCommentLike table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StoryCommentLike" (
        "id" TEXT NOT NULL,
        "commentId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "StoryCommentLike_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "StoryCommentLike_commentId_idx" ON "StoryCommentLike"("commentId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "StoryCommentLike_userId_idx" ON "StoryCommentLike"("userId");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "StoryCommentLike_commentId_userId_key" ON "StoryCommentLike"("commentId", "userId");
    `);

    // 5. StoryStats table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StoryStats" (
        "storyId" TEXT NOT NULL,
        "likesCount" INTEGER NOT NULL DEFAULT 0,
        "viewsCount" INTEGER NOT NULL DEFAULT 0,
        "commentsCount" INTEGER NOT NULL DEFAULT 0,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "StoryStats_pkey" PRIMARY KEY ("storyId")
      );
    `);

    tablesEnsured = true;
  } catch (err: any) {
    console.warn('[ensureAreaToryTables] Warning while ensuring tables:', err?.message || err);
  }
}
