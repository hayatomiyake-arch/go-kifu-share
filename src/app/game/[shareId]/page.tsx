'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useGameState } from '@/lib/go/useGameState';
import { parseSgf } from '@/lib/sgf/parser';
import { downloadSgf } from '@/lib/sgf/encoder';
import GoBoard from '@/components/board/GoBoard';
import GameTreeView from '@/components/board/GameTreeView';

interface SharedGameData {
  shareId: string;
  sgf: string;
  boardSize: number;
  playerBlack: string;
  playerWhite: string;
  komi: number;
  moveCount: number;
  createdAt: string;
}

export default function SharedGamePage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = use(params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameData, setGameData] = useState<SharedGameData | null>(null);

  const {
    game,
    viewState,
    currentNode,
    goFirst,
    goLast,
    goNext,
    goPrevious,
    navigateTo,
    selectBranch,
    loadGame,
  } = useGameState();

  useEffect(() => {
    async function fetchGame() {
      try {
        const res = await fetch(`/api/game?id=${encodeURIComponent(shareId)}`);
        if (!res.ok) {
          setError(res.status === 404 ? 'この棋譜は見つかりませんでした' : '棋譜の読み込みに失敗しました');
          return;
        }
        const data: SharedGameData = await res.json();
        setGameData(data);
        const parsed = parseSgf(data.sgf);
        if (parsed) {
          loadGame(parsed);
        } else {
          setError('棋譜データの解析に失敗しました');
        }
      } catch {
        setError('棋譜の読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    }
    fetchGame();
  }, [shareId, loadGame]);

  const handleDownloadSgf = useCallback(() => {
    downloadSgf(game);
  }, [game]);

  const [urlCopied, setUrlCopied] = useState(false);
  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        <p className="text-gray-500">棋譜を読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="text-4xl">&#129300;</div>
        <p className="text-gray-600 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  const lastMove = currentNode?.move?.position || null;
  const hasPrevious = viewState.currentPath.length > 1;
  const hasChildren = currentNode ? currentNode.children.length > 0 : false;
  const hasVariations = currentNode ? currentNode.children.length > 1 : false;

  return (
    <div className="flex flex-col items-center gap-0 max-w-lg mx-auto">
      {/* 碁盤 */}
      <GoBoard
        boardState={viewState.boardState}
        boardSize={game.boardSize}
        nextColor={viewState.nextColor}
        lastMove={lastMove}
        interactive={false}
      />

      {/* === 碁盤直下：コンパクトナビ === */}
      <div
        className="w-full flex items-center justify-between px-3 py-2 gap-2"
        style={{ backgroundColor: 'var(--color-card)' }}
      >
        {/* 手番+手数 */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${
              viewState.nextColor === 'black'
                ? 'bg-gray-900'
                : 'bg-white border border-gray-300'
            }`}
          />
          <span className="text-xs font-bold whitespace-nowrap" style={{ color: 'var(--color-text)' }}>
            {viewState.moveNumber}手目
          </span>
        </div>

        {/* ナビボタン */}
        <div className="flex gap-1">
          {[
            { key: 'first', handler: goFirst, disabled: !hasPrevious, label: '≪' },
            { key: 'prev', handler: goPrevious, disabled: !hasPrevious, label: '＜' },
            { key: 'next', handler: goNext, disabled: !hasChildren, label: '＞' },
            { key: 'last', handler: goLast, disabled: !hasChildren, label: '≫' },
          ].map(btn => (
            <button
              key={btn.key}
              onClick={btn.handler}
              disabled={btn.disabled}
              className="w-11 h-11 flex items-center justify-center rounded-lg text-lg font-bold transition-all disabled:opacity-25 active:scale-95"
              style={{
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* === ツリービュー === */}
      <div className="w-full px-2 mt-1">
        <GameTreeView
          rootNode={game.rootNode}
          currentNodeId={viewState.currentNodeId}
          currentPath={viewState.currentPath}
          onNodeClick={navigateTo}
        />
      </div>

      {/* === 分岐パネル === */}
      {hasVariations && (
        <div
          className="w-full rounded-xl p-3 mt-2 mx-2 border"
          style={{
            backgroundColor: 'var(--color-card)',
            borderColor: 'var(--color-border-light)',
          }}
        >
          <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
            分岐 ({currentNode!.children.length}つ)
          </p>
          <div className="space-y-1">
            {currentNode!.children.map((child, i) => {
              let depth = 0;
              let n = child;
              while (n) {
                depth++;
                n = n.children.length > 0 ? n.children[0] : null as never;
                if (!n) break;
              }
              const posLabel = child.move?.position
                ? `${String.fromCharCode(65 + (child.move.position.x >= 8 ? child.move.position.x + 1 : child.move.position.x))}${game.boardSize - child.move.position.y}`
                : 'パス';
              const colorLabel = child.move?.color === 'black' ? '黒' : '白';

              return (
                <button
                  key={child.id}
                  onClick={() => selectBranch(i)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-left"
                  style={{
                    backgroundColor: i === 0 ? 'rgba(59, 130, 246, 0.1)' : 'var(--color-surface)',
                    color: 'var(--color-text)',
                    borderLeft: i === 0 ? '3px solid #3b82f6' : '3px solid transparent',
                  }}
                >
                  <div
                    className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      child.move?.color === 'black' ? 'bg-gray-900' : 'bg-white border border-gray-400'
                    }`}
                  />
                  <span className="font-medium">{i === 0 ? '本筋' : `変化${i}`}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>{colorLabel} {posLabel}</span>
                  <span className="ml-auto" style={{ color: 'var(--color-text-muted)' }}>{depth}手</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* === プレイヤー情報 + アゲハマ === */}
      <div
        className="w-full flex justify-between items-center rounded-xl p-3 mt-2 mx-2 border"
        style={{
          backgroundColor: 'var(--color-card)',
          borderColor: 'var(--color-border-light)',
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-gray-900 shadow-sm" />
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
              {game.playerBlack || '黒番'}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              アゲハマ: {viewState.capturedWhite}
            </p>
          </div>
        </div>
        <div className="w-px h-6" style={{ backgroundColor: 'var(--color-border)' }} />
        <div className="flex items-center gap-2">
          <div>
            <p className="text-xs font-semibold text-right" style={{ color: 'var(--color-text)' }}>
              {game.playerWhite || '白番'}
            </p>
            <p className="text-[10px] text-right" style={{ color: 'var(--color-text-muted)' }}>
              アゲハマ: {viewState.capturedBlack}
            </p>
          </div>
          <div className="w-5 h-5 rounded-full bg-white border border-gray-300 shadow-sm" />
        </div>
      </div>

      {/* === 記録情報 + アクション === */}
      <div className="w-full flex items-center justify-between mt-2 px-2 gap-2 pb-4">
        {gameData && (
          <p className="text-[10px] flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
            {new Date(gameData.createdAt).toLocaleDateString('ja-JP')} に記録
          </p>
        )}
        <div className="flex gap-1.5 ml-auto">
          <button
            onClick={handleDownloadSgf}
            className="px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-all"
            style={{
              backgroundColor: 'var(--color-card-solid)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
            }}
          >
            SGF
          </button>
          <button
            onClick={handleCopyUrl}
            className="px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-all"
            style={{
              backgroundColor: urlCopied ? 'rgba(34, 120, 60, 0.08)' : 'var(--color-card-solid)',
              borderColor: urlCopied ? 'rgba(34, 120, 60, 0.4)' : 'var(--color-border)',
              color: urlCopied ? '#2d7a3e' : 'var(--color-text)',
            }}
          >
            {urlCopied ? 'コピー済' : 'URLコピー'}
          </button>
        </div>
      </div>

      {/* === コメント === */}
      {currentNode?.comment && (
        <div
          className="w-full rounded-xl p-3 mx-2 mb-4 border"
          style={{
            backgroundColor: 'rgba(184, 134, 11, 0.06)',
            borderColor: 'rgba(184, 134, 11, 0.2)',
          }}
        >
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-accent)' }}>コメント</p>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{currentNode.comment}</p>
        </div>
      )}
    </div>
  );
}
