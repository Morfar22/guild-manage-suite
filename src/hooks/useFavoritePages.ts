import { useState, useCallback } from 'react';

const STORAGE_KEY = 'dashboard-favorite-pages';

export function useFavoritePages() {
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const toggleFavorite = useCallback((path: string) => {
    setFavorites((prev) => {
      const next = prev.includes(path)
        ? prev.filter((p) => p !== path)
        : [...prev, path];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (path: string) => favorites.includes(path),
    [favorites]
  );

  return { favorites, toggleFavorite, isFavorite };
}
