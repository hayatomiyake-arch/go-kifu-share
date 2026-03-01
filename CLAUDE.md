# GoReco（碁レコ） - 囲碁棋譜記録・共有サービス

## プロジェクト概要
囲碁の棋譜をブラウザ上で記録し、URL共有できるWebサービス。
「つぶや棋譜」にインスパイアされた、モダンUI・検討図対応・SGFエクスポート機能を持つ。

## 技術スタック
- **Frontend**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Deploy**: Vercel (予定)
- **Package Manager**: npm

## コマンド
- `npm run dev` - 開発サーバー起動 (http://localhost:3000)
- `npm run build` - プロダクションビルド
- `npm run lint` - ESLint 実行
- `npm test` - テスト実行 (Jest)

## ディレクトリ構成
```
src/
  app/           - ページ・レイアウト (App Router)
  components/    - UIコンポーネント
    board/       - 碁盤関連コンポーネント
    ui/          - 汎用UIコンポーネント
  lib/           - ユーティリティ・ビジネスロジック
    sgf/         - SGFファイル解析・生成
    go/          - 囲碁ルールロジック
    supabase/    - Supabase クライアント設定
  types/         - TypeScript 型定義
```

## コーディング規約
- コンポーネントは関数コンポーネント + React Hooks のみ
- 命名: コンポーネントは PascalCase、関数・変数は camelCase、定数は UPPER_SNAKE_CASE
- CSS は Tailwind ユーティリティクラスを使用（CSS Modules 不使用）
- `any` 型の使用禁止。必ず具体的な型を定義する
- エラーハンドリング: try-catch で適切にエラーを補足し、ユーザーにフィードバック
- セキュリティ: ユーザー入力は必ずバリデーション。SQLインジェクション・XSS対策必須

## セキュリティ方針
- Supabase RLS（Row Level Security）を全テーブルに適用
- レート制限を API Route に実装
- ユーザー入力は Zod でバリデーション
- SGFファイルアップロード時はサイズ制限・内容検証を行う
- CSRF 対策は Next.js のビルトイン機能を活用
