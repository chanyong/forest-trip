// 즐겨찾기(내 휴양림): 이 브라우저(localStorage)에만 저장하고 서버로 보내지 않는다.
import { useCallback, useState } from 'react';

const KEY = 'favForests';
const read = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
};

export function useFavs() {
  const [favs, setFavs] = useState<Set<string>>(() => new Set(read()));
  const toggle = useCallback((id: string) => {
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(KEY, JSON.stringify([...next])); } catch { /* 저장 불가 환경(사생활 보호 모드 등) */ }
      return next;
    });
  }, []);
  return { favs, toggle };
}
