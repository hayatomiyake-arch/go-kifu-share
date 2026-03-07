'use client';

import { StoneColor } from '@/types/go';

interface GameControlsProps {
  moveNumber: number;
  nextColor: StoneColor;
  capturedBlack: number;
  capturedWhite: number;
  hasChildren: boolean;
  hasPrevious: boolean;
  hasVariations: boolean;
  isRecordMode: boolean;
  onFirst: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLast: () => void;
  onPass: () => void;
  onUndo: () => void;
  playerBlack: string;
  playerWhite: string;
}

const navButtons = [
  { key: 'first', title: '最初へ', icon: 'M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414zm-6 0a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z' },
  { key: 'prev', title: '一手戻る', icon: 'M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z' },
  { key: 'next', title: '一手進む', icon: 'M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z' },
  { key: 'last', title: '最後へ', icon: 'M4.293 15.707a1 1 0 010-1.414L8.586 10 4.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0zm6 0a1 1 0 010-1.414L14.586 10l-4.293-4.293a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z' },
];

export default function GameControls({
  moveNumber,
  nextColor,
  capturedBlack,
  capturedWhite,
  hasChildren,
  hasPrevious,
  hasVariations,
  isRecordMode,
  onFirst,
  onPrevious,
  onNext,
  onLast,
  onPass,
  onUndo,
  playerBlack,
  playerWhite,
}: GameControlsProps) {
  const handlers: Record<string, () => void> = { first: onFirst, prev: onPrevious, next: onNext, last: onLast };
  const disabledMap: Record<string, boolean> = { first: !hasPrevious, prev: !hasPrevious, next: !hasChildren, last: !hasChildren };

  return (
    <div className="flex flex-col gap-3 w-full max-w-md">
      {/* ナビゲーション＋アクション */}
      <div
        className="rounded-xl p-3 shadow-sm space-y-3 border"
        style={{
          backgroundColor: 'var(--color-card)',
          backdropFilter: 'blur(12px)',
          borderColor: 'var(--color-border-light)',
        }}
      >
        {/* 手番 + 手数 */}
        <div className="flex items-center justify-center gap-3">
          <div
            className={`w-4 h-4 rounded-full shadow-sm ${
              nextColor === 'black'
                ? 'bg-gray-900'
                : 'bg-white border border-gray-300'
            }`}
          />
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {nextColor === 'black' ? '黒' : '白'}の番
          </span>
          <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
            {moveNumber}手目
          </span>
        </div>

        {/* ナビゲーションボタン */}
        <div className="flex justify-center gap-2">
          {navButtons.map(btn => (
            <button
              key={btn.key}
              onClick={handlers[btn.key]}
              disabled={disabledMap[btn.key]}
              className="p-3 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
              }}
              title={btn.title}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d={btn.icon} clipRule="evenodd" />
              </svg>
            </button>
          ))}
        </div>

        {/* 分岐インジケーター */}
        {hasVariations && (
          <div
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              color: '#3b82f6',
            }}
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
            </svg>
            分岐あり（下の分岐パネルで選択）
          </div>
        )}

        {/* パス・一手戻す */}
        <div className="flex justify-center gap-2">
          <button
            onClick={onPass}
            className="px-4 py-2 text-sm rounded-lg font-medium transition-all"
            style={{
              backgroundColor: 'rgba(184, 134, 11, 0.12)',
              color: 'var(--color-accent)',
            }}
          >
            パス
          </button>
          <button
            onClick={onUndo}
            disabled={!hasPrevious}
            className="px-4 py-2 text-sm rounded-lg font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
            }}
          >
            一手戻す
          </button>
        </div>
      </div>

      {/* プレイヤー情報 */}
      <div
        className="flex justify-between items-center rounded-xl p-4 shadow-sm border"
        style={{
          backgroundColor: 'var(--color-card)',
          backdropFilter: 'blur(12px)',
          borderColor: 'var(--color-border-light)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-gray-900 shadow-md" />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              {playerBlack || '黒番'}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              アゲハマ: {capturedWhite}
            </p>
          </div>
        </div>

        <div className="w-px h-8" style={{ backgroundColor: 'var(--color-border)' }} />

        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-semibold text-right" style={{ color: 'var(--color-text)' }}>
              {playerWhite || '白番'}
            </p>
            <p className="text-xs text-right" style={{ color: 'var(--color-text-muted)' }}>
              アゲハマ: {capturedBlack}
            </p>
          </div>
          <div className="w-6 h-6 rounded-full bg-white border border-gray-300 shadow-md" />
        </div>
      </div>
    </div>
  );
}
