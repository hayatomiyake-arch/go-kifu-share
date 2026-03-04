'use client';

import { useCallback, useMemo } from 'react';
import { BoardSize, IntersectionState, Position, StoneColor } from '@/types/go';
import { getStarPoints } from '@/lib/go/rules';

interface GoBoardProps {
  boardState: IntersectionState[][];
  boardSize: BoardSize;
  nextColor: StoneColor;
  lastMove?: Position | null;
  onIntersectionClick?: (pos: Position) => void;
  interactive?: boolean;
}

export default function GoBoard({
  boardState,
  boardSize,
  nextColor,
  lastMove,
  onIntersectionClick,
  interactive = true,
}: GoBoardProps) {
  const cellSize = useMemo(() => {
    if (boardSize === 19) return 28;
    if (boardSize === 13) return 36;
    return 44;
  }, [boardSize]);

  const stoneRadius = cellSize * 0.45;
  const padding = cellSize;
  const boardPixelSize = cellSize * (boardSize - 1) + padding * 2;

  const starPoints = useMemo(() => getStarPoints(boardSize), [boardSize]);

  const handleClick = useCallback(
    (x: number, y: number) => {
      if (interactive && onIntersectionClick) {
        onIntersectionClick({ x, y });
      }
    },
    [interactive, onIntersectionClick]
  );

  return (
    <div className="inline-block touch-none select-none">
      <svg
        viewBox={`0 0 ${boardPixelSize} ${boardPixelSize}`}
        className="w-full max-w-[min(100vw,560px)] sm:max-w-[min(90vw,560px)] aspect-square rounded-lg shadow-lg"
      >
        <defs>
          {/* 碁盤のグラデーション */}
          <linearGradient id="boardGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#dbb760" />
            <stop offset="50%" stopColor="#d4a843" />
            <stop offset="100%" stopColor="#d8ae4e" />
          </linearGradient>
          {/* 黒石グラデーション */}
          <radialGradient id="blackStone" cx="40%" cy="35%">
            <stop offset="0%" stopColor="#4a4a4a" />
            <stop offset="50%" stopColor="#2a2a2a" />
            <stop offset="100%" stopColor="#0a0a0a" />
          </radialGradient>
          {/* 白石グラデーション */}
          <radialGradient id="whiteStone" cx="40%" cy="35%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="70%" stopColor="#f0f0f0" />
            <stop offset="100%" stopColor="#d8d8d8" />
          </radialGradient>
          {/* 盤面の影 */}
          <filter id="stoneShadow">
            <feDropShadow dx="1" dy="1.5" stdDeviation="1" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* 盤面 */}
        <rect width={boardPixelSize} height={boardPixelSize} fill="url(#boardGradient)" rx="4" />
        {/* 盤面の内側にわずかなヴィネット */}
        <rect
          width={boardPixelSize}
          height={boardPixelSize}
          fill="none"
          stroke="rgba(120,80,30,0.15)"
          strokeWidth="2"
          rx="4"
        />

        {/* 盤面の線 */}
        {Array.from({ length: boardSize }, (_, i) => (
          <g key={`lines-${i}`}>
            <line
              x1={padding + i * cellSize}
              y1={padding}
              x2={padding + i * cellSize}
              y2={padding + (boardSize - 1) * cellSize}
              stroke="#4a3518"
              strokeWidth={i === 0 || i === boardSize - 1 ? 2 : 1}
              shapeRendering="crispEdges"
            />
            <line
              x1={padding}
              y1={padding + i * cellSize}
              x2={padding + (boardSize - 1) * cellSize}
              y2={padding + i * cellSize}
              stroke="#4a3518"
              strokeWidth={i === 0 || i === boardSize - 1 ? 2 : 1}
              shapeRendering="crispEdges"
            />
          </g>
        ))}

        {/* 星（目印） */}
        {starPoints.map(({ x, y }) => (
          <circle
            key={`star-${x}-${y}`}
            cx={padding + x * cellSize}
            cy={padding + y * cellSize}
            r={3.5}
            fill="#4a3518"
          />
        ))}

        {/* 座標ラベル */}
        {Array.from({ length: boardSize }, (_, i) => {
          const letter = String.fromCharCode(65 + (i >= 8 ? i + 1 : i));
          return (
            <g key={`label-${i}`}>
              <text
                x={padding + i * cellSize}
                y={padding - cellSize * 0.5}
                textAnchor="middle"
                fontSize={cellSize * 0.32}
                fill="#7a6040"
                fontFamily="serif"
                opacity={0.8}
              >
                {letter}
              </text>
              <text
                x={padding - cellSize * 0.55}
                y={padding + i * cellSize + cellSize * 0.12}
                textAnchor="middle"
                fontSize={cellSize * 0.32}
                fill="#7a6040"
                fontFamily="serif"
                opacity={0.8}
              >
                {boardSize - i}
              </text>
            </g>
          );
        })}

        {/* 石 */}
        {boardState.map((row, y) =>
          row.map((stone, x) => {
            if (!stone) return null;
            const cx = padding + x * cellSize;
            const cy = padding + y * cellSize;
            const isLast = lastMove && lastMove.x === x && lastMove.y === y;

            return (
              <g key={`stone-${x}-${y}`} filter="url(#stoneShadow)">
                {/* 石本体 */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={stoneRadius}
                  fill={stone === 'black' ? 'url(#blackStone)' : 'url(#whiteStone)'}
                  stroke={stone === 'black' ? '#000' : '#bbb'}
                  strokeWidth={0.3}
                />
                {/* 石の光沢 */}
                <ellipse
                  cx={cx - stoneRadius * 0.2}
                  cy={cy - stoneRadius * 0.22}
                  rx={stoneRadius * 0.25}
                  ry={stoneRadius * 0.18}
                  fill={stone === 'black' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.7)'}
                />
                {/* 最後の手のマーカー */}
                {isLast && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={stoneRadius * 0.3}
                    fill={stone === 'black' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)'}
                  />
                )}
              </g>
            );
          })
        )}

        {/* クリック可能エリア */}
        {interactive &&
          Array.from({ length: boardSize }, (_, y) =>
            Array.from({ length: boardSize }, (_, x) => (
              <rect
                key={`click-${x}-${y}`}
                x={padding + x * cellSize - cellSize / 2}
                y={padding + y * cellSize - cellSize / 2}
                width={cellSize}
                height={cellSize}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => handleClick(x, y)}
              >
                <title>
                  {String.fromCharCode(65 + (x >= 8 ? x + 1 : x))}{boardSize - y}
                </title>
              </rect>
            ))
          )}
      </svg>
    </div>
  );
}
