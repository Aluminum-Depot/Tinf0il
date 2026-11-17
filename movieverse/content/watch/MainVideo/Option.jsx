import { LuExpand } from "react-icons/lu";
import { FaForward, FaLightbulb, FaShareNodes } from "react-icons/fa6";
import { FaBackward } from "react-icons/fa";
import { useWatchSettingContext } from "@/context/WatchSetting";
import { useWatchContext } from "@/context/Watch";
import { BiCollapse } from "react-icons/bi";
import AddToList from "@/components/AddToList";
import { useUserInfoContext } from "@/context/UserInfoContext";
import { useState } from "react";

const Option = ({ isMovieExists }) => {
  const { setWatchSetting, watchSetting } = useWatchSettingContext()
  const { selectEpisode, episode, season, episodes, episodeLoading, MovieInfo } = useWatchContext()
  const { isUserLoggedIn } = useUserInfoContext()
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }


  return (
    <div className="flex justify-between bg-[#22212c] px-2 py-2 text-slate-200 text-sm max-[880px]:flex-col max-[880px]:gap-5">
      <div className="flex gap-5 max-[880px]:flex-wrap">

        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setWatchSetting(prev => ({ ...prev, isExpanded: !prev.isExpanded }))}
        ><span>{watchSetting.isExpanded ? <BiCollapse /> : <LuExpand />}</span> {watchSetting.isExpanded ? "Collapse" : "Expand"}</div>

        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setWatchSetting(prev => ({ ...prev, light: !prev.light }))}
        >
          <span><FaLightbulb /></span>
          Light
          <span className="text-[var(--accent)]">{watchSetting.light ? "On" : "Off"}</span>
        </div>

        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setWatchSetting(prev => ({ ...prev, autoPlay: !prev.autoPlay }))}
        >Auto Play <span className="text-[var(--accent)]">{watchSetting.autoPlay ? "On" : "Off"}</span></div>

        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setWatchSetting(prev => ({ ...prev, autoNext: !prev.autoNext }))}
        >Auto Next <span className="text-[var(--accent)]">{watchSetting.autoNext ? "On" : "Off"}</span></div>

      </div>

      <div className="flex gap-3">
        <button
          type="button"
          disabled={MovieInfo?.type !== "tv" || episodeLoading || episode <= 1}
          className="flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-default"
          onClick={() => {
            if (MovieInfo?.type === "tv") {
              selectEpisode(episode - 1, season)
            }
          }}
        ><span><FaBackward /></span> Prev</button>

        <button
          type="button"
          disabled={MovieInfo?.type !== "tv" || episodeLoading || !episodes.some(item => item.episode_number === episode + 1)}
          className="flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-default"
          onClick={() => {
            if (MovieInfo?.type === "tv") {
              selectEpisode(episode + 1, season)
            }
          }}
        >Next <span><FaForward /></span></button>


        {isUserLoggedIn && <AddToList movieInfo={MovieInfo} isMovieExists={isMovieExists} />}

        <div className="flex items-center gap-2 cursor-pointer" onClick={handleShare}>
          <span><FaShareNodes /></span>
          <span className={copied ? "text-[var(--accent)]" : ""}>{copied ? "Copied!" : "Share"}</span>
        </div>
      </div>
    </div>
  )
}

export default Option
