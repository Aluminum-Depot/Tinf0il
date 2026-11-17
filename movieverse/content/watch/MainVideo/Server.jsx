"use client";

import React, { useEffect, useMemo } from "react";
import { useWatchContext } from "@/context/Watch";


const Server = () => {
  const { MovieId, setWatchInfo, watchInfo, MovieInfo, episode, episodes, season } =
    useWatchContext();

  const MovieVideoPlayers = useMemo(
    () => ({
      Quantum: `https://vidlink.pro/movie/${MovieId}?player=jw`,
      Nova: `https://vidfast.pro/movie/${MovieId}?autoPlay=true`,
      Movio: `https://vidsrc.cc/v2/embed/movie/${MovieId}?autoPlay=true`,
      Turbo: `https://vidsrc.icu/embed/movie/${MovieId}?autoPlay=true`,
      Astro: `https://hexa.su/watch/movie/${MovieId}?autoPlay=true`,
    }),
    [MovieId]
  );

  const TVVideoPlayers = useMemo(
    () => ({
      Quantum: `https://vidlink.pro/tv/${MovieId}/${season}/${episode}?player=jw`,
      Nova: `https://vidfast.pro/tv/${MovieId}/${season}/${episode}?autoPlay=true`,
      Movio: `https://vidsrc.cc/v2/embed/tv/${MovieId}/${season}/${episode}?autoPlay=true`,
      Turbo: `https://vidsrc.icu/embed/tv/${MovieId}/${season}/${episode}?autoPlay=true`,
      Astro: `https://hexa.su/watch/tv/${MovieId}/${season}/${episode}?autoPlay=true`,
    }),
    [MovieId, season, episode]
  );

  const servers = useMemo(() => {
    const data = MovieInfo?.type === "tv" ? TVVideoPlayers : MovieVideoPlayers;
    return Object.entries(data); // [ ["Nova", url], ... ]
  }, [MovieInfo?.type, MovieVideoPlayers, TVVideoPlayers]);

  // ✅ when user clicks server → save globally
  const changeServer = (item) => {
    const serverName = item[0];

    const updated = {
      ...watchInfo,
      url: item[1],
      iframe: true,
      loading: false,
      serverName,
    };

    setWatchInfo(updated);
    localStorage.setItem("preferredServer", serverName);
  };



  // ✅ load preferred server when episode changes
  useEffect(() => {
    if (!servers.length) return;

    const preferredServer = localStorage.getItem("preferredServer");
    const watchdata = episodes.find(ep => ep.episode_number === episode);

    let selected;

    if (preferredServer) {
      selected = servers.find(([name]) => name === preferredServer);
    }

    // fallback to first server
    if (!selected) {
      selected = servers[1];
    }

    const defaultWatchInfo = {
      url: selected[1],
      iframe: true,
      loading: false,
      serverName: selected[0],
    };


    setWatchInfo(prev => ({ ...prev, ...defaultWatchInfo, watchdata }));
  }, [episode, episodes, servers, setWatchInfo]);

  return (
    <div className="w-full flex flex-col gap-1">
      <div className="bg-[#323044] h-full w-full px-4 flex items-center gap-8 max-[880px]:py-2 max-[515px]:flex-col max-[515px]:gap-5">
        <div>Server</div>

        <div className="flex gap-2 flex-wrap max-[515px]:justify-center">
          {servers.map((item) => (
            <div
              key={item[0]}
              onClick={() => changeServer(item)}
              style={{
                background:
                  watchInfo?.serverName === item[0] ? "#4a446c" : undefined,
              }}
              className="px-4 py-[6px] text-[15px] bg-[#413d57] hover:bg-[#4a446c] border border-[#5b5682] rounded-md cursor-pointer"
            >
              {item[0]}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#2a2838] px-4 py-2 flex items-center gap-2 text-amber-400/80 text-xs">
        <span>⚠</span>
        <span>Some servers may show popup ads upon clicking. Close any that open — they don't affect playback.</span>
      </div>
    </div>
  );
};

export default Server;
