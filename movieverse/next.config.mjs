/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/tv',
  assetPrefix: '/tv',
  reactStrictMode: true,

  images: {
    unoptimized: true,
    qualities: [20, 75, 100],
    remotePatterns: [
      { protocol: "https", hostname: "s4.anilist.co" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "artworks.thetvdb.com" },
      { protocol: "https", hostname: "media.kitsu.io" },
      { protocol: "https", hostname: "media.kitsu.app" },
      { protocol: "https", hostname: "kitsu-production-media.s3.us-west-002.backblazeb2.com" },
      { protocol: "https", hostname: "media.themoviedb.org" },
      { protocol: "https", hostname: "image.tmdb.org" },
    ],
  },

  env: {
    TMDB_API_KEY: "7f07bff404ee5ba865c936f48d41327a",
    NEXT_PUBLIC_URL: "https://1mmun3-111676177226.herokuapp.com/tv",
    NEXT_PUBLIC_ENCRYPTION_KEY: "7327472265ecf9b23e675ada29be11623945fc42580f97f67bf563ca6e3af25e",
    apiKey: "AIzaSyB6_jbjIoS1Vu4Er3FadpMmEnFXEcD9yuo",
    authDomain: "1mmun3-b75b1.firebaseapp.com",
    projectId: "1mmun3-b75b1",
    storageBucket: "1mmun3-b75b1.firebasestorage.app",
    messagingSenderId: "12175261060",
    appId: "1:12175261060:web:1ff4e080311327382971d1",
    measurementId: "G-6JZC2CJP4Y",
  },
};

export default nextConfig;
