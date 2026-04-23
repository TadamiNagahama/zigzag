import { useState, useCallback } from 'react';

export function useUndoRedo<T>(initialState: T) {
  const [history, setHistory] = useState<{
    past: T[],
    present: T,
    future: T[]
  }>({
    past: [],
    present: initialState,
    future: []
  });

  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, prev.past.length - 1);
      return {
        past: newPast,
        present: previous,
        future: [prev.present, ...prev.future]
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory(prev => {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      const newFuture = prev.future.slice(1);
      return {
        past: [...prev.past, prev.present],
        present: next,
        future: newFuture
      };
    });
  }, []);

  // 新しい状態を保存するための汎用的な関数
  const push = useCallback((action: T | ((prev: T) => T)) => {
    setHistory(prev => {
      const newPresent = typeof action === 'function' 
        ? (action as (p: T) => T)(prev.present) 
        : action;
      
      if (JSON.stringify(newPresent) === JSON.stringify(prev.present)) return prev;

      return {
        past: [...prev.past, prev.present].slice(-100),
        present: newPresent,
        future: []
      };
    });
  }, []);

  const setState = useCallback((action: T | ((prev: T) => T)) => {
    setHistory(prev => {
      const newPresent = typeof action === 'function' ? (action as (p: T) => T)(prev.present) : action;
      return {
        ...prev,
        present: newPresent
      };
    });
  }, []);

  const reset = useCallback((newState: T) => {
    setHistory({
      past: [],
      present: newState,
      future: []
    });
  }, []);

  return {
    state: history.present,
    setState, // 通常の更新（履歴に残さない場合用）
    push,
    reset,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0
  };
}
