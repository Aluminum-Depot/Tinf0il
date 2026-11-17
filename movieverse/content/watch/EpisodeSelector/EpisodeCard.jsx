import { useCallback, useEffect, useMemo, useState } from "react";
import { useWatchContext } from "@/context/Watch";
import clsx from "clsx";
import Image from "next/image";

const EpisodeCard = ({
  info,
  currentEp,
  loading,
  watchedEP,
  posterImg,
  currentSn,
}) => {
  const { season, selectEpisode } = useWatchContext();

  const [errorLoadingImage, setErrorLoadingImage] = useState(false);

  useEffect(() => {
    setErrorLoadingImage(false);
  }, [season]);

  const episodeNumber = info?.episode_number;
  const seasonNumber = info?.season_number;

  const handleClick = useCallback(() => {
    selectEpisode(episodeNumber, seasonNumber);
  }, [episodeNumber, seasonNumber, selectEpisode]);

  const isCurrentEpisode = useMemo(
    () => (currentEp === episodeNumber) && currentSn === seasonNumber,
    [currentEp, episodeNumber, currentSn, seasonNumber]
  );

  const isWatched = useMemo(
    () => watchedEP?.includes(episodeNumber),
    [watchedEP, episodeNumber]
  );

  if (loading) {
    return (
      <div className="flex py-2 h-[96px] my-[3px] border-2 border-[#21232e] rounded-md bg-[#242430] cursor-pointer group relative">
        <div className="absolute bottom-1/2 translate-y-1/2 flex gap-3 w-full">
          <div className="h-[80px] min-w-[150px] bg-[#48455f] rounded-md"></div>
          <div className="w-full flex flex-col gap-3">
            <div className="h-4 w-full bg-[#48465e] rounded-sm"></div>
            <div className="h-6 w-full bg-[#48465e] rounded-sm"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={`Play season ${seasonNumber}, episode ${episodeNumber}: ${info?.name || "Untitled"}`}
      aria-current={isCurrentEpisode ? "true" : undefined}
      className={clsx(
        "flex w-full text-left gap-3 py-2 border-2 border-[#21232e] rounded-md cursor-pointer group",
        {
          "bg-[#333345]": isCurrentEpisode,
          "bg-[#1f1f28]": !isCurrentEpisode && !isWatched,
          "bg-[#2a2a38] hover:bg-[#1c1c26]": isWatched,
          "hover:bg-[#242430]": !isCurrentEpisode,
        }
      )}
      onClick={handleClick}
    >
      <div className="w-full max-w-[150px] relative">
        <Image
          src={`https://image.tmdb.org/t/p/w250_and_h141_bestv2${!errorLoadingImage ? info?.still_path : posterImg
            }`}
          alt={`Episode ${episodeNumber}`}
          width={150}
          height={100}
          onError={() => setErrorLoadingImage(true)}
          className="object-cover w-full h-[82px] rounded-md"
        />

        <div className="text-[#ffffffe0] absolute bottom-1 right-1 bg-[#262233d4] px-1 rounded-lg text-[15px]">
          {info?.runtime || 24}m
        </div>
      </div>

      <div className="w-full pr-1">
        <div className="text-slate-200 line-clamp-2 text-sm">
          {info?.name || "No title available"}
        </div>
        <div className="text-[#ffffffa3] text-[14px]">
          Season {seasonNumber} · Episode {episodeNumber}
        </div>
      </div>
    </button>
  );
};

export default EpisodeCard;
