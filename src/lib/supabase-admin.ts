import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * 管理者用Supabaseクライアント（RLSバイパス）
 * サーバーサイドの管理操作（古いデータの削除等）にのみ使用
 */
export function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY が設定されていません。Vercel の環境変数に設定してください。'
    );
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}
