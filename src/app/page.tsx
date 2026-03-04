'use client';

import { useCallback, useState } from 'react';
import { BoardSize, Position } from '@/types/go';
import { useGameState } from '@/lib/go/useGameState';
import GoBoard from '@/components/board/GoBoard';
import GameControls from '@/components/board/GameControls';
import { gameToSgf, downloadSgf } from '@/lib/sgf/encoder';

export default function HomePage() {
  const {
    game,
    viewState,
    currentNode,
    placeStone,
    pass,
    undo,
    goFirst,
    goLast,
    goNext,
    goPrevious,
    newGame,
    updateMetadata,
  } = useGameState();

  const [mode, setMode] = useState<'record' | 'review'>('record');

  // SGFダウンロード用メタデータダイアログ
  const [showSgfDialog, setShowSgfDialog] = useState(false);
  const [playerBlackInput, setPlayerBlackInput] = useState('');
  const [playerWhiteInput, setPlayerWhiteInput] = useState('');
  const [komiInput, setKomiInput] = useState('6.5');

  // 共有URL
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sgfCopied, setSgfCopied] = useState(false);

  const lastMove = currentNode?.move?.position || null;

  const handleIntersectionClick = useCallback(
    (pos: Position) => {
      if (mode === 'record') {
        placeStone(pos);
      }
    },
    [mode, placeStone]
  );

  const handleBoardSizeChange = useCallback(
    (size: BoardSize) => {
      if (size === game.boardSize) return;
      if (viewState.moveNumber > 0) {
        const ok = window.confirm('盤面サイズを変更すると、現在の棋譜がリセットされます。よろしいですか？');
        if (!ok) return;
      }
      newGame(size, game.playerBlack, game.playerWhite, game.komi);
    },
    [game.boardSize, game.playerBlack, game.playerWhite, game.komi, viewState.moveNumber, newGame]
  );

  // 共有URL発行（ダイアログなし、即座に発行）
  const handleShare = useCallback(async () => {
    setSaving(true);
    try {
      const sgf = gameToSgf(game);
      const response = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sgf,
          boardSize: game.boardSize,
          playerBlack: game.playerBlack,
          playerWhite: game.playerWhite,
          komi: game.komi,
          moveCount: viewState.moveNumber,
        }),
      });

      if (!response.ok) {
        throw new Error('保存に失敗しました');
      }

      const data = await response.json();
      const url = `${window.location.origin}/game/${data.shareId}`;
      setShareUrl(url);
      setShowShareDialog(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }, [game, viewState.moveNumber]);

  // SGFダウンロードダイアログを開く
  const openSgfDialog = useCallback(() => {
    setPlayerBlackInput(game.playerBlack);
    setPlayerWhiteInput(game.playerWhite);
    setKomiInput(String(game.komi));
    setShowSgfDialog(true);
  }, [game.playerBlack, game.playerWhite, game.komi]);

  // SGFダウンロード実行
  const handleSgfDownload = useCallback(() => {
    updateMetadata({
      playerBlack: playerBlackInput,
      playerWhite: playerWhiteInput,
    });
    setShowSgfDialog(false);

    const updatedGame = {
      ...game,
      playerBlack: playerBlackInput,
      playerWhite: playerWhiteInput,
      komi: parseFloat(komiInput) || 6.5,
    };
    downloadSgf(updatedGame);
  }, [game, playerBlackInput, playerWhiteInput, komiInput, updateMetadata]);

  const handleCopySgf = useCallback(() => {
    const sgf = gameToSgf(game);
    navigator.clipboard.writeText(sgf);
    setSgfCopied(true);
    setTimeout(() => setSgfCopied(false), 2000);
  }, [game]);

  const handleCopyShareUrl = useCallback(() => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start">
      {/* 碁盤エリア */}
      <div className="flex-shrink-0 w-full lg:w-auto flex flex-col items-center gap-2">
        {/* 盤面サイズ切り替え */}
        <div
          className="flex gap-1 rounded-xl p-1"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          {([19, 13, 9] as BoardSize[]).map(size => (
            <button
              key={size}
              onClick={() => handleBoardSizeChange(size)}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg transition-all"
              style={
                game.boardSize === size
                  ? {
                      backgroundColor: 'var(--color-card-solid)',
                      color: 'var(--color-text)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    }
                  : {
                      color: 'var(--color-text-muted)',
                    }
              }
            >
              {size}路
            </button>
          ))}
        </div>

        <GoBoard
          boardState={viewState.boardState}
          boardSize={game.boardSize}
          nextColor={viewState.nextColor}
          lastMove={lastMove}
          onIntersectionClick={handleIntersectionClick}
          interactive={mode === 'record'}
        />
      </div>

      {/* コントロールエリア */}
      <div className="flex-1 w-full lg:max-w-sm space-y-4 px-2 sm:px-0">
        {/* モード切替 */}
        <div
          className="flex gap-1 rounded-xl p-1"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          {(['record', 'review'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex-1 py-2 text-sm font-medium rounded-lg transition-all"
              style={
                mode === m
                  ? {
                      backgroundColor: 'var(--color-card-solid)',
                      color: 'var(--color-text)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    }
                  : {
                      color: 'var(--color-text-muted)',
                    }
              }
            >
              {m === 'record' ? '記録モード' : '閲覧モード'}
            </button>
          ))}
        </div>

        {/* ゲームコントロール */}
        <GameControls
          moveNumber={viewState.moveNumber}
          nextColor={viewState.nextColor}
          capturedBlack={viewState.capturedBlack}
          capturedWhite={viewState.capturedWhite}
          hasChildren={currentNode ? currentNode.children.length > 0 : false}
          hasPrevious={viewState.currentPath.length > 1}
          hasVariations={currentNode ? currentNode.children.length > 1 : false}
          onFirst={goFirst}
          onPrevious={goPrevious}
          onNext={goNext}
          onLast={goLast}
          onPass={pass}
          onUndo={undo}
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
              分岐（検討図）
            </p>
            <div className="flex flex-wrap gap-2">
              {currentNode.children.map((child, i) => (
                <button
                  key={child.id}
                  onClick={() => goNext()}
                  className="px-3 py-1 text-xs rounded-lg transition-all"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text)',
                  }}
                >
                  {child.move?.position
                    ? `${i === 0 ? '本筋' : `変化${i}`}: ${String.fromCharCode(65 + (child.move.position.x >= 8 ? child.move.position.x + 1 : child.move.position.x))}${game.boardSize - child.move.position.y}`
                    : `パス`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* コメント */}
        {currentNode?.comment && (
          <div
            className="rounded-xl p-4 border"
            style={{
              backgroundColor: 'rgba(184, 134, 11, 0.06)',
              borderColor: 'rgba(184, 134, 11, 0.2)',
            }}
          >
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-accent)' }}>
              コメント
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {currentNode.comment}
            </p>
          </div>
        )}

        {/* アクションボタン */}
        <div className="space-y-2">
          <button
            onClick={handleShare}
            disabled={saving}
            className="w-full py-3 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            style={{
              background: 'linear-gradient(135deg, #b8860b, #d4a853)',
            }}
          >
            {saving ? '保存中...' : '共有URLを発行'}
          </button>
          <div className="flex gap-2">
            <button
              onClick={openSgfDialog}
              className="flex-1 py-3 text-sm font-medium rounded-xl border transition-all"
              style={{
                backgroundColor: 'var(--color-card-solid)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
            >
              SGFダウンロード
            </button>
            <button
              onClick={handleCopySgf}
              className="flex-1 py-3 text-sm font-medium rounded-xl border transition-all"
              style={{
                backgroundColor: sgfCopied ? 'var(--color-surface)' : 'var(--color-card-solid)',
                borderColor: sgfCopied ? 'rgba(34, 120, 60, 0.4)' : 'var(--color-border)',
                color: sgfCopied ? '#2d7a3e' : 'var(--color-text)',
              }}
            >
              {sgfCopied ? 'コピーしました' : 'SGFコピー'}
            </button>
          </div>
        </div>

        {/* 共有URL表示 */}
        {showShareDialog && shareUrl && (
          <div
            className="rounded-xl p-4 border"
            style={{
              backgroundColor: 'rgba(34, 120, 60, 0.06)',
              borderColor: 'rgba(34, 120, 60, 0.2)',
            }}
          >
            <p className="text-sm font-medium mb-2" style={{ color: '#2d7a3e' }}>
              共有URLが発行されました
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 px-3 py-2 text-xs rounded-lg border"
                style={{
                  backgroundColor: 'var(--color-card-solid)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                }}
              />
              <button
                onClick={handleCopyShareUrl}
                className="px-4 py-2 text-xs font-medium text-white rounded-lg transition-all"
                style={{ backgroundColor: copied ? '#1a5c2a' : '#2d7a3e' }}
              >
                {copied ? 'コピーしました' : 'コピー'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SGFダウンロード用メタデータ入力モーダル */}
      {showSgfDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div
            className="rounded-2xl shadow-xl border p-6 w-full max-w-sm mx-4 space-y-5"
            style={{
              backgroundColor: 'var(--color-card-solid)',
              borderColor: 'var(--color-border)',
            }}
          >
            <h2 className="text-lg font-bold text-center" style={{ color: 'var(--color-text)' }}>
              SGFファイル情報
            </h2>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                黒番プレイヤー
              </label>
              <input
                type="text"
                value={playerBlackInput}
                onChange={e => setPlayerBlackInput(e.target.value)}
                placeholder="名前（任意）"
                maxLength={50}
                className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                白番プレイヤー
              </label>
              <input
                type="text"
                value={playerWhiteInput}
                onChange={e => setPlayerWhiteInput(e.target.value)}
                placeholder="名前（任意）"
                maxLength={50}
                className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                コミ
              </label>
              <select
                value={komiInput}
                onChange={e => setKomiInput(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                }}
              >
                <option value="0">0</option>
                <option value="0.5">0.5</option>
                <option value="5.5">5.5</option>
                <option value="6.5">6.5（日本ルール標準）</option>
                <option value="7.5">7.5（中国ルール標準）</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowSgfDialog(false)}
                className="flex-1 py-3 text-sm font-medium rounded-xl transition-all"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                キャンセル
              </button>
              <button
                onClick={handleSgfDownload}
                className="flex-1 py-3 text-sm font-semibold text-white rounded-xl transition-all"
                style={{
                  background: 'linear-gradient(135deg, #b8860b, #d4a853)',
                }}
              >
                ダウンロード
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
