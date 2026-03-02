'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();
  const isHome = pathname === '/';

  const handleNewGame = () => {
    if (isHome) {
      // トップページにいる場合：確認してからリロード
      const ok = window.confirm('現在の棋譜を破棄して新しい棋譜を始めますか？');
      if (ok) {
        window.location.reload();
      }
    }
    // 他のページの場合はLink遷移でトップに戻る
  };

  return (
    <header className="sticky top-0 z-50 border-b" style={{
      backgroundColor: 'rgba(250, 246, 240, 0.85)',
      backdropFilter: 'blur(12px)',
      borderColor: 'var(--color-border)',
    }}>
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
            style={{ background: 'linear-gradient(135deg, #b8860b, #d4a853)' }}
          >
            <span className="text-white text-sm font-bold">碁</span>
          </div>
          <span className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
            GoReco
          </span>
          <span className="text-xs hidden sm:inline" style={{ color: 'var(--color-text-muted)' }}>
            碁レコ
          </span>
        </Link>

        <nav className="flex items-center gap-4">
          {isHome ? (
            <button
              onClick={handleNewGame}
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm cursor-pointer"
              style={{ backgroundColor: 'var(--color-accent)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-accent)')}
            >
              新しい棋譜
            </button>
          ) : (
            <Link
              href="/"
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm"
              style={{ backgroundColor: 'var(--color-accent)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-accent)')}
            >
              新しい棋譜
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
