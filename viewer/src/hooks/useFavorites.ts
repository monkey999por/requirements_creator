import { useCallback, useEffect, useState } from "react";
import { addFavorite, type FavoriteItem, fetchFavorites, removeFavorite } from "../api";

export function useFavorites(appName: string) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    fetchFavorites().then(setFavorites);
  }, []);

  const isFavorited = useCallback(
    (type: FavoriteItem["type"], featureId?: string, diagramId?: string) => {
      return favorites.some(
        (f) =>
          f.appName === appName &&
          f.type === type &&
          f.featureId === featureId &&
          f.diagramId === diagramId,
      );
    },
    [appName, favorites],
  );

  const toggleFavorite = useCallback(
    async (type: FavoriteItem["type"], title?: string, featureId?: string, diagramId?: string) => {
      const item: FavoriteItem = { appName, type, featureId, diagramId, title };
      if (isFavorited(type, featureId, diagramId)) {
        await removeFavorite(item);
        setFavorites((prev) =>
          prev.filter(
            (f) =>
              !(
                f.appName === appName &&
                f.type === type &&
                f.featureId === featureId &&
                f.diagramId === diagramId
              ),
          ),
        );
      } else {
        await addFavorite(item);
        setFavorites((prev) => [...prev, item]);
      }
    },
    [appName, isFavorited],
  );

  return { favorites, isFavorited, toggleFavorite };
}
