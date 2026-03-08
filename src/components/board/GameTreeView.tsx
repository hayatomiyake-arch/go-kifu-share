'use client';

import { useRef, useEffect, useMemo, useCallback } from 'react';
import { GameNode } from '@/types/go';

interface TreeLayoutNode {
  nodeId: string;
  col: number;       // 横方向の位置（ルートからの深さ）
  row: number;       // 縦方向の位置（0=本筋、1+=変化）
  color: 'black' | 'white' | null; // 石の色
  moveNumber: number;
  hasComment: boolean;
  isBranchPoint: boolean; // 子が2つ以上
  parentCol: number;
  parentRow: number;
}

interface GameTreeViewProps {
  rootNode: GameNode;
  currentNodeId: string;
  currentPath: string[];
  onNodeClick: (nodeId: string) => void;
}

/** ツリーをフラットなレイアウトノード配列に変換 */
function buildTreeLayout(root: GameNode): TreeLayoutNode[] {
  const nodes: TreeLayoutNode[] = [];
  let nextRow = 1; // row 0 は本筋

  function traverse(node: GameNode, col: number, row: number, parentCol: number, parentRow: number) {
    nodes.push({
      nodeId: node.id,
      col,
      row,
      color: node.move?.color || null,
      moveNumber: node.move?.moveNumber || 0,
      hasComment: !!node.comment,
      isBranchPoint: node.children.length > 1,
      parentCol,
      parentRow,
    });

    if (node.children.length === 0) return;

    // 最初の子は同じ行で続く（本筋/現在の行を維持）
    traverse(node.children[0], col + 1, row, col, row);

    // 2番目以降の子は新しい行に分岐
    for (let i = 1; i < node.children.length; i++) {
      const branchRow = nextRow;
      nextRow++;
      traverse(node.children[i], col + 1, branchRow, col, row);
    }
  }

  traverse(root, 0, 0, -1, 0);
  return nodes;
}

const NODE_SIZE = 16;     // ノードの直径
const NODE_GAP_X = 4;     // ノード間の横間隔
const NODE_GAP_Y = 6;     // 行間の縦間隔
const STEP_X = NODE_SIZE + NODE_GAP_X; // 1ステップの横幅
const STEP_Y = NODE_SIZE + NODE_GAP_Y; // 1ステップの縦幅
const PADDING_X = 12;
const PADDING_Y = 12;

export default function GameTreeView({ rootNode, currentNodeId, currentPath, onNodeClick }: GameTreeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const layout = useMemo(() => buildTreeLayout(rootNode), [rootNode]);

  const maxCol = useMemo(() => Math.max(...layout.map(n => n.col), 0), [layout]);
  const maxRow = useMemo(() => Math.max(...layout.map(n => n.row), 0), [layout]);

  const canvasWidth = (maxCol + 1) * STEP_X + PADDING_X * 2;
  const canvasHeight = (maxRow + 1) * STEP_Y + PADDING_Y * 2;

  // 現在のノードIDのセット（パス上のノードをハイライト）
  const pathSet = useMemo(() => new Set(currentPath), [currentPath]);

  // ノードIDからレイアウトを引くマップ
  const nodeMap = useMemo(() => {
    const map = new Map<string, TreeLayoutNode>();
    for (const n of layout) map.set(n.nodeId, n);
    return map;
  }, [layout]);

  const getNodeCenter = useCallback((col: number, row: number) => ({
    x: PADDING_X + col * STEP_X + NODE_SIZE / 2,
    y: PADDING_Y + row * STEP_Y + NODE_SIZE / 2,
  }), []);

  // Canvas描画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 接続線を描画
    for (const node of layout) {
      if (node.parentCol < 0) continue;
      const from = getNodeCenter(node.parentCol, node.parentRow);
      const to = getNodeCenter(node.col, node.row);

      const isOnPath = pathSet.has(node.nodeId);
      ctx.strokeStyle = isOnPath ? '#b8860b' : 'rgba(150,150,150,0.4)';
      ctx.lineWidth = isOnPath ? 2 : 1;
      ctx.beginPath();

      if (node.row !== node.parentRow) {
        // 分岐線: 親から下に曲がって子へ
        const midX = from.x + STEP_X * 0.3;
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(midX, from.y);
        ctx.lineTo(midX, to.y);
        ctx.lineTo(to.x, to.y);
      } else {
        // 直線
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
      }
      ctx.stroke();
    }

    // ノードを描画
    for (const node of layout) {
      const center = getNodeCenter(node.col, node.row);
      const isCurrent = node.nodeId === currentNodeId;
      const isOnPath = pathSet.has(node.nodeId);
      const r = NODE_SIZE / 2;

      // ルートノードは特殊
      if (node.color === null) {
        ctx.fillStyle = isOnPath ? '#b8860b' : '#999';
        ctx.beginPath();
        ctx.arc(center.x, center.y, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      // 現在位置のハイライト
      if (isCurrent) {
        ctx.fillStyle = '#e67e00';
        ctx.beginPath();
        ctx.arc(center.x, center.y, r + 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // 石の描画
      if (node.color === 'black') {
        ctx.fillStyle = isOnPath ? '#1a1a1a' : '#555';
        ctx.beginPath();
        ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = isOnPath ? '#ffffff' : '#ccc';
        ctx.beginPath();
        ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isOnPath ? '#333' : '#999';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 手番号ラベル（10の倍数 or 分岐点 or コメント付き）
      const showLabel = node.moveNumber > 0 && (
        node.moveNumber % 10 === 0 ||
        node.isBranchPoint ||
        node.hasComment ||
        isCurrent
      );
      if (showLabel) {
        ctx.fillStyle = isOnPath ? 'var(--color-text, #333)' : '#999';
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(node.moveNumber), center.x, center.y - r - 3);
      }

      // コメントインジケーター
      if (node.hasComment) {
        ctx.fillStyle = '#e67e00';
        ctx.beginPath();
        ctx.arc(center.x + r - 1, center.y - r + 1, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [layout, currentNodeId, pathSet, canvasWidth, canvasHeight, getNodeCenter]);

  // 現在ノードが見えるようにスクロール
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const currentLayout = nodeMap.get(currentNodeId);
    if (!currentLayout) return;

    const center = getNodeCenter(currentLayout.col, currentLayout.row);
    const containerWidth = container.clientWidth;

    // 現在ノードが中央付近に来るようにスクロール
    const targetScroll = center.x - containerWidth / 2;
    container.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });
  }, [currentNodeId, nodeMap, getNodeCenter]);

  // クリックハンドラ
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // クリック位置に最も近いノードを探す
    let closestNode: TreeLayoutNode | null = null;
    let closestDist = Infinity;

    for (const node of layout) {
      const center = getNodeCenter(node.col, node.row);
      const dist = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);
      if (dist < NODE_SIZE && dist < closestDist) {
        closestDist = dist;
        closestNode = node;
      }
    }

    if (closestNode) {
      onNodeClick(closestNode.nodeId);
    }
  }, [layout, getNodeCenter, onNodeClick]);

  return (
    <div
      ref={containerRef}
      className="overflow-x-auto overflow-y-auto rounded-xl border"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border-light)',
        maxHeight: `${Math.min(canvasHeight + 4, 160)}px`,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: canvasWidth, height: canvasHeight, cursor: 'pointer' }}
        onClick={handleCanvasClick}
      />
    </div>
  );
}
