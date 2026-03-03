export interface Arena {
  id: number;
  created_at: string;
  creator_id: string;
  title: string;
  description: string;
  domain: string | null;
  contact_info: string | null;
  total_prize: number;
  prize_structure: Record<string, number> | null;
  deadline: string;
  status: 'recruiting' | 'reviewing' | 'finished' | string;
  mode: 'pitch' | 'benchmark' | 'speed' | null;
}

export interface ArenaSubmission {
  id: number;
  created_at: string;
  arena_id: number;
  worker_id: string;
  summary: string | null;
  file_url: string | null;
  status: 'pending' | 'winner' | 'runner_up' | 'rejected' | string;
  score: number | null;
  admin_feedback: string | null;
}

export interface Notification {
  id: number;
  user_id: string;
  type: string;
  title: string;
  content: string;
  related_link: string | null;
  is_read: boolean;
  created_at: string;
}
