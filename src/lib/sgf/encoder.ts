import { BoardSize, GameNode, GameRecord, Position } from '@/types/go';
import { getHandicapPositions } from '@/lib/go/rules';

/** 座標をSGF形式（a-s）に変換 */
function posToSgf(pos: Position): string {
  const col = String.fromCharCode(97 + pos.x); // a = 0
  const row = String.fromCharCode(97 + pos.y);
  return `${col}${row}`;
}

/** ノードをSGF文字列に変換（再帰） */
function nodeToSgf(node: GameNode, isRoot: boolean): string {
  let sgf = isRoot ? '' : ';';

  if (isRoot) {
    // ルートノードにはプロパティを付加しない（親で設定済み）
  } else if (node.move) {
    const prop = node.move.color === 'black' ? 'B' : 'W';
    if (node.move.position) {
      sgf += `${prop}[${posToSgf(node.move.position)}]`;
    } else {
      sgf += `${prop}[]`; // パス
    }
  }

  if (node.comment) {
    // SGFのコメントではエスケープが必要
    const escaped = node.comment.replace(/\\/g, '\\\\').replace(/]/g, '\\]');
    sgf += `C[${escaped}]`;
  }

  if (node.children.length === 1) {
    // 一本道の場合はそのまま続ける
    sgf += nodeToSgf(node.children[0], false);
  } else if (node.children.length > 1) {
    // 分岐がある場合は括弧で囲む
    for (const child of node.children) {
      sgf += `(${nodeToSgf(child, false)})`;
    }
  }

  return sgf;
}

/** 棋譜全体をSGF文字列に変換 */
export function gameToSgf(game: GameRecord): string {
  const sizeMap: Record<BoardSize, number> = { 9: 9, 13: 13, 19: 19 };
  const size = sizeMap[game.boardSize];

  let header = '';
  header += `FF[4]`; // SGFバージョン
  header += `GM[1]`; // Game = Go
  header += `SZ[${size}]`;
  header += `KM[${game.komi}]`;

  if (game.playerBlack) {
    header += `PB[${game.playerBlack}]`;
  }
  if (game.playerWhite) {
    header += `PW[${game.playerWhite}]`;
  }
  if (game.date) {
    header += `DT[${game.date}]`;
  }
  if (game.result) {
    header += `RE[${game.result}]`;
  }
  if (game.handicap > 0) {
    header += `HA[${game.handicap}]`;
    // 置き石の位置をAB[]プロパティで出力
    if (game.handicap >= 2) {
      const positions = getHandicapPositions(game.boardSize, game.handicap);
      if (positions.length > 0) {
        header += 'AB';
        for (const pos of positions) {
          header += `[${posToSgf(pos)}]`;
        }
      }
    }
  }

  header += `AP[GoReco:1.0]`; // アプリ名

  const rootSgf = nodeToSgf(game.rootNode, true);

  return `(;${header}${rootSgf})`;
}

/** SGF文字列をBlobとしてダウンロード */
export function downloadSgf(game: GameRecord, filename?: string): void {
  const sgf = gameToSgf(game);
  const blob = new Blob([sgf], { type: 'application/x-go-sgf' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `goreco_${game.date || 'game'}.sgf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
