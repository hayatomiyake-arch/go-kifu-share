import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/layout/Header';

export const metadata: Metadata = {
  title: '碁レコ (GoReco) - 囲碁棋譜記録・共有サービス',
  description: '囲碁の棋譜をブラウザで記録・共有。検討図の追加やSGFファイルのダウンロードにも対応。',
  openGraph: {
    title: '碁レコ (GoReco) - 囲碁棋譜記録・共有',
    description: '囲碁の棋譜をブラウザで記録・共有。検討図の追加やSGFファイルのダウンロードにも対応。',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">
        <Header />
        <main className="max-w-6xl mx-auto px-2 sm:px-4 py-3 sm:py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
