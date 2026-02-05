import { PrismaClient, Prisma } from '@prisma/client';
import { notifyUser } from './socketService';

const prisma = new PrismaClient();

// Types
export interface Comment {
  id: string;
  lookaheadActivityId: string;
  userId: string;
  parentId: string | null;
  content: string;
  mentions: string[];
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  reactions?: CommentReaction[];
  replies?: Comment[];
}

export interface CommentReaction {
  id: string;
  commentId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface CreateCommentInput {
  lookaheadActivityId: string;
  userId: string;
  content: string;
  parentId?: string;
  mentions?: string[];
}

export interface UpdateCommentInput {
  content?: string;
  mentions?: string[];
}

// Helper to extract @mentions from content
export function extractMentions(content: string): string[] {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const mentions: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(content)) !== null) {
    // match[2] is the user ID in the format @[Name](userId)
    mentions.push(match[2]);
  }
  
  return [...new Set(mentions)]; // Remove duplicates
}

// Comment CRUD operations
export async function createComment(input: CreateCommentInput): Promise<Comment> {
  const { lookaheadActivityId, userId, content, parentId, mentions: providedMentions } = input;
  
  // Extract mentions from content if not provided
  const mentions = providedMentions || extractMentions(content);
  
  const comment = await (prisma as any).lookaheadActivityComment.create({
    data: {
      lookaheadActivityId,
      userId,
      content,
      parentId,
      mentions,
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      reactions: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });
  
  // Get activity details for notification context
  const activity = await prisma.lookaheadActivity.findUnique({
    where: { id: lookaheadActivityId },
    select: {
      name: true,
      lookaheadScheduleId: true,
      lookaheadSchedule: {
        select: {
          projectId: true,
        },
      },
    },
  });
  
  // Notify mentioned users
  if (mentions.length > 0 && activity) {
    for (const mentionedUserId of mentions) {
      if (mentionedUserId !== userId) {
        notifyUser(mentionedUserId, 'notification:new', {
          type: 'MENTION',
          title: 'You were mentioned in a comment',
          message: `${comment.user?.firstName} ${comment.user?.lastName} mentioned you on "${activity.name}"`,
          data: {
            commentId: comment.id,
            activityId: lookaheadActivityId,
            lookaheadScheduleId: activity.lookaheadScheduleId,
            projectId: activity.lookaheadSchedule?.projectId,
          },
        });
      }
    }
  }
  
  // If this is a reply, notify the parent comment author
  if (parentId) {
    const parentComment = await (prisma as any).lookaheadActivityComment.findUnique({
      where: { id: parentId },
      select: { userId: true },
    });
    
    if (parentComment && parentComment.userId !== userId && activity) {
      notifyUser(parentComment.userId, 'notification:new', {
        type: 'COMMENT_REPLY',
        title: 'New reply to your comment',
        message: `${comment.user?.firstName} ${comment.user?.lastName} replied to your comment on "${activity.name}"`,
        data: {
          commentId: comment.id,
          parentCommentId: parentId,
          activityId: lookaheadActivityId,
          lookaheadScheduleId: activity.lookaheadScheduleId,
        },
      });
    }
  }
  
  return comment as Comment;
}

export async function getComment(id: string): Promise<Comment | null> {
  const comment = await (prisma as any).lookaheadActivityComment.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      reactions: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      replies: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          reactions: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  
  return comment as Comment | null;
}

export async function getActivityComments(
  lookaheadActivityId: string,
  options?: {
    limit?: number;
    offset?: number;
    orderBy?: 'asc' | 'desc';
  }
): Promise<{ comments: Comment[]; total: number }> {
  const { limit = 50, offset = 0, orderBy = 'desc' } = options || {};
  
  // Only get top-level comments (no parent)
  const [comments, total] = await Promise.all([
    (prisma as any).lookaheadActivityComment.findMany({
      where: { 
        lookaheadActivityId,
        parentId: null, // Only top-level comments
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            reactions: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: orderBy },
      take: limit,
      skip: offset,
    }),
    (prisma as any).lookaheadActivityComment.count({ 
      where: { 
        lookaheadActivityId,
        parentId: null, 
      } 
    }),
  ]);
  
  return { comments: comments as Comment[], total };
}

export async function updateComment(
  id: string,
  userId: string,
  input: UpdateCommentInput
): Promise<Comment | null> {
  // First verify the comment belongs to the user
  const existing = await (prisma as any).lookaheadActivityComment.findUnique({
    where: { id },
  });
  
  if (!existing || existing.userId !== userId) {
    return null;
  }
  
  const { content, mentions: providedMentions } = input;
  const mentions = content 
    ? (providedMentions || extractMentions(content))
    : undefined;
  
  const comment = await (prisma as any).lookaheadActivityComment.update({
    where: { id },
    data: {
      ...(content && { content }),
      ...(mentions && { mentions }),
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      reactions: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });
  
  return comment as Comment;
}

export async function deleteComment(id: string, userId: string): Promise<boolean> {
  // First verify the comment belongs to the user
  const existing = await (prisma as any).lookaheadActivityComment.findUnique({
    where: { id },
  });
  
  if (!existing || existing.userId !== userId) {
    return false;
  }
  
  await (prisma as any).lookaheadActivityComment.delete({
    where: { id },
  });
  
  return true;
}

// Reaction operations
export async function addReaction(
  commentId: string,
  userId: string,
  emoji: string
): Promise<CommentReaction | null> {
  try {
    const reaction = await (prisma as any).lookaheadCommentReaction.create({
      data: {
        commentId,
        userId,
        emoji,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    
    // Notify comment author about the reaction
    const comment = await (prisma as any).lookaheadActivityComment.findUnique({
      where: { id: commentId },
      include: {
        lookaheadActivity: {
          select: {
            name: true,
          },
        },
      },
    });
    
    if (comment && comment.userId !== userId) {
      const reactor = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });
      
      notifyUser(comment.userId, 'notification:new', {
        type: 'REACTION',
        title: 'New reaction on your comment',
        message: `${reactor?.firstName} ${reactor?.lastName} reacted ${emoji} to your comment on "${comment.lookaheadActivity.name}"`,
        data: {
          commentId,
          activityId: comment.lookaheadActivityId,
        },
      });
    }
    
    return reaction as CommentReaction;
  } catch (error) {
    // Unique constraint violation - user already reacted with this emoji
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return null;
    }
    throw error;
  }
}

export async function removeReaction(
  commentId: string,
  userId: string,
  emoji: string
): Promise<boolean> {
  try {
    await (prisma as any).lookaheadCommentReaction.delete({
      where: {
        commentId_userId_emoji: {
          commentId,
          userId,
          emoji,
        },
      },
    });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return false;
    }
    throw error;
  }
}

export async function getCommentReactions(commentId: string): Promise<CommentReaction[]> {
  const reactions = await (prisma as any).lookaheadCommentReaction.findMany({
    where: { commentId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  
  return reactions as CommentReaction[];
}

// Get users for @mention autocomplete
export async function getMentionableUsers(
  projectId: string,
  searchTerm?: string
): Promise<Array<{ id: string; firstName: string; lastName: string; email: string }>> {
  const whereClause: Prisma.UserWhereInput = {
    projectMemberships: {
      some: {
        projectId,
      },
    },
  };
  
  if (searchTerm) {
    whereClause.OR = [
      { firstName: { contains: searchTerm, mode: 'insensitive' } },
      { lastName: { contains: searchTerm, mode: 'insensitive' } },
      { email: { contains: searchTerm, mode: 'insensitive' } },
    ];
  }
  
  const users = await prisma.user.findMany({
    where: whereClause,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
    take: 10,
    orderBy: [
      { firstName: 'asc' },
      { lastName: 'asc' },
    ],
  });
  
  return users;
}

// Comment service export
export const commentService = {
  createComment,
  getComment,
  getActivityComments,
  updateComment,
  deleteComment,
  addReaction,
  removeReaction,
  getCommentReactions,
  getMentionableUsers,
  extractMentions,
};
