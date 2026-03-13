'use client';

import { useCallback, useReducer } from 'react';
import { BoardSize, GameRecord, GameViewState, Position, StoneColor } from '@/types/go';
import { createNewGame, addMove, getViewState, findNode, addVariation, removeChildNode, getPathToNode } from './game-tree';
import { oppositeColor } from './rules';

interface GameState {
  game: GameRecord;
  viewState: GameViewState;
  history: string[]; // undo用にノードIDの履歴を保持
}

type GameAction =
  | { type: 'PLACE_STONE'; position: Position }
  | { type: 'PASS' }
  | { type: 'UNDO' }
  | { type: 'NAVIGATE_TO'; nodeId: string }
  | { type: 'GO_FIRST' }
  | { type: 'GO_LAST' }
  | { type: 'GO_NEXT' }
  | { type: 'GO_PREVIOUS' }
  | { type: 'SELECT_BRANCH'; branchIndex: number }
  | { type: 'DELETE_BRANCH'; nodeId: string }
  | { type: 'ADD_VARIATION'; position: Position; comment?: string }
  | { type: 'LOAD_GAME'; game: GameRecord }
  | { type: 'NEW_GAME'; boardSize: BoardSize; playerBlack: string; playerWhite: string; komi: number; handicap: number }
  | { type: 'UPDATE_METADATA'; playerBlack?: string; playerWhite?: string; result?: string };

function createInitialState(
  boardSize: BoardSize = 19,
  playerBlack = '',
  playerWhite = '',
  komi = 6.5,
  handicap = 0
): GameState {
  const game = createNewGame(boardSize, playerBlack, playerWhite, komi, handicap);
  const viewState = getViewState(game, game.rootNode.id)!;
  return { game, viewState, history: [game.rootNode.id] };
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'PLACE_STONE': {
      // 同じ位置の既存の子がある場合はそこへ移動（重複防止）
      const currentNodeForPlace = findNode(state.game.rootNode, state.viewState.currentNodeId);
      if (currentNodeForPlace) {
        const existing = currentNodeForPlace.children.find(
          c => c.move?.position?.x === action.position.x && c.move?.position?.y === action.position.y
        );
        if (existing) {
          const existingView = getViewState(state.game, existing.id);
          if (existingView) {
            return { ...state, viewState: existingView, history: [...state.history, existing.id] };
          }
        }
      }

      const result = addMove(
        state.game,
        state.viewState.currentNodeId,
        action.position,
        state.viewState.nextColor,
        true // 新しい手をメインラインとして挿入
      );
      if (!result) return state; // 着手禁止

      const newViewState = getViewState(result.game, result.newNodeId);
      if (!newViewState) return state;

      return {
        game: result.game,
        viewState: newViewState,
        history: [...state.history, result.newNodeId],
      };
    }

    case 'PASS': {
      const result = addMove(
        state.game,
        state.viewState.currentNodeId,
        null,
        state.viewState.nextColor,
        true // メインラインとして挿入
      );
      if (!result) return state;

      const newViewState = getViewState(result.game, result.newNodeId);
      if (!newViewState) return state;

      return {
        game: result.game,
        viewState: newViewState,
        history: [...state.history, result.newNodeId],
      };
    }

    case 'UNDO': {
      if (state.viewState.currentPath.length <= 1) return state;
      const parentId = state.viewState.currentPath[state.viewState.currentPath.length - 2];
      const newViewState = getViewState(state.game, parentId);
      if (!newViewState) return state;
      return { ...state, viewState: newViewState, history: [...state.history, parentId] };
    }

    case 'NAVIGATE_TO': {
      const newViewState = getViewState(state.game, action.nodeId);
      if (!newViewState) return state;
      return { ...state, viewState: newViewState, history: [...state.history, action.nodeId] };
    }

    case 'GO_FIRST': {
      const rootId = state.game.rootNode.id;
      const newViewState = getViewState(state.game, rootId);
      if (!newViewState) return state;
      return { ...state, viewState: newViewState, history: [rootId] };
    }

    case 'GO_LAST': {
      // 本筋（最初の子）をたどって最後まで進む
      let currentNode = findNode(state.game.rootNode, state.viewState.currentNodeId);
      const path = [...state.history];
      while (currentNode && currentNode.children.length > 0) {
        currentNode = currentNode.children[0];
        path.push(currentNode.id);
      }
      if (!currentNode) return state;
      const newViewState = getViewState(state.game, currentNode.id);
      if (!newViewState) return state;
      return { ...state, viewState: newViewState, history: path };
    }

    case 'GO_NEXT': {
      const currentNode = findNode(state.game.rootNode, state.viewState.currentNodeId);
      if (!currentNode || currentNode.children.length === 0) return state;
      const nextId = currentNode.children[0].id;
      const newViewState = getViewState(state.game, nextId);
      if (!newViewState) return state;
      return { ...state, viewState: newViewState, history: [...state.history, nextId] };
    }

    case 'GO_PREVIOUS': {
      if (state.viewState.currentPath.length <= 1) return state;
      const parentId = state.viewState.currentPath[state.viewState.currentPath.length - 2];
      const newViewState = getViewState(state.game, parentId);
      if (!newViewState) return state;
      return { ...state, viewState: newViewState, history: [...state.history, parentId] };
    }

    case 'SELECT_BRANCH': {
      const branchParent = findNode(state.game.rootNode, state.viewState.currentNodeId);
      if (!branchParent || action.branchIndex >= branchParent.children.length) return state;
      const selectedChild = branchParent.children[action.branchIndex];
      const newViewState = getViewState(state.game, selectedChild.id);
      if (!newViewState) return state;
      return { ...state, viewState: newViewState, history: [...state.history, selectedChild.id] };
    }

    case 'DELETE_BRANCH': {
      // 指定ノードの親を見つけて、そのノードを削除
      const pathToDel = getPathToNode(state.game.rootNode, action.nodeId);
      if (!pathToDel || pathToDel.length < 2) return state;
      const delParentId = pathToDel[pathToDel.length - 2];
      removeChildNode(state.game.rootNode, delParentId, action.nodeId);

      // 現在表示中のノードが削除された分岐内の場合は親に戻る
      const currentPath = getPathToNode(state.game.rootNode, state.viewState.currentNodeId);
      if (!currentPath) {
        const parentView = getViewState(state.game, delParentId);
        if (!parentView) return state;
        return { ...state, viewState: parentView, history: [...state.history, delParentId] };
      }
      return state;
    }

    case 'ADD_VARIATION': {
      // 現在のノードの親に対して別の手を追加
      if (state.viewState.currentPath.length < 2) return state;
      const parentId = state.viewState.currentPath[state.viewState.currentPath.length - 2];

      // 現在のノードの手番と同じ色
      const currentNode = findNode(state.game.rootNode, state.viewState.currentNodeId);
      const color = currentNode?.move?.color || state.viewState.nextColor;

      const result = addVariation(
        state.game,
        parentId,
        action.position,
        color,
        action.comment
      );
      if (!result) return state;

      const newViewState = getViewState(result.game, result.newNodeId);
      if (!newViewState) return state;

      return {
        game: result.game,
        viewState: newViewState,
        history: [...state.history, result.newNodeId],
      };
    }

    case 'LOAD_GAME': {
      const viewState = getViewState(action.game, action.game.rootNode.id);
      if (!viewState) return state;
      return { game: action.game, viewState, history: [action.game.rootNode.id] };
    }

    case 'NEW_GAME': {
      return createInitialState(action.boardSize, action.playerBlack, action.playerWhite, action.komi, action.handicap);
    }

    case 'UPDATE_METADATA': {
      const newGame = { ...state.game };
      if (action.playerBlack !== undefined) newGame.playerBlack = action.playerBlack;
      if (action.playerWhite !== undefined) newGame.playerWhite = action.playerWhite;
      if (action.result !== undefined) newGame.result = action.result;
      return { ...state, game: newGame };
    }

    default:
      return state;
  }
}

export function useGameState(
  initialBoardSize: BoardSize = 19,
  initialPlayerBlack = '',
  initialPlayerWhite = '',
  initialKomi = 6.5
) {
  const [state, dispatch] = useReducer(
    gameReducer,
    createInitialState(initialBoardSize, initialPlayerBlack, initialPlayerWhite, initialKomi)
  );

  const placeStone = useCallback((pos: Position) => {
    dispatch({ type: 'PLACE_STONE', position: pos });
  }, []);

  const pass = useCallback(() => {
    dispatch({ type: 'PASS' });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const goFirst = useCallback(() => {
    dispatch({ type: 'GO_FIRST' });
  }, []);

  const goLast = useCallback(() => {
    dispatch({ type: 'GO_LAST' });
  }, []);

  const goNext = useCallback(() => {
    dispatch({ type: 'GO_NEXT' });
  }, []);

  const goPrevious = useCallback(() => {
    dispatch({ type: 'GO_PREVIOUS' });
  }, []);

  const navigateTo = useCallback((nodeId: string) => {
    dispatch({ type: 'NAVIGATE_TO', nodeId });
  }, []);

  const selectBranch = useCallback((branchIndex: number) => {
    dispatch({ type: 'SELECT_BRANCH', branchIndex });
  }, []);

  const deleteBranch = useCallback((nodeId: string) => {
    dispatch({ type: 'DELETE_BRANCH', nodeId });
  }, []);

  const addVariationMove = useCallback((pos: Position, comment?: string) => {
    dispatch({ type: 'ADD_VARIATION', position: pos, comment });
  }, []);

  const loadGame = useCallback((game: GameRecord) => {
    dispatch({ type: 'LOAD_GAME', game });
  }, []);

  const newGame = useCallback(
    (boardSize: BoardSize, playerBlack: string, playerWhite: string, komi: number, handicap = 0) => {
      dispatch({ type: 'NEW_GAME', boardSize, playerBlack, playerWhite, komi, handicap });
    },
    []
  );

  const updateMetadata = useCallback(
    (meta: { playerBlack?: string; playerWhite?: string; result?: string }) => {
      dispatch({ type: 'UPDATE_METADATA', ...meta });
    },
    []
  );

  const currentNode = findNode(state.game.rootNode, state.viewState.currentNodeId);

  return {
    game: state.game,
    viewState: state.viewState,
    currentNode,
    placeStone,
    pass,
    undo,
    goFirst,
    goLast,
    goNext,
    goPrevious,
    navigateTo,
    selectBranch,
    deleteBranch,
    addVariationMove,
    loadGame,
    newGame,
    updateMetadata,
  };
}
