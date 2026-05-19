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
  is_approved?: boolean;
};

export async function fetchArenas(): Promise<(Arena & { submission_count: number })[]> {
  const { data, error } = await supabase
    .from('arenas')
    .select('*')
    .order('deadline', { ascending: true });
  if (error) throw error;
  
  const arenas = (data ?? []) as Arena[];
  
  // 获取每个竞技场的投稿人数
  const arenaIds = arenas.map(a => a.id);
  if (arenaIds.length === 0) return [];
  
  const { data: submissionsData, error: submissionsError } = await supabase
    .from('arena_submissions')
    .select('arena_id')
    .in('arena_id', arenaIds);
    
  if (submissionsError) {
    console.error('Failed to fetch submissions:', submissionsError);
  }
  
  // 统计每个竞技场的投稿数
  const countMap = new Map<number, number>();
  if (submissionsData) {
    submissionsData.forEach((item: { arena_id: number }) => {
      const current = countMap.get(item.arena_id) || 0;
      countMap.set(item.arena_id, current + 1);
    });
  }
  
  const result = arenas.map(arena => ({
    ...arena,
    submission_count: countMap.get(arena.id) || 0,
  }));
  
  // 未完成的排在前面，已完成的排在后面
  return result.sort((a, b) => {
    const aFinished = a.status === 'finished';
    const bFinished = b.status === 'finished';
    if (aFinished !== bFinished) {
      return aFinished ? 1 : -1;
    }
    // 都未完成时，按截止时间排序（快的在前）
    if (!aFinished && !bFinished) {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    }
    // 都已完成时，按截止时间倒序（最近的在前）
    return new Date(b.deadline).getTime() - new Date(a.deadline).getTime();
  });
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
    is_approved: input.is_approved ?? false,
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

  const meta = userData.user?.user_metadata || {};
  const workerNickname = typeof meta.nickname === 'string' ? meta.nickname : '';
  const workerAvatarUrl = typeof meta.avatar_url === 'string' ? meta.avatar_url : '';

  const { data, error } = await supabase
    .from('arena_submissions')
    .insert({
      arena_id: arenaId,
      worker_id: userId,
      worker_nickname: workerNickname,
      worker_avatar_url: workerAvatarUrl,
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

export async function deleteArena(arenaId: number): Promise<void> {
  // 先检查竞技场是否存在且属于当前用户
  const { data: arena, error: fetchError } = await supabase
    .from('arenas')
    .select('id, creator_id')
    .eq('id', arenaId)
    .single();

  if (fetchError || !arena) {
    throw new Error('竞技场不存在');
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (arena.creator_id !== userId) {
    throw new Error('只有创建者才能删除此竞技场');
  }

  // 先删除关联的投稿
  const { error: submissionsError } = await supabase
    .from('arena_submissions')
    .delete()
    .eq('arena_id', arenaId);
  if (submissionsError) {
    console.error('Failed to delete submissions:', submissionsError);
  }

  // 再删除竞技场，使用 match 条件确保只能删除自己的
  const { error } = await supabase
    .from('arenas')
    .delete()
    .eq('id', arenaId)
    .eq('creator_id', userId!);

  if (error) {
    console.error('Delete arena error:', error);
    throw error;
  }

  // 验证删除是否成功
  const { data: verifyData } = await supabase
    .from('arenas')
    .select('id')
    .eq('id', arenaId)
    .single();

  if (verifyData) {
    throw new Error('删除失败，请检查权限设置');
  }
}
