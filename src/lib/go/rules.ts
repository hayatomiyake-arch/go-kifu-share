import { BoardSize, IntersectionState, Position, StoneColor } from '@/types/go';

/** 空の盤面を生成 */
export function createEmptyBoard(size: BoardSize): IntersectionState[][] {
  return Array.from({ length: size }, () => Array<IntersectionState>(size).fill(null));
}

/** 盤面をディープコピー */
export function cloneBoard(board: IntersectionState[][]): IntersectionState[][] {
  return board.map(row => [...row]);
}

/** 座標が盤面内かチェック */
export function isOnBoard(pos: Position, size: BoardSize): boolean {
  return pos.x >= 0 && pos.x < size && pos.y >= 0 && pos.y < size;
}

/** 隣接する4方向の座標を取得 */
export function getNeighbors(pos: Position, size: BoardSize): Position[] {
  const dirs = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ];
  return dirs
    .map(d => ({ x: pos.x + d.x, y: pos.y + d.y }))
    .filter(p => isOnBoard(p, size));
}

/** 連（つながった同色の石のグループ）を取得 */
export function getGroup(
  board: IntersectionState[][],
  pos: Position,
  size: BoardSize
): Position[] {
  const color = board[pos.y][pos.x];
  if (!color) return [];

  const visited = new Set<string>();
  const group: Position[] = [];
  const stack: Position[] = [pos];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const key = `${current.x},${current.y}`;
    if (visited.has(key)) continue;
    visited.add(key);

    if (board[current.y][current.x] !== color) continue;

    group.push(current);
    for (const neighbor of getNeighbors(current, size)) {
      const nKey = `${neighbor.x},${neighbor.y}`;
      if (!visited.has(nKey)) {
        stack.push(neighbor);
      }
    }
  }

  return group;
}

/** 連の呼吸点（自由度）の数を取得 */
export function getLiberties(
  board: IntersectionState[][],
  group: Position[],
  size: BoardSize
): number {
  const liberties = new Set<string>();
  for (const pos of group) {
    for (const neighbor of getNeighbors(pos, size)) {
      if (board[neighbor.y][neighbor.x] === null) {
        liberties.add(`${neighbor.x},${neighbor.y}`);
      }
    }
  }
  return liberties.size;
}

/** 反対の色を取得 */
export function oppositeColor(color: StoneColor): StoneColor {
  return color === 'black' ? 'white' : 'black';
}

/** 石を置いた結果を計算。着手禁止なら null を返す */
export function placeStone(
  board: IntersectionState[][],
  pos: Position,
  color: StoneColor,
  size: BoardSize
): { newBoard: IntersectionState[][]; captures: Position[] } | null {
  // すでに石がある場所には置けない
  if (board[pos.y][pos.x] !== null) return null;

  const newBoard = cloneBoard(board);
  newBoard[pos.y][pos.x] = color;

  const captures: Position[] = [];
  const opponent = oppositeColor(color);

  // 隣接する相手の連で呼吸点が0になったものを取り除く
  for (const neighbor of getNeighbors(pos, size)) {
    if (newBoard[neighbor.y][neighbor.x] === opponent) {
      const group = getGroup(newBoard, neighbor, size);
      if (getLiberties(newBoard, group, size) === 0) {
        for (const p of group) {
          newBoard[p.y][p.x] = null;
          captures.push(p);
        }
      }
    }
  }

  // 自殺手チェック（自分の連の呼吸点が0になる場合は着手禁止）
  const ownGroup = getGroup(newBoard, pos, size);
  if (getLiberties(newBoard, ownGroup, size) === 0) {
    return null; // 自殺手
  }

  return { newBoard, captures };
}

/** コウのチェック: 直前の盤面と同一かどうか */
export function isKo(
  newBoard: IntersectionState[][],
  previousBoard: IntersectionState[][] | null
): boolean {
  if (!previousBoard) return false;
  const size = newBoard.length;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (newBoard[y][x] !== previousBoard[y][x]) return false;
    }
  }
  return true;
}

/** 星の位置を取得（盤面上の目印） */
export function getStarPoints(size: BoardSize): Position[] {
  if (size === 9) {
    return [
      { x: 2, y: 2 }, { x: 6, y: 2 },
      { x: 4, y: 4 },
      { x: 2, y: 6 }, { x: 6, y: 6 },
    ];
  }
  if (size === 13) {
    return [
      { x: 3, y: 3 }, { x: 9, y: 3 },
      { x: 6, y: 6 },
      { x: 3, y: 9 }, { x: 9, y: 9 },
    ];
  }
  // 19路
  return [
    { x: 3, y: 3 }, { x: 9, y: 3 }, { x: 15, y: 3 },
    { x: 3, y: 9 }, { x: 9, y: 9 }, { x: 15, y: 9 },
    { x: 3, y: 15 }, { x: 9, y: 15 }, { x: 15, y: 15 },
  ];
}
