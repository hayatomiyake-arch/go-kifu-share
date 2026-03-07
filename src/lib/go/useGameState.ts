'use client';

import { useCallback, useReducer } from 'react';
import { BoardSize, GameRecord, GameViewState, Position, StoneColor } from '@/types/go';
import { createNewGame, addMove, getViewState, findNode, addVariation, removeChildNode } from './game-tree';
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
  | { type: 'ADD_VARIATION'; position: Position; comment?: string }
  | { type: 'LOAD_GAME'; game: GameRecord }
  | { type: 'NEW_GAME'; boardSize: BoardSize; playerBlack: string; playerWhite: string; komi: number }
  | { type: 'UPDATE_METADATA'; playerBlack?: string; playerWhite?: string; result?: string };

function createInitialState(
  boardSize: BoardSize = 19,
  playerBlack = '',
  playerWhite = '',
  komi = 6.5
): GameState {
  const game = createNewGame(boardSize, playerBlack, playerWhite, komi);
  const viewState = getViewState(game, game.rootNode.id)!;
  return { game, viewState, history: [game.rootNode.id] };
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'PLACE_STONE': {
      // 記録モード: 現在ノードの既存の子を全削除（上書き記録）
      const currentNodeForPlace = findNode(state.game.rootNode, state.viewState.currentNodeId);
      if (currentNodeForPlace) {
        currentNodeForPlace.children = [];
      }

      const result = addMove(
        state.game,
        state.viewState.currentNodeId,
        action.position,
        state.viewState.nextColor,
        false // 子はクリア済みなのでメインライン指定不要
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
      // 記録モード: 現在ノードの既存の子を全削除（上書き記録）
      const currentNodeForPass = findNode(state.game.rootNode, state.viewState.currentNodeId);
      if (currentNodeForPass) {
        currentNodeForPass.children = [];
      }

      const result = addMove(
        state.game,
        state.viewState.currentNodeId,
        null,
        state.viewState.nextColor,
        false
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
      const currentId = state.viewState.currentNodeId;
      const parentId = state.viewState.currentPath[state.viewState.currentPath.length - 2];

      // ツリーから現在のノードを削除（真のやり直し）
      removeChildNode(state.game.rootNode, parentId, currentId);

      const newViewState = getViewState(state.game, parentId);
      if (!newViewState) return state;

      // history からも現在ノードを除外
      const newHistory = state.history.filter(id => id !== currentId);
      if (newHistory.length === 0) newHistory.push(state.game.rootNode.id);

      return { ...state, viewState: newViewState, history: newHistory };
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
      return createInitialState(action.boardSize, action.playerBlack, action.playerWhite, action.komi);
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

  const addVariationMove = useCallback((pos: Position, comment?: string) => {
    dispatch({ type: 'ADD_VARIATION', position: pos, comment });
  }, []);

  const loadGame = useCallback((game: GameRecord) => {
    dispatch({ type: 'LOAD_GAME', game });
  }, []);

  const newGame = useCallback(
    (boardSize: BoardSize, playerBlack: string, playerWhite: string, komi: number) => {
      dispatch({ type: 'NEW_GAME', boardSize, playerBlack, playerWhite, komi });
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
    addVariationMove,
    loadGame,
    newGame,
    updateMetadata,
  };
}
