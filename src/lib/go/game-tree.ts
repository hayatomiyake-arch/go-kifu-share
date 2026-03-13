import { BoardSize, GameNode, GameRecord, GameViewState, IntersectionState, Move, Position, StoneColor } from '@/types/go';
import { createEmptyBoard, placeStone, isKo, cloneBoard, oppositeColor, placeHandicapStones } from './rules';

let nodeIdCounter = 0;

/** ユニークなノードIDを生成 */
function generateNodeId(): string {
  nodeIdCounter++;
  return `node_${Date.now()}_${nodeIdCounter}`;
}

/** 新しい棋譜を作成 */
export function createNewGame(
  boardSize: BoardSize,
  playerBlack = '',
  playerWhite = '',
  komi = 6.5,
  handicap = 0
): GameRecord {
  const emptyBoard = createEmptyBoard(boardSize);
  const initialBoard = handicap >= 2 ? placeHandicapStones(emptyBoard, boardSize, handicap) : emptyBoard;

  const rootNode: GameNode = {
    id: generateNodeId(),
    move: null,
    children: [],
    boardState: initialBoard,
  };

  return {
    boardSize,
    playerBlack,
    playerWhite,
    date: new Date().toISOString().split('T')[0],
    komi,
    handicap,
    rootNode,
  };
}

/** 棋譜ツリーからノードを検索 */
export function findNode(root: GameNode, nodeId: string): GameNode | null {
  if (root.id === nodeId) return root;
  for (const child of root.children) {
    const found = findNode(child, nodeId);
    if (found) return found;
  }
  return null;
}

/** ルートから指定ノードまでのパスを取得 */
export function getPathToNode(root: GameNode, targetId: string): string[] | null {
  if (root.id === targetId) return [root.id];
  for (const child of root.children) {
    const childPath = getPathToNode(child, targetId);
    if (childPath) return [root.id, ...childPath];
  }
  return null;
}

/** 新しい手を追加 */
export function addMove(
  game: GameRecord,
  parentNodeId: string,
  position: Position | null, // null = パス
  color: StoneColor,
  asMainLine = false // trueの場合、既存の分岐より前（メインライン）に挿入
): { game: GameRecord; newNodeId: string } | null {
  const parentNode = findNode(game.rootNode, parentNodeId);
  if (!parentNode) return null;

  let newBoardState: IntersectionState[][];
  let captures: Position[] = [];

  if (position === null) {
    // パス
    newBoardState = cloneBoard(parentNode.boardState);
  } else {
    const result = placeStone(parentNode.boardState, position, color, game.boardSize);
    if (!result) return null; // 着手禁止

    // コウチェック: 新しい盤面が2手前（親の親）の盤面と同一なら着手禁止
    const pathToParent = getPathToNode(game.rootNode, parentNodeId);
    if (pathToParent && pathToParent.length >= 2) {
      const grandparentId = pathToParent[pathToParent.length - 2];
      const grandparentNode = findNode(game.rootNode, grandparentId);
      if (grandparentNode && isKo(result.newBoard, grandparentNode.boardState)) {
        return null; // コウ: 取り返し禁止
      }
    }

    newBoardState = result.newBoard;
    captures = result.captures;
  }

  // 手番号を計算
  const path = getPathToNode(game.rootNode, parentNodeId);
  const moveNumber = path ? path.length : 0;

  const move: Move = {
    position,
    color,
    captures,
    moveNumber,
  };

  const newNode: GameNode = {
    id: generateNodeId(),
    move,
    children: [],
    boardState: newBoardState,
  };

  if (asMainLine && parentNode.children.length > 0) {
    parentNode.children.unshift(newNode);
  } else {
    parentNode.children.push(newNode);
  }

  return { game, newNodeId: newNode.id };
}

/** 指定ノードの GameViewState を計算 */
export function getViewState(game: GameRecord, nodeId: string): GameViewState | null {
  const path = getPathToNode(game.rootNode, nodeId);
  if (!path) return null;

  const node = findNode(game.rootNode, nodeId);
  if (!node) return null;

  // パスを辿ってアゲハマを計算
  let capturedBlack = 0;
  let capturedWhite = 0;
  let moveNumber = 0;

  for (const id of path) {
    const n = findNode(game.rootNode, id);
    if (n?.move) {
      moveNumber = n.move.moveNumber;
      if (n.move.color === 'black') {
        capturedWhite += n.move.captures.length;
      } else {
        capturedBlack += n.move.captures.length;
      }
    }
  }

  // 次の手番を決定
  const lastMove = node.move;
  const nextColor: StoneColor = lastMove
    ? oppositeColor(lastMove.color)
    : (game.handicap > 0 ? 'white' : 'black');

  return {
    currentNodeId: nodeId,
    currentPath: path,
    boardState: node.boardState,
    capturedBlack,
    capturedWhite,
    nextColor,
    moveNumber,
  };
}

/** 指定ノードの子ノードからtargetIdを削除 */
export function removeChildNode(root: GameNode, parentId: string, targetId: string): boolean {
  const parent = findNode(root, parentId);
  if (!parent) return false;
  const idx = parent.children.findIndex(c => c.id === targetId);
  if (idx === -1) return false;
  parent.children.splice(idx, 1);
  return true;
}

/** 検討図の分岐を追加（既存のノードから別の手を打つ） */
export function addVariation(
  game: GameRecord,
  parentNodeId: string,
  position: Position,
  color: StoneColor,
  comment?: string
): { game: GameRecord; newNodeId: string } | null {
  const result = addMove(game, parentNodeId, position, color);
  if (!result) return null;

  if (comment) {
    const newNode = findNode(game.rootNode, result.newNodeId);
    if (newNode) {
      newNode.comment = comment;
    }
  }

  return result;
}
