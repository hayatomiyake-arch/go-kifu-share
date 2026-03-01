import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { supabase } from '@/lib/supabase';

// SGFの簡易バリデーション
function validateSgf(sgf: string): boolean {
  if (!sgf || typeof sgf !== 'string') return false;
  if (sgf.length > 500000) return false; // 500KB制限
  if (!sgf.startsWith('(;')) return false;
  if (!sgf.endsWith(')')) return false;
  return true;
}

// 文字列の安全なサニタイズ
function sanitizeString(str: string, maxLength: number): string {
  if (typeof str !== 'string') return '';
  return str.slice(0, maxLength).replace(/[<>"'&]/g, '');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sgf, boardSize, playerBlack, playerWhite, komi, moveCount } = body;

    // バリデーション
    if (!validateSgf(sgf)) {
      return NextResponse.json({ error: '無効な棋譜データです' }, { status: 400 });
    }

    if (![9, 13, 19].includes(boardSize)) {
      return NextResponse.json({ error: '無効な盤面サイズです' }, { status: 400 });
    }

    const shareId = nanoid(10);

    const { error } = await supabase.from('games').insert({
      share_id: shareId,
      sgf,
      board_size: boardSize,
      player_black: sanitizeString(playerBlack || '', 50),
      player_white: sanitizeString(playerWhite || '', 50),
      komi: typeof komi === 'number' ? komi : 6.5,
      move_count: typeof moveCount === 'number' ? moveCount : 0,
    });

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: '棋譜の保存に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({ shareId }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'リクエストの処理に失敗しました' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shareId = searchParams.get('id');

  if (!shareId) {
    return NextResponse.json({ error: '棋譜IDが必要です' }, { status: 400 });
  }

  // IDのバリデーション
  if (!/^[a-zA-Z0-9_-]{1,21}$/.test(shareId)) {
    return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('games')
    .select('share_id, sgf, board_size, player_black, player_white, komi, move_count, created_at')
    .eq('share_id', shareId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: '棋譜が見つかりません' }, { status: 404 });
  }

  return NextResponse.json({
    shareId: data.share_id,
    sgf: data.sgf,
    boardSize: data.board_size,
    playerBlack: data.player_black,
    playerWhite: data.player_white,
    komi: data.komi,
    moveCount: data.move_count,
    createdAt: data.created_at,
  });
}
