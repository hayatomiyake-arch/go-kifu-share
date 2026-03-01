import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * 古い棋譜データのクリーンアップAPI
 * - 6ヶ月以上前の棋譜を削除
 * - CLEANUP_SECRET による認証が必要
 * - GitHub Actions の月次cronから呼び出される想定
 */
export async function POST(request: Request) {
  try {
    // シークレットによる認証
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const cleanupSecret = process.env.CLEANUP_SECRET;

    if (!cleanupSecret || secret !== cleanupSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // 6ヶ月前の日時を計算
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const cutoffDate = sixMonthsAgo.toISOString();

    // 古いレコードを削除
    const { data, error } = await supabase
      .from('games')
      .delete()
      .lt('created_at', cutoffDate)
      .select('share_id');

    if (error) {
      console.error('Cleanup error:', error);
      return NextResponse.json(
        { error: 'Cleanup failed', details: error.message },
        { status: 500 }
      );
    }

    const deletedCount = data?.length ?? 0;

    console.log(`Cleanup completed: ${deletedCount} games deleted (cutoff: ${cutoffDate})`);

    return NextResponse.json({
      success: true,
      deletedCount,
      cutoffDate,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
