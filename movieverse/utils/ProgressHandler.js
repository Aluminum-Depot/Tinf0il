export const getWatchProgress = (isSlice = true, page = 1, pageSize = 4) => {
  const movieData = JSON.parse(localStorage.getItem("watch_history") || "{}");

  const entries = Object.entries(movieData);

  // Sort the entries based on updatedDate
  const sortedData = entries.sort(([, a], [, b]) => {
    const dateA = new Date(a?.date || 0);
    const dateB = new Date(b?.date || 0);
    return dateB - dateA;
  });

  // Calculate start and end indices for pagination
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  // Conditionally slice the array based on pagination
  const processedData = isSlice ? sortedData.slice(startIndex, endIndex) : sortedData;

  // Map the data to the desired format
  const data = processedData.map(([key, item]) => ({
    id: key,
    movieid: item.movieid,
    title: item.title,
    episode: item.episode_number,
    totalepisode: item.totalepisode,
    season: item.season_number ?? 1,
    description: item.description || "",
    runtime: item.runtime || '',
    media_type: item.media_type || "movie",
    date: item.date || 0,
    thumbnail: item.thumbnail || "",
  }));

  return data;
};

export const saveWatchProgress = (
  data,
  episodes,
  episode,

) => {
  const existed_data = JSON.parse(localStorage.getItem("watch_history") || "[]")
  const id = data?.id


  if (episodes.length === 0 || episodes[episode - 1]?.title === 0) {
    return
  }


  const episodeInfo = episodes[episode - 1]
  // console.log(data, episodeInfo)

  const historyData = {
    [id]: {
      title: ((episodeInfo?.title || "") || (data?.original_name) || (data?.title)),
      episode_number: episodeInfo?.episode_number || 1,
      season_number: episodeInfo?.season_number ?? 1,
      totalepisode: (episodes?.length) || 1,
      description: episodeInfo?.overview || "",
      runtime: episodeInfo?.runtime || 1,
      media_type: data?.type || "movie",
      date: Date.now(),
      movieid: id,
      thumbnail: `https://image.tmdb.org/t/p/w250_and_h141_bestv2${episodeInfo?.still_path || ""}`,
    }
  }

  localStorage.setItem("watch_history", JSON.stringify({ ...existed_data, ...historyData }))
}
