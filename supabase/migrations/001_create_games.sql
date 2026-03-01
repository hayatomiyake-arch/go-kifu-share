-- GoReco: 棋譜データテーブル
create table if not exists games (
  id uuid default gen_random_uuid() primary key,
  share_id text unique not null,
  sgf text not null,
  board_size smallint not null check (board_size in (9, 13, 19)),
  player_black text not null default '',
  player_white text not null default '',
  komi real not null default 6.5,
  move_count integer not null default 0,
  created_at timestamptz default now() not null
);

-- share_id で高速検索するためのインデックス
create index if not exists idx_games_share_id on games (share_id);

-- Row Level Security を有効化
alter table games enable row level security;

-- 誰でも読める（共有URLで閲覧）
create policy "games_select_all" on games
  for select using (true);

-- 誰でも追加できる（棋譜を記録・共有）
create policy "games_insert_all" on games
  for insert with check (true);

-- 更新・削除は不可（棋譜は不変）
-- ※ 管理者が削除する場合は service_role key を使用
