import { useCallback, useLayoutEffect, useRef, useState, type Key, type ReactNode } from "react";

type VirtualMessageListProps<T> = {
  items: readonly T[];
  itemKey: (item: T, index: number) => Key;
  renderItem: (item: T, index: number) => ReactNode;
  followLatest?: boolean;
};

const ESTIMATED_ITEM_HEIGHT = 120;
const OVERSCAN_PX = 720;

export function VirtualMessageList<T>({ items, itemKey, renderItem, followLatest = false }: VirtualMessageListProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(720);
  const [heights, setHeights] = useState<Map<Key, number>>(() => new Map());
  const nearBottomRef = useRef(true);
  const recordHeight = useCallback((key: Key, height: number) => {
    setHeights((current) => current.get(key) === height ? current : new Map(current).set(key, height));
  }, []);

  const offsets: number[] = [];
  let totalHeight = 0;
  for (let index = 0; index < items.length; index += 1) {
    offsets.push(totalHeight);
    totalHeight += heights.get(itemKey(items[index], index)) ?? ESTIMATED_ITEM_HEIGHT;
  }

  const startBoundary = Math.max(0, scrollTop - OVERSCAN_PX);
  const endBoundary = scrollTop + viewportHeight + OVERSCAN_PX;
  let startIndex = 0;
  while (startIndex < items.length && offsets[startIndex] + (heights.get(itemKey(items[startIndex], startIndex)) ?? ESTIMATED_ITEM_HEIGHT) < startBoundary) startIndex += 1;
  let endIndex = startIndex;
  while (endIndex < items.length && offsets[endIndex] < endBoundary) endIndex += 1;

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const updateViewport = () => setViewportHeight(list.clientHeight || 720);
    updateViewport();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateViewport);
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (followLatest && nearBottomRef.current && list) list.scrollTop = list.scrollHeight;
  }, [followLatest, items, totalHeight]);

  return <div ref={listRef} className="messages virtual-messages" role="log" aria-live="polite" onScroll={(event) => {
    const { scrollHeight, scrollTop: nextScrollTop, clientHeight } = event.currentTarget;
    nearBottomRef.current = scrollHeight - nextScrollTop - clientHeight < 120;
    setScrollTop(nextScrollTop);
  }}>
    <div aria-hidden="true" style={{ height: offsets[startIndex] ?? 0 }} />
    {items.slice(startIndex, endIndex).map((item, offset) => {
      const index = startIndex + offset;
      const key = itemKey(item, index);
      return <MeasuredRow key={key} rowKey={key} onHeight={recordHeight}>{renderItem(item, index)}</MeasuredRow>;
    })}
    <div aria-hidden="true" style={{ height: Math.max(0, totalHeight - (offsets[endIndex] ?? totalHeight)) }} />
  </div>;
}

function MeasuredRow({ children, rowKey, onHeight }: { children: ReactNode; rowKey: Key; onHeight: (key: Key, height: number) => void }) {
  const rowRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => {
      const height = row.getBoundingClientRect().height;
      if (height > 0) onHeight(rowKey, height);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [onHeight, rowKey]);

  return <div ref={rowRef} className="virtual-message-row">{children}</div>;
}
