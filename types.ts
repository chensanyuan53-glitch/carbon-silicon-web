export enum Page {
  HOME = 'home',
  STATION = 'station',
  ARENA = 'arena',
  TASKS = 'tasks',
  SQUARE = 'square',
  MARKET = 'market',
  REGISTER = 'register',
  PROFILE = 'profile',
  RESET_PASSWORD = 'reset-password'
}

export interface Competition {
  id: string;
  title: string;
  category: string;
  prizePool: string;
  deadline: string;
  status: 'active' | 'upcoming' | 'ended';
  tags: string[];
  image: string;
}

export interface Task {
  id: string;
  title: string;
  type: 'bounty' | 'team';
  domain: string;
  budget?: string;
  roleNeeded?: string;
  description: string;
  author: string;
  postedTime: string;
}

export interface MarketItem {
  id: string;
  title: string;
  author: string;
  price: string;
  rating: number;
  users: number;
  image: string;
  category: 'workflow' | 'agent' | 'sop';
  isOfficial?: boolean;
}

export interface Article {
  id: string;
  title: string;
  category: string;
  author: string;
  likes: number;
  comments: number;
  image: string;
  time: string;
}

export interface AiTool {
  id: string;
  category_id?: string | null;
  name: string;
  slug: string;
  description?: string;
  url: string;
  icon_url?: string;
  tags?: string[];
  is_public?: boolean;
  order?: number;
  user_id?: string | null;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface AiCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  order?: number;
  created_at?: string;
  updated_at?: string;
  ai_tools?: AiTool[];
}

export interface Topic {
  id: number;
  user_id: string;
  user_nickname?: string;
  user_avatar_url?: string;
  title: string;
  content: string;
  image_url?: string;
  category: string;
  tag?: string;
  likes_count: number;
  comments_count: number;
  views_count: number;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface HotTopic {
  id: number;
  tag: string;
  display_name: string;
  count: number;
  description?: string;
  is_active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface RecommendedUser {
  id: number;
  user_id: string;
  display_name: string;
  avatar_url?: string;
  role: string;
  description?: string;
  followers_count: number;
  is_active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface MarketProduct {
  id: number;
  user_id?: string | null;
  title: string;
  description: string;
  category: string;
  icon_type: string;
  icon_color: string;
  price: number;
  price_unit: string;
  rating: number;
  user_count: number;
  is_official: boolean;
  is_published: boolean;
  contact_info?: string;
  demo_url?: string;
  github_url?: string;
  documentation_url?: string;
  tags?: string[];
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface MarketCategory {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  icon?: string;
  is_active: boolean;
  order_index: number;
  created_at: string;
}

export interface MarketProductInquiry {
  id: number;
  product_id: number;
  user_id?: string | null;
  contact_method: string;
  message?: string;
  status: string;
  created_at: string;
}