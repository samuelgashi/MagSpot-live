import React from "react";

export function GoogleLogo({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function YTMLogo({ size = 12 }: { size?: number }) {
  const r = size * 0.18;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect x="1" y="1" width="22" height="22" rx="5" fill="#0F0F0F" />
      <path
        fill="#FF0000"
        d="M21.8 7.2s-.2-1.4-.8-2c-.8-.8-1.6-.8-2-.9C16.4 4 12 4 12 4s-4.4 0-7 .3c-.4.1-1.2.1-2 .9-.6.6-.8 2-.8 2S2 8.8 2 10.4v1.5c0 1.6.2 3.2.2 3.2s.2 1.4.8 2c.8.8 1.8.8 2.3.8C6.6 18 12 18 12 18s4.4 0 7-.3c.4-.1 1.2-.1 2-.9.6-.6.8-2 .8-2s.2-1.6.2-3.2v-1.5C22 8.8 21.8 7.2 21.8 7.2z"
      />
      <polygon fill="white" points="10,8.5 10,15.5 16,12" />
      <circle cx="18" cy="6" r="3.5" fill="white" />
      <text
        x="18"
        y="7.7"
        textAnchor="middle"
        fontSize="5"
        fontWeight="bold"
        fill="#FF0000"
        fontFamily="Arial"
      >
        ♪
      </text>
    </svg>
  );
}

export function YouTubeShortsLogo({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect width="24" height="24" rx="4" fill="white" />
      <path
        fill="#FF0000"
        d="M21.5 7.6s-.3-1.8-1.1-2.6c-1-1.1-2.2-1.1-2.7-1.2C15.3 3.6 12 3.6 12 3.6s-3.3 0-5.7.2c-.5.1-1.7.1-2.7 1.2C2.8 5.8 2.5 7.6 2.5 7.6S2.2 9.6 2.2 11.6v1.8c0 2 .3 4 .3 4s.3 1.8 1.1 2.6c1 1.1 2.4 1 3 1.1C8.6 21.3 12 21.3 12 21.3s3.3 0 5.7-.3c.5-.1 1.7-.1 2.7-1.2.8-.8 1.1-2.6 1.1-2.6s.3-2 .3-4v-1.8c0-2-.3-4-.3-4z"
      />
      <polygon fill="white" points="10,8.5 10,15.5 16.5,12" />
    </svg>
  );
}

export function TikTokLogo({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect width="24" height="24" rx="5" fill="#010101" />
      <path
        fill="#EE1D52"
        d="M18.5 9.1a5.25 5.25 0 01-3.25-1.1v4.7a4.65 4.65 0 11-4.65-4.65c.1 0 .19 0 .28.01V10.2a2.53 2.53 0 100 5.06 2.54 2.54 0 002.54-2.54V4h2.1a3.15 3.15 0 003.07 2.9V9.1z"
      />
      <path
        fill="#69C9D0"
        d="M17.5 8.1a5.25 5.25 0 01-3.25-1.1v4.7a4.65 4.65 0 11-4.65-4.65c.1 0 .19 0 .28.01V9.2a2.53 2.53 0 100 5.06 2.54 2.54 0 002.54-2.54V3h2.1a3.15 3.15 0 003.07 2.9V8.1z"
      />
      <path
        fill="white"
        d="M16.5 7.1a5.25 5.25 0 01-3.25-1.1v4.7a4.65 4.65 0 11-4.65-4.65c.1 0 .19 0 .28.01V8.2a2.53 2.53 0 100 5.06 2.54 2.54 0 002.54-2.54V2h2.1a3.15 3.15 0 003.07 2.9V7.1z"
      />
    </svg>
  );
}

export type ActivityType =
  | "google_search"
  | "ytm_artist"
  | "ytm_album"
  | "ytm_single"
  | "ytm_playlist"
  | "ytm_library"
  | "yt_shorts"
  | "tiktok";

export const ACTIVITY_LIST: ActivityType[] = [
  "google_search",
  "ytm_artist",
  "ytm_album",
  "ytm_single",
  "ytm_playlist",
  "ytm_library",
  "yt_shorts",
  "tiktok",
];

export const ACTIVITY_META: Record<
  ActivityType,
  { label: string; sublabel?: string; logo: (size: number) => React.ReactNode }
> = {
  google_search: {
    label: "Google",
    sublabel: "Search",
    logo: (s) => <GoogleLogo size={s} />,
  },
  ytm_artist: {
    label: "Artist",
    logo: (s) => <YTMLogo size={s} />,
  },
  ytm_album: {
    label: "Album",
    logo: (s) => <YTMLogo size={s} />,
  },
  ytm_single: {
    label: "Single",
    logo: (s) => <YTMLogo size={s} />,
  },
  ytm_playlist: {
    label: "Playlist",
    logo: (s) => <YTMLogo size={s} />,
  },
  ytm_library: {
    label: "Library",
    logo: (s) => <YTMLogo size={s} />,
  },
  yt_shorts: {
    label: "Shorts",
    logo: (s) => <YouTubeShortsLogo size={s} />,
  },
  tiktok: {
    label: "TikTok",
    sublabel: undefined,
    logo: (s) => <TikTokLogo size={s} />,
  },
};

export function getSimulatedActivity(deviceId: number, status: string): ActivityType | null {
  if (status === "offline") return null;
  return ACTIVITY_LIST[deviceId % ACTIVITY_LIST.length];
}
