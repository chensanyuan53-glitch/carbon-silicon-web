import { supabase } from '../supabaseClient';
import { Arena, ArenaSubmission } from '../../types/supabase';

export type CreateArenaInput = {
  title: string;
  description: string;
  domain?: string | null;
  contact_info?: string | null;
  total_prize: number;
  prize_structure?: Record<string, number> | null;
  deadline: string; // ISO string
  status?: 'recruiting' | 'reviewing' | 'finished' | string;
  mode?: 'pitch' | 'benchmark' | 'speed' | null;
};

export async function fetchArenas(): Promise<Arena[]> {
  const { data, error } = await supabase
    .from('arenas')
    .select('*')
    .neq('status', 'finished')
    .order('deadline', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Arena[];
}

export async function fetchArenaDetail(id: number): Promise<Arena | null> {
  const { data, error } = await supabase
    .from('arenas')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as Arena) ?? null;
}

export async function createArena(input: CreateArenaInput): Promise<Arena> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const userId = userData.user?.id;
  if (!userId) throw new Error('请先登录后再发布竞技场');
  const payload = {
    ...input,
    creator_id: userId,
    status: input.status ?? 'recruiting',
    prize_structure: input.prize_structure ?? null,
    domain: input.domain ?? null,
    contact_info: input.contact_info ?? null,
    mode: input.mode ?? null,
  };
  const { data, error } = await supabase
    .from('arenas')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data as Arena;
}

export async function submitSolution(
  arenaId: number,
  summary: string,
  fileUrl: string
): Promise<ArenaSubmission> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const userId = userData.user?.id;
  if (!userId) throw new Error('未检测到登录用户');

  const { data, error } = await supabase
    .from('arena_submissions')
    .insert({
      arena_id: arenaId,
      worker_id: userId,
      summary,
      file_url: fileUrl,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as ArenaSubmission;
}

export async function fetchSubmissions(arenaId: number): Promise<ArenaSubmission[]> {
  const { data, error } = await supabase
    .from('arena_submissions')
    .select('*')
    .eq('arena_id', arenaId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ArenaSubmission[];
}

export async function gradeSubmission(
  submissionId: number,
  score: number,
  status: ArenaSubmission['status']
): Promise<ArenaSubmission> {
  const { data, error } = await supabase
    .from('arena_submissions')
    .update({ score, status })
    .eq('id', submissionId)
    .select('*')
    .single();
  if (error) throw error;
  return data as ArenaSubmission;
}

export async function updateArenaStatus(arenaId: number, status: 'recruiting' | 'reviewing' | 'finished'): Promise<Arena> {
  const { data, error } = await supabase
    .from('arenas')
    .update({ status })
    .eq('id', arenaId)
    .select('*')
    .single();
  if (error) throw error;
  return data as Arena;
}
