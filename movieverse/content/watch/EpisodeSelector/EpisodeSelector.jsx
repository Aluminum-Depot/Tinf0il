"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { HiOutlineBars3 } from "react-icons/hi2";
import { motion, AnimatePresence } from "framer-motion";
import Select from "@/components/ui/Select";
import EpisodeCard from "./EpisodeCard";
import { useWatchContext } from "@/context/Watch";
import { useWatchSettingContext } from "@/context/WatchSetting";
import clsx from "clsx";

const EpisodeSelector = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [watchedEP, setWatchedEP] = useState([]);
  const { watchSetting } = useWatchSettingContext()

  const {
    episode,
    episodes,
    MovieId,
    MovieInfo,
    selectEpisode,
    season,
    episodeLoading,
  } = useWatchContext();

  const storageKey =
    MovieId && season >= 0 ? `playing.${MovieId}.season.${season}` : null;

  // ✅ Load watched episodes
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;

    try {
      const stored = JSON.parse(localStorage.getItem(storageKey)) || [];
      setWatchedEP(stored);
    } catch {
      setWatchedEP([]);
    }
  }, [storageKey]);

  // ✅ Track watched episode
  useEffect(() => {
    if (!storageKey || !episode || typeof window === "undefined") return;

    const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");

    if (!stored.includes(episode)) {
      const updated = [...stored, episode];
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setWatchedEP(updated);
    } else {
      setWatchedEP(stored);
    }
  }, [storageKey, episode]);

  // ✅ Search handler
  const handleSearchQueryChange = useCallback((e) => {
    setSearchQuery(e.target.value.toLowerCase());
  }, []);

  // ✅ Season dropdown data
  const seasonData = useMemo(() => {
    if (!MovieInfo?.seasons) return [];
    return MovieInfo.seasons.map(item => item.name || `Season ${item.season_number}`);
  }, [MovieInfo]);

  const selectedSeasonIndex = MovieInfo?.seasons?.findIndex(item => item.season_number === season) ?? -1;

  // ✅ Filter episodes safely
  const filteredEpisodes = useMemo(() => {
    if (!episodes) return [];

    if (!searchQuery) return episodes;

    return episodes.filter((item) => {
      const epNum = String(item.episode_number);
      const name = item?.name?.toLowerCase() || "";

      return (
        epNum.includes(searchQuery) ||
        name.includes(searchQuery) ||
        `episode ${epNum}`.includes(searchQuery)
      );
    });
  }, [episodes, searchQuery]);

  return (
    <div className={clsx("bg-[#201f28] w-full max-w-[22rem] min-w-[18rem] rounded-md flex flex-col", {
      "max-w-full": watchSetting.isExpanded
    })}>

      {/* HEADER */}
      <div>
        <div className="flex justify-between px-2 py-3 border-b-2 border-[#514f61a1]">
          <input
            type="text"
            placeholder="Ep Number"
            className="bg-[#2e2b3d] outline-none h-10 w-full px-2 text-slate-200 max-w-[13rem] rounded-md"
            value={searchQuery}
            onChange={handleSearchQueryChange}
          />

          <div className="bg-[#2e2b3d] text-white w-10 rounded-lg flex items-center justify-center text-2xl">
            <HiOutlineBars3 />
          </div>
        </div>

        {/* SELECT */}
        <div className="flex justify-between px-2 py-3 gap-4">
          {MovieInfo?.type === "tv" && (
            <Select
              data={seasonData}
              selectedIndex={selectedSeasonIndex}
              setSelected={(val) => {
                const newSeason = MovieInfo.seasons[val.id]?.season_number;
                if (newSeason !== season) {
                  setSearchQuery("");
                  selectEpisode(1, newSeason);
                }
              }}
            />
          )}
        </div>
      </div>

      {/* EPISODES LIST */}
      <div className="px-2 overflow-y-scroll h-full max-h-[44rem]">
        <AnimatePresence>
          {!episodeLoading ? (
            <motion.div
              key={`${season}-${searchQuery}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              {filteredEpisodes.map((item) => (
                <EpisodeCard
                  key={item.id || item.episode_number}
                  info={item}
                  currentEp={episode}
                  currentSn={season}
                  watchedEP={watchedEP}
                  posterImg={MovieInfo?.poster_path}
                />
              ))}
            </motion.div>
          ) : (
            Array.from({ length: 7 }).map((_, index) => (
              <EpisodeCard key={index} loading />
            ))
          )}
        </AnimatePresence>

        {!episodeLoading && filteredEpisodes.length === 0 && (
          <p className="text-[#d5d5d7] text-center my-5">
            No episodes found
          </p>
        )}
      </div>
    </div>
  );
};

export default EpisodeSelector;
