'use client';

import { getEpisodes } from '@/lib/TVfunctions';
import { saveWatchProgress } from '@/utils/ProgressHandler';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { toast } from 'react-toastify';

export const WatchAreaContext = createContext(null);

export function WatchAreaContextProvider({ children, MovieInfo, MovieId }) {
  const searchparam = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const episode = Math.max(1, parseInt(searchparam.get('ep'), 10) || 1);
  const seasonParam = parseInt(searchparam.get('se'), 10);
  const season = Number.isInteger(seasonParam) && seasonParam >= 0 ? seasonParam : 1;
  const [episodes, setEpisodes] = useState([]);
  const [episodeLoading, setEpisodeLoading] = useState(true);
  const [watchInfo, setWatchInfo] = useState({ loading: true });


  const selectEpisode = useCallback((nextEpisode, nextSeason = season) => {
    if (!Number.isInteger(nextEpisode) || nextEpisode < 1 ||
        !Number.isInteger(nextSeason) || nextSeason < 0) return;

    const updatedParams = new URLSearchParams(searchparam.toString());
    updatedParams.set('se', String(nextSeason));
    updatedParams.set('ep', String(nextEpisode));
    // usePathname excludes Next's /tv basePath; the router adds it once.
    router.push(`${pathname}?${updatedParams.toString()}`, { scroll: false });
  }, [pathname, router, searchparam, season]);


  // ---------------- FETCH EPISODES ----------------
  useEffect(() => {
    if (!MovieInfo) return;
    let cancelled = false;

    setEpisodeLoading(true);
    setEpisodes([]);

    if (MovieInfo.type !== 'tv') {
      const movieEpisode = [{
        episode_number: 1,
        name: MovieInfo.title,
        overview: MovieInfo.overview,
        runtime: MovieInfo.runtime || 90,
        season_number: 1,
        still_path: MovieInfo.backdrop_path,
      }];

      setEpisodes(movieEpisode);
      setEpisodeLoading(false);
      return;
    }

    const fetchEpisodes = async () => {
      try {
        const data = await getEpisodes(MovieId, season);
        if (cancelled) return;
        if (!data?.episodes?.length) {
          toast('No episodes found');
          setEpisodes([]);
        } else {
          setEpisodes(data.episodes);
        }
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        toast('Failed to fetch episodes');
      } finally {
        if (!cancelled) setEpisodeLoading(false);
      }
    };

    fetchEpisodes();
    return () => { cancelled = true; };
  }, [MovieInfo, MovieId, season]);


  // ---------------- SAVE PROGRESS ----------------
  useEffect(() => {
    if (!episodeLoading && episodes.some(item =>
      item.episode_number === episode && item.season_number === season
    ) && MovieInfo) {
      saveWatchProgress(MovieInfo, episodes, episode, season);
    }
  }, [episode, season, episodes, MovieInfo, episodeLoading]);

  // ---------------- CONTEXT VALUE ----------------
  const contextValue = useMemo(() => ({
    episode,
    selectEpisode,
    season,
    episodes,
    watchInfo,
    setWatchInfo,
    episodeLoading,
    MovieInfo,
    MovieId,
  }), [
    episode,
    season,
    selectEpisode,
    episodes,
    watchInfo,
    episodeLoading,
    MovieInfo,
    MovieId,
  ]);

  return (
    <WatchAreaContext.Provider value={contextValue}>
      {children}
    </WatchAreaContext.Provider>
  );
}

export function useWatchContext() {
  const ctx = useContext(WatchAreaContext);
  if (!ctx) throw new Error('useWatchContext must be used inside WatchAreaContextProvider');
  return ctx;
}
