import { useEffect, useState } from 'react';

/**
 * Ref-counted ObjectURL cache. Every URL created from an IndexedDB blob is revoked
 * as soon as the last component using it unmounts (no memory leaks), while
 * re-renders caused by Dexie live queries don't recreate URLs (no flicker).
 */
const cache = new Map<string, { url: string; refs: number }>();
const blobIds = new WeakMap<Blob, number>();
let nextBlobId = 1;

function blobKey(blob: Blob): string {
  let id = blobIds.get(blob);
  if (id === undefined) {
    id = nextBlobId++;
    blobIds.set(blob, id);
  }
  return `blob:${id}`;
}

function acquire(key: string, blob: Blob): string {
  const hit = cache.get(key);
  if (hit) {
    hit.refs++;
    return hit.url;
  }
  const url = URL.createObjectURL(blob);
  cache.set(key, { url, refs: 1 });
  return url;
}

function release(key: string): void {
  const hit = cache.get(key);
  if (!hit) return;
  hit.refs--;
  if (hit.refs <= 0) {
    URL.revokeObjectURL(hit.url);
    cache.delete(key);
  }
}

/**
 * @param blob  image blob from IndexedDB
 * @param stableKey optional identity (e.g. `item-12-34567`) so new Blob instances
 *                  for the same stored image reuse one URL
 */
export function useObjectUrl(blob: Blob | undefined, stableKey?: string): string | undefined {
  const [url, setUrl] = useState<string>();
  const key = blob ? (stableKey ?? blobKey(blob)) : undefined;

  useEffect(() => {
    if (!blob || !key) {
      setUrl(undefined);
      return;
    }
    setUrl(acquire(key, blob));
    return () => release(key);
    // `blob` intentionally omitted: identity is captured by `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return url;
}

export function itemImageKey(item: { id?: number; createdAt: number; imageBlob: Blob }): string {
  return `item-${item.id ?? 'new'}-${item.createdAt}-${item.imageBlob.size}`;
}
