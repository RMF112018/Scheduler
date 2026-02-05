import axios from 'axios';

// @ts-expect-error - Vite provides import.meta.env at runtime
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

// Types
export interface CommentUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface CommentReaction {
  id: string;
  commentId: string;
  userId: string;
  emoji: string;
  createdAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface Comment {
  id: string;
  lookaheadActivityId: string;
  userId: string;
  parentId: string | null;
  content: string;
  mentions: string[];
  createdAt: string;
  updatedAt: string;
  user?: CommentUser;
  reactions?: CommentReaction[];
  replies?: Comment[];
}

export interface MentionableUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

// API functions
export const commentApi = {
  // Get comments for an activity
  async getActivityComments(
    activityId: string,
    options?: { limit?: number; offset?: number; order?: 'asc' | 'desc' }
  ): Promise<{ comments: Comment[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.order) params.append('order', options.order);

    const response = await axios.get(
      `${API_BASE_URL}/activities/${activityId}/comments?${params.toString()}`
    );
    return {
      comments: response.data.data,
      total: response.data.pagination.total,
    };
  },

  // Get a single comment
  async getComment(commentId: string): Promise<Comment> {
    const response = await axios.get(`${API_BASE_URL}/comments/${commentId}`);
    return response.data.data;
  },

  // Create a comment
  async createComment(
    activityId: string,
    content: string,
    options?: { parentId?: string; mentions?: string[] }
  ): Promise<Comment> {
    const response = await axios.post(
      `${API_BASE_URL}/activities/${activityId}/comments`,
      {
        content,
        parentId: options?.parentId,
        mentions: options?.mentions,
      }
    );
    return response.data.data;
  },

  // Update a comment
  async updateComment(
    commentId: string,
    content: string,
    mentions?: string[]
  ): Promise<Comment> {
    const response = await axios.put(`${API_BASE_URL}/comments/${commentId}`, {
      content,
      mentions,
    });
    return response.data.data;
  },

  // Delete a comment
  async deleteComment(commentId: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/comments/${commentId}`);
  },

  // Add a reaction
  async addReaction(commentId: string, emoji: string): Promise<CommentReaction> {
    const response = await axios.post(
      `${API_BASE_URL}/comments/${commentId}/reactions`,
      { emoji }
    );
    return response.data.data;
  },

  // Remove a reaction
  async removeReaction(commentId: string, emoji: string): Promise<void> {
    await axios.delete(
      `${API_BASE_URL}/comments/${commentId}/reactions/${encodeURIComponent(emoji)}`
    );
  },

  // Get mentionable users for autocomplete
  async getMentionableUsers(
    projectId: string,
    search?: string
  ): Promise<MentionableUser[]> {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    const response = await axios.get(
      `${API_BASE_URL}/projects/${projectId}/mentionable-users${params}`
    );
    return response.data.data;
  },
};

export default commentApi;
