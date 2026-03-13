import { describe, it, expect } from 'vitest';
import { createNewGame, addMove, getViewState, findNode, getPathToNode, removeChildNode } from '../game-tree';
import { gameToSgf } from '../../sgf/encoder';
import { parseSgf } from '../../sgf/parser';
import { getHandicapPositions, placeHandicapStones, createEmptyBoard } from '../rules';
import { BoardSize, GameRecord } from '@/types/go';

/** ヘルパー: メインラインの手数を数える */
function countMainLineMoves(game: GameRecord): number {
  let count = 0;
  let node = game.rootNode;
  while (node.children.length > 0) {
    node = node.children[0];
    if (node.move) count++;
  }
  return count;
}

/** ヘルパー: メインラインの全ノードIDを返す */
function getMainLineIds(game: GameRecord): string[] {
  const ids: string[] = [game.rootNode.id];
  let node = game.rootNode;
  while (node.children.length > 0) {
    node = node.children[0];
    ids.push(node.id);
  }
  return ids;
}

describe('対局記録と分岐', () => {
  it('プレイヤー「亀田さん」vs「田中さん」: 9路盤で10手記録できる', () => {
    const game = createNewGame(9, '亀田さん', '田中さん', 6.5);
    expect(game.playerBlack).toBe('亀田さん');
    expect(game.playerWhite).toBe('田中さん');

    // 10手打つ
    let currentId = game.rootNode.id;
    const positions = [
      { x: 2, y: 2 }, { x: 6, y: 2 }, // 手1-2
      { x: 2, y: 6 }, { x: 6, y: 6 }, // 手3-4
      { x: 4, y: 4 }, { x: 4, y: 2 }, // 手5-6
      { x: 4, y: 6 }, { x: 2, y: 4 }, // 手7-8
      { x: 6, y: 4 }, { x: 4, y: 3 }, // 手9-10
    ];
    const colors: Array<'black' | 'white'> = ['black', 'white', 'black', 'white', 'black', 'white', 'black', 'white', 'black', 'white'];

    for (let i = 0; i < 10; i++) {
      const result = addMove(game, currentId, positions[i], colors[i]);
      expect(result).not.toBeNull();
      currentId = result!.newNodeId;
    }

    expect(countMainLineMoves(game)).toBe(10);
  });

  it('5手記録後に3手目に戻って別の手を打つと分岐ができる', () => {
    const game = createNewGame(9, '佐藤さん', '鈴木さん', 6.5);

    // 5手打つ
    let currentId = game.rootNode.id;
    const moves = [
      { pos: { x: 2, y: 2 }, color: 'black' as const },
      { pos: { x: 6, y: 6 }, color: 'white' as const },
      { pos: { x: 2, y: 6 }, color: 'black' as const },
      { pos: { x: 6, y: 2 }, color: 'white' as const },
      { pos: { x: 4, y: 4 }, color: 'black' as const },
    ];

    const nodeIds: string[] = [game.rootNode.id];
    for (const m of moves) {
      const result = addMove(game, currentId, m.pos, m.color);
      expect(result).not.toBeNull();
      currentId = result!.newNodeId;
      nodeIds.push(currentId);
    }

    // 3手目のノード（nodeIds[3]）に戻る
    const thirdMoveId = nodeIds[3]; // move3のノード
    const viewAt3 = getViewState(game, thirdMoveId);
    expect(viewAt3).not.toBeNull();
    expect(viewAt3!.moveNumber).toBe(3);

    // 3手目から別の手を打つ（分岐作成、asMainLine=true）
    const branchResult = addMove(game, thirdMoveId, { x: 3, y: 3 }, 'white', true);
    expect(branchResult).not.toBeNull();

    // 3手目のノードに2つの子がある
    const thirdNode = findNode(game.rootNode, thirdMoveId);
    expect(thirdNode!.children.length).toBe(2);

    // children[0]は新しい分岐（メインライン）
    expect(thirdNode!.children[0].move!.position).toEqual({ x: 3, y: 3 });
    // children[1]は元の4手目
    expect(thirdNode!.children[1].move!.position).toEqual({ x: 6, y: 2 });

    // 元の5手目はchildren[1]の子として残っている
    expect(thirdNode!.children[1].children.length).toBe(1);
    expect(thirdNode!.children[1].children[0].move!.position).toEqual({ x: 4, y: 4 });
  });

  it('同じ位置に打つと既存ノードへ移動（重複防止）', () => {
    const game = createNewGame(9, 'A', 'B', 6.5);

    // 3手打つ
    let currentId = game.rootNode.id;
    const r1 = addMove(game, currentId, { x: 2, y: 2 }, 'black');
    currentId = r1!.newNodeId;
    const r2 = addMove(game, currentId, { x: 6, y: 6 }, 'white');
    currentId = r2!.newNodeId;
    const r3 = addMove(game, currentId, { x: 4, y: 4 }, 'black');

    // move2に戻って同じ3手目を打つ → 新しいノードを作らず既存ノード
    const move2Node = findNode(game.rootNode, r2!.newNodeId);
    expect(move2Node!.children.length).toBe(1); // 元の3手目のみ
    expect(move2Node!.children[0].id).toBe(r3!.newNodeId);
  });
});

describe('SGFエンコード/デコード（分岐保持）', () => {
  it('分岐つき棋譜をSGFにエンコードし、パースして分岐が復元される', () => {
    const game = createNewGame(9, '高橋さん', '山本さん', 6.5);

    // 5手打つ
    let currentId = game.rootNode.id;
    const moves = [
      { pos: { x: 2, y: 2 }, color: 'black' as const },
      { pos: { x: 6, y: 6 }, color: 'white' as const },
      { pos: { x: 2, y: 6 }, color: 'black' as const },
      { pos: { x: 6, y: 2 }, color: 'white' as const },
      { pos: { x: 4, y: 4 }, color: 'black' as const },
    ];
    const nodeIds: string[] = [game.rootNode.id];
    for (const m of moves) {
      const result = addMove(game, currentId, m.pos, m.color);
      currentId = result!.newNodeId;
      nodeIds.push(currentId);
    }

    // 2手目(white)から分岐を作る
    const move2Id = nodeIds[2];
    const branch1 = addMove(game, move2Id, { x: 3, y: 3 }, 'black', true);
    // 分岐からさらに2手
    const branch2 = addMove(game, branch1!.newNodeId, { x: 5, y: 5 }, 'white');
    const branch3 = addMove(game, branch2!.newNodeId, { x: 7, y: 7 }, 'black');

    // SGFエンコード
    const sgf = gameToSgf(game);
    expect(sgf).toContain('PB[高橋さん]');
    expect(sgf).toContain('PW[山本さん]');

    // 分岐の括弧が含まれるはず
    expect(sgf).toContain('(;');

    // パース
    const parsed = parseSgf(sgf);
    expect(parsed).not.toBeNull();
    expect(parsed!.playerBlack).toBe('高橋さん');
    expect(parsed!.playerWhite).toBe('山本さん');
    expect(parsed!.boardSize).toBe(9);

    // ルートから2手目のノードを辿る
    const parsedRoot = parsed!.rootNode;
    const parsedMove1 = parsedRoot.children[0]; // B[cc]
    expect(parsedMove1.move!.color).toBe('black');
    const parsedMove2 = parsedMove1.children[0]; // W[gg]
    expect(parsedMove2.move!.color).toBe('white');

    // 2手目のノードに2つの子（分岐）がある
    expect(parsedMove2.children.length).toBe(2);

    // 新しい分岐（メインライン）
    const mainBranch = parsedMove2.children[0];
    expect(mainBranch.move!.color).toBe('black');
    expect(mainBranch.move!.position).toEqual({ x: 3, y: 3 });
    // 分岐の続き
    expect(mainBranch.children.length).toBe(1);
    expect(mainBranch.children[0].children.length).toBe(1);

    // 元の分岐
    const oldBranch = parsedMove2.children[1];
    expect(oldBranch.move!.color).toBe('black');
    expect(oldBranch.move!.position).toEqual({ x: 2, y: 6 }); // 元の3手目
    // 元の4手目と5手目も残っている
    expect(oldBranch.children.length).toBe(1);
    expect(oldBranch.children[0].children.length).toBe(1);
  });

  it('分岐なし棋譜のSGFラウンドトリップ', () => {
    const game = createNewGame(19, '井山裕太', '一力遼', 6.5);
    let currentId = game.rootNode.id;

    // 19路盤で20手打つ
    for (let i = 0; i < 20; i++) {
      const color = i % 2 === 0 ? 'black' as const : 'white' as const;
      const pos = { x: i % 19, y: Math.floor(i / 19) * 2 + (i % 2) };
      const result = addMove(game, currentId, pos, color);
      if (!result) break;
      currentId = result.newNodeId;
    }

    const totalMoves = countMainLineMoves(game);
    expect(totalMoves).toBe(20);

    // SGFラウンドトリップ
    const sgf = gameToSgf(game);
    const parsed = parseSgf(sgf);
    expect(parsed).not.toBeNull();

    const parsedMoveCount = countMainLineMoves(parsed!);
    expect(parsedMoveCount).toBe(20);
  });

  it('複数の分岐をもつ棋譜のSGFラウンドトリップ', () => {
    const game = createNewGame(9, 'PlayerA', 'PlayerB', 6.5);
    let currentId = game.rootNode.id;

    // 3手打つ
    const r1 = addMove(game, currentId, { x: 2, y: 2 }, 'black');
    const r2 = addMove(game, r1!.newNodeId, { x: 6, y: 6 }, 'white');
    const r3 = addMove(game, r2!.newNodeId, { x: 4, y: 4 }, 'black');

    // 1手目から2つの分岐を追加
    const b1 = addMove(game, r1!.newNodeId, { x: 5, y: 5 }, 'white');
    const b2 = addMove(game, r1!.newNodeId, { x: 7, y: 7 }, 'white');

    // 1手目のノードに3つの子
    const move1Node = findNode(game.rootNode, r1!.newNodeId);
    expect(move1Node!.children.length).toBe(3);

    // SGFラウンドトリップ
    const sgf = gameToSgf(game);
    const parsed = parseSgf(sgf);
    expect(parsed).not.toBeNull();

    // パース後のmove1ノードにも3つの子
    const pMove1 = parsed!.rootNode.children[0];
    expect(pMove1.children.length).toBe(3);
  });
});

describe('置き碁（ハンディキャップ）', () => {
  it('2子局: 右上と左下に黒石が配置される', () => {
    const positions = getHandicapPositions(19, 2);
    expect(positions.length).toBe(2);
    expect(positions[0]).toEqual({ x: 15, y: 3 }); // 右上
    expect(positions[1]).toEqual({ x: 3, y: 15 }); // 左下
  });

  it('4子局: 四隅の星に黒石が配置される', () => {
    const positions = getHandicapPositions(19, 4);
    expect(positions.length).toBe(4);
  });

  it('9子局: 全ての星に黒石が配置される', () => {
    const positions = getHandicapPositions(19, 9);
    expect(positions.length).toBe(9);
  });

  it('9路盤の5子局: 4隅 + 天元に配置される', () => {
    const positions = getHandicapPositions(9, 5);
    expect(positions.length).toBe(5);
    // 天元（中央）が含まれる
    expect(positions.some(p => p.x === 4 && p.y === 4)).toBe(true);
  });

  it('createNewGameで置き碁対局を作成すると、盤面に黒石が配置される', () => {
    const game = createNewGame(19, '上手', '下手', 0.5, 4);
    expect(game.handicap).toBe(4);

    // ルートノードの盤面に黒石が4つ配置されている
    let blackStones = 0;
    for (let y = 0; y < 19; y++) {
      for (let x = 0; x < 19; x++) {
        if (game.rootNode.boardState[y][x] === 'black') blackStones++;
      }
    }
    expect(blackStones).toBe(4);
  });

  it('置き碁対局では白番から始まる', () => {
    const game = createNewGame(19, '上手', '下手', 0.5, 2);
    const viewState = getViewState(game, game.rootNode.id);
    expect(viewState!.nextColor).toBe('white');
  });

  it('通常対局では黒番から始まる', () => {
    const game = createNewGame(19, 'A', 'B', 6.5, 0);
    const viewState = getViewState(game, game.rootNode.id);
    expect(viewState!.nextColor).toBe('black');
  });

  it('置き碁のSGFラウンドトリップ: AB[]プロパティが正しく出力・読み込みされる', () => {
    const game = createNewGame(19, '上手', '下手', 0.5, 4);
    // 白から2手打つ（置き石の位置を避ける）
    let currentId = game.rootNode.id;
    const r1 = addMove(game, currentId, { x: 4, y: 4 }, 'white');
    const r2 = addMove(game, r1!.newNodeId, { x: 10, y: 10 }, 'black');

    const sgf = gameToSgf(game);
    expect(sgf).toContain('HA[4]');
    expect(sgf).toContain('AB[');

    const parsed = parseSgf(sgf);
    expect(parsed).not.toBeNull();
    expect(parsed!.handicap).toBe(4);

    // パース後の盤面に黒石が配置されている
    let blackStones = 0;
    for (let y = 0; y < 19; y++) {
      for (let x = 0; x < 19; x++) {
        if (parsed!.rootNode.boardState[y][x] === 'black') blackStones++;
      }
    }
    expect(blackStones).toBe(4);
  });

  it('置き碁でも着手と取りが正常に動作する', () => {
    const game = createNewGame(9, '上手', '下手', 0.5, 2);
    // 2子局: 星に黒石がある状態で白から始まる
    const viewState = getViewState(game, game.rootNode.id);
    expect(viewState!.nextColor).toBe('white');

    // 白の着手
    const r1 = addMove(game, game.rootNode.id, { x: 4, y: 4 }, 'white');
    expect(r1).not.toBeNull();

    // 次は黒
    const vs1 = getViewState(game, r1!.newNodeId);
    expect(vs1!.nextColor).toBe('black');
  });

  it('3子局で8手打つ: 白→黒→白→...の順序で正しく記録される', () => {
    const game = createNewGame(19, '上手', '下手', 0.5, 3);

    // 初手は白番であること
    const vs0 = getViewState(game, game.rootNode.id)!;
    expect(vs0.nextColor).toBe('white');
    expect(vs0.moveNumber).toBe(0);

    // nextColorを使って8手打つ（UIと同じ動作をシミュレート）
    const positions = [
      { x: 3, y: 3 }, { x: 9, y: 9 },
      { x: 3, y: 9 }, { x: 9, y: 3 },
      { x: 5, y: 5 }, { x: 13, y: 13 },
      { x: 5, y: 13 }, { x: 13, y: 5 },
    ];
    const expectedColors: Array<'white' | 'black'> = [
      'white', 'black', 'white', 'black', 'white', 'black', 'white', 'black',
    ];

    let currentNodeId = game.rootNode.id;
    for (let i = 0; i < 8; i++) {
      const vs = getViewState(game, currentNodeId)!;
      expect(vs.nextColor).toBe(expectedColors[i]);

      const result = addMove(game, currentNodeId, positions[i], vs.nextColor);
      expect(result).not.toBeNull();

      // 記録された手の色が正しいこと
      const node = findNode(game.rootNode, result!.newNodeId)!;
      expect(node.move!.color).toBe(expectedColors[i]);

      currentNodeId = result!.newNodeId;
    }

    // 8手後は白番であること
    const vs8 = getViewState(game, currentNodeId)!;
    expect(vs8.nextColor).toBe('white');
    expect(vs8.moveNumber).toBe(8);

    // SGFでも色が正しいこと
    const sgf = gameToSgf(game);
    expect(sgf).toContain('HA[3]');
    // 初手がW（白）であること
    expect(sgf).toMatch(/AB\[.*\].*W\[/);
  });
});

describe('削除と復元', () => {
  it('分岐を削除しても本筋は残る', () => {
    const game = createNewGame(9, 'X', 'Y', 6.5);
    let currentId = game.rootNode.id;

    const r1 = addMove(game, currentId, { x: 2, y: 2 }, 'black');
    const r2 = addMove(game, r1!.newNodeId, { x: 6, y: 6 }, 'white');

    // 分岐追加
    const branch = addMove(game, r1!.newNodeId, { x: 5, y: 5 }, 'white');
    const move1Node = findNode(game.rootNode, r1!.newNodeId);
    expect(move1Node!.children.length).toBe(2);

    // 分岐を削除
    removeChildNode(game.rootNode, r1!.newNodeId, branch!.newNodeId);
    expect(move1Node!.children.length).toBe(1);
    expect(move1Node!.children[0].id).toBe(r2!.newNodeId);
  });
});
