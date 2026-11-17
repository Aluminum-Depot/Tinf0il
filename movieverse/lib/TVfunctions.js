export const getEpisodes = async (TMDBID, season) => {
  const url = `https://api.themoviedb.org/3/tv/${TMDBID}/season/${season ?? 1}?language=en-US&api_key=${process.env.TMDB_API_KEY}`;

  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
      caches: "no-cache"
    });

    if (!res.ok) {
      throw new Error(`Error: ${res.status} ${res.error}`);
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.error(error);
  }
};
