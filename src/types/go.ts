/** 碁石の状態 */
export type StoneColor = 'black' | 'white';

/** 盤面の交点の状態 */
export type IntersectionState = StoneColor | null;

/** 盤面サイズ */
export type BoardSize = 9 | 13 | 19;

/** 盤面上の座標 */
export interface Position {
  x: number; // 0-indexed, 左から
  y: number; // 0-indexed, 上から
}

/** 一手の記録 */
export interface Move {
  position: Position | null; // null = パス
  color: StoneColor;
  captures: Position[]; // この手で取られた石の座標
  moveNumber: number;
}

/** 棋譜のノード（検討図の分岐に対応） */
export interface GameNode {
  id: string;
  move: Move | null; // null = ルートノード
  children: GameNode[];
  comment?: string;
  boardState: IntersectionState[][]; // この手の時点での盤面
}

/** 棋譜全体のメタデータ */
export interface GameRecord {
  id?: string;
  boardSize: BoardSize;
  playerBlack: string;
  playerWhite: string;
  date: string;
  result?: string;
  komi: number;
  handicap: number;
  rootNode: GameNode;
  createdAt?: string;
  shareId?: string;
}

/** 棋譜の表示状態 */
export interface GameViewState {
  currentNodeId: string;
  currentPath: string[]; // ルートからの node ID の配列
  boardState: IntersectionState[][];
  capturedBlack: number; // 白に取られた黒石
  capturedWhite: number; // 黒に取られた白石
  nextColor: StoneColor;
  moveNumber: number;
}
