import { BoardSize, GameNode, GameRecord, IntersectionState, Position, StoneColor } from '@/types/go';
import { createEmptyBoard, placeStone, cloneBoard } from '@/lib/go/rules';

/** SGF座標をPositionに変換 */
function sgfToPos(sgf: string): Position | null {
  if (!sgf || sgf.length < 2) return null;
  const x = sgf.charCodeAt(0) - 97;
  const y = sgf.charCodeAt(1) - 97;
  if (x < 0 || y < 0) return null;
  return { x, y };
}

/** SGFプロパティを解析 */
function parseProperties(text: string): Map<string, string[]> {
  const props = new Map<string, string[]>();
  const regex = /([A-Z]+)((?:\[[^\]]*\])+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const key = match[1];
    const valuesStr = match[2];
    const values: string[] = [];
    const valRegex = /\[([^\]]*)\]/g;
    let valMatch: RegExpExecArray | null;
    while ((valMatch = valRegex.exec(valuesStr)) !== null) {
      values.push(valMatch[1]);
    }
    props.set(key, values);
  }

  return props;
}

interface ParseResult {
  nodeText: string;
  children: ParseResult[];
}

/** SGFのツリー構造をパース */
function parseTree(sgf: string, index: number): { result: ParseResult[]; nextIndex: number } {
  const nodes: ParseResult[] = [];
  let currentNode: ParseResult | null = null;
  let nodeText = '';
  let i = index;

  while (i < sgf.length) {
    const ch = sgf[i];

    if (ch === '(') {
      // サブツリー開始
      const { result: children, nextIndex } = parseTree(sgf, i + 1);
      if (currentNode) {
        currentNode.children.push(...children);
      }
      i = nextIndex;
    } else if (ch === ')') {
      // サブツリー終了
      if (nodeText.trim()) {
        if (currentNode) {
          currentNode.children.push({ nodeText: nodeText.trim(), children: [] });
        } else {
          nodes.push({ nodeText: nodeText.trim(), children: [] });
        }
      }
      return { result: nodes, nextIndex: i + 1 };
    } else if (ch === ';') {
      // 新しいノード
      if (nodeText.trim() && currentNode) {
        const newNode: ParseResult = { nodeText: nodeText.trim(), children: [] };
        currentNode.children.push(newNode);
        currentNode = newNode;
      } else if (nodeText.trim()) {
        currentNode = { nodeText: nodeText.trim(), children: [] };
        nodes.push(currentNode);
      }
      nodeText = '';
      if (!currentNode) {
        currentNode = { nodeText: '', children: [] };
        nodes.push(currentNode);
      }
      i++;
    } else {
      nodeText += ch;
      i++;
    }
  }

  return { result: nodes, nextIndex: i };
}

let parseNodeIdCounter = 0;

/** ParseResult を GameNode に変換 */
function convertToGameNode(
  parsed: ParseResult,
  parentBoard: IntersectionState[][],
  size: BoardSize,
  moveNum: number,
  isRoot: boolean
): GameNode {
  parseNodeIdCounter++;
  const props = parseProperties(parsed.nodeText);
  const id = `parsed_${Date.now()}_${parseNodeIdCounter}`;

  let boardState = cloneBoard(parentBoard);
  let move = null;

  // 黒の手
  const blackMove = props.get('B');
  if (blackMove && blackMove[0] !== undefined) {
    const pos = sgfToPos(blackMove[0]);
    if (pos) {
      const result = placeStone(boardState, pos, 'black', size);
      if (result) {
        boardState = result.newBoard;
        move = {
          position: pos,
          color: 'black' as StoneColor,
          captures: result.captures,
          moveNumber: moveNum,
        };
      }
    } else {
      // パス
      move = { position: null, color: 'black' as StoneColor, captures: [], moveNumber: moveNum };
    }
  }

  // 白の手
  const whiteMove = props.get('W');
  if (whiteMove && whiteMove[0] !== undefined) {
    const pos = sgfToPos(whiteMove[0]);
    if (pos) {
      const result = placeStone(boardState, pos, 'white', size);
      if (result) {
        boardState = result.newBoard;
        move = {
          position: pos,
          color: 'white' as StoneColor,
          captures: result.captures,
          moveNumber: moveNum,
        };
      }
    } else {
      move = { position: null, color: 'white' as StoneColor, captures: [], moveNumber: moveNum };
    }
  }

  const comment = props.get('C')?.[0]?.replace(/\\\\/g, '\\').replace(/\\]/g, ']');

  const node: GameNode = {
    id,
    move: isRoot ? null : move,
    children: [],
    boardState,
    comment,
  };

  // 子ノードを変換
  const nextMoveNum = move ? moveNum + 1 : moveNum;
  for (const child of parsed.children) {
    node.children.push(convertToGameNode(child, boardState, size, nextMoveNum, false));
  }

  return node;
}

/** SGF文字列を棋譜データに変換 */
export function parseSgf(sgfText: string): GameRecord | null {
  try {
    const trimmed = sgfText.trim();
    if (!trimmed.startsWith('(')) return null;

    const { result } = parseTree(trimmed, 0);
    if (result.length === 0) return null;

    // ルートノードのプロパティを取得
    const rootParsed = result[0];
    const rootProps = parseProperties(rootParsed.nodeText);

    const sizeStr = rootProps.get('SZ')?.[0];
    const size = sizeStr ? parseInt(sizeStr) : 19;
    const boardSize = ([9, 13, 19].includes(size) ? size : 19) as BoardSize;

    const komiStr = rootProps.get('KM')?.[0];
    const komi = komiStr ? parseFloat(komiStr) : 6.5;

    const handicapStr = rootProps.get('HA')?.[0];
    const handicap = handicapStr ? parseInt(handicapStr) : 0;

    const emptyBoard = createEmptyBoard(boardSize);
    const rootNode = convertToGameNode(rootParsed, emptyBoard, boardSize, 1, true);

    return {
      boardSize,
      playerBlack: rootProps.get('PB')?.[0] || '',
      playerWhite: rootProps.get('PW')?.[0] || '',
      date: rootProps.get('DT')?.[0] || new Date().toISOString().split('T')[0],
      result: rootProps.get('RE')?.[0],
      komi,
      handicap,
      rootNode,
    };
  } catch {
    return null;
  }
}
