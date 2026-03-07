'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { BoardSize } from '@/types/go';
import { useGameState } from '@/lib/go/useGameState';
import { parseSgf } from '@/lib/sgf/parser';
import { downloadSgf, gameToSgf } from '@/lib/sgf/encoder';
import GoBoard from '@/components/board/GoBoard';
import GameControls from '@/components/board/GameControls';

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
    selectBranch,
    loadGame,
  } = useGameState();

  useEffect(() => {
    async function fetchGame() {
      try {
        const res = await fetch(`/api/game?id=${encodeURIComponent(shareId)}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('この棋譜は見つかりませんでした');
          } else {
            setError('棋譜の読み込みに失敗しました');
          }
          return;
        }

        const data: SharedGameData = await res.json();
        setGameData(data);

        // SGFを解析してゲームに読み込む
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

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* 碁盤エリア */}
      <div className="flex-shrink-0 w-full lg:w-auto flex justify-center">
        <GoBoard
          boardState={viewState.boardState}
          boardSize={game.boardSize}
          nextColor={viewState.nextColor}
          lastMove={lastMove}
          interactive={false}
        />
      </div>

      {/* 情報エリア */}
      <div className="flex-1 w-full lg:max-w-sm space-y-4">
        {/* 対局情報 */}
        {gameData && (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-2">
              {new Date(gameData.createdAt).toLocaleDateString('ja-JP')} に記録
            </p>
          </div>
        )}

        {/* ゲームコントロール */}
        <GameControls
          moveNumber={viewState.moveNumber}
          nextColor={viewState.nextColor}
          capturedBlack={viewState.capturedBlack}
          capturedWhite={viewState.capturedWhite}
          hasChildren={currentNode ? currentNode.children.length > 0 : false}
          hasPrevious={viewState.currentPath.length > 1}
          hasVariations={currentNode ? currentNode.children.length > 1 : false}
          isRecordMode={false}
          onFirst={goFirst}
          onPrevious={goPrevious}
          onNext={goNext}
          onLast={goLast}
          onPass={() => {}}
          onUndo={goPrevious}
          playerBlack={game.playerBlack}
          playerWhite={game.playerWhite}
        />

        {/* 分岐表示 */}
        {currentNode && currentNode.children.length > 1 && (
          <div
            className="rounded-xl p-4 shadow-sm border"
            style={{
              backgroundColor: 'var(--color-card)',
              backdropFilter: 'blur(12px)',
              borderColor: 'var(--color-border-light)',
            }}
          >
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
              分岐 ({currentNode.children.length}つ)
            </p>
            <div className="space-y-1.5">
              {currentNode.children.map((child, i) => {
                let depth = 0;
                let node = child;
                while (node) {
                  depth++;
                  node = node.children.length > 0 ? node.children[0] : null as never;
                  if (!node) break;
                }
                const posLabel = child.move?.position
                  ? `${String.fromCharCode(65 + (child.move.position.x >= 8 ? child.move.position.x + 1 : child.move.position.x))}${game.boardSize - child.move.position.y}`
                  : 'パス';
                const colorLabel = child.move?.color === 'black' ? '黒' : '白';

                return (
                  <button
                    key={child.id}
                    onClick={() => selectBranch(i)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-all text-left"
                    style={{
                      backgroundColor: i === 0 ? 'rgba(59, 130, 246, 0.1)' : 'var(--color-surface)',
                      color: 'var(--color-text)',
                      borderLeft: i === 0 ? '3px solid #3b82f6' : '3px solid transparent',
                    }}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${
                        child.move?.color === 'black'
                          ? 'bg-gray-900'
                          : 'bg-white border border-gray-400'
                      }`}
                    />
                    <span className="font-medium">
                      {i === 0 ? '本筋' : `変化${i}`}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {colorLabel} {posLabel}
                    </span>
                    <span className="ml-auto" style={{ color: 'var(--color-text-muted)' }}>
                      {depth}手
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* コメント */}
        {currentNode?.comment && (
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">コメント</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{currentNode.comment}</p>
          </div>
        )}

        {/* アクション */}
        <div className="flex gap-2">
          <button
            onClick={handleDownloadSgf}
            className="flex-1 py-3 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
          >
            SGFダウンロード
          </button>
          <button
            onClick={handleCopyUrl}
            className="flex-1 py-3 text-sm font-medium rounded-xl border transition-all"
            style={{
              backgroundColor: urlCopied ? 'rgba(34, 120, 60, 0.08)' : undefined,
              borderColor: urlCopied ? 'rgba(34, 120, 60, 0.4)' : undefined,
              color: urlCopied ? '#2d7a3e' : undefined,
            }}
          >
            {urlCopied ? 'コピーしました' : 'URLをコピー'}
          </button>
        </div>
      </div>
    </div>
  );
}
