export type FeedStatusKind = "live" | "cached" | "fallback";

export type FeedKindStatus = {
  status: FeedStatusKind;
  provider: string;
  fetchedAt: string | null;
  detail?: string;
};

export type DataFeeds = {
  weather: FeedKindStatus;
  routing: FeedKindStatus;
  elevation: FeedKindStatus;
  osm: FeedKindStatus;
  geocode: FeedKindStatus;
  ops: FeedKindStatus;
  iot: FeedKindStatus;
};

export type WeatherHistoryDay = {
  date: string;
  locationId: string;
  tempC: number;
  windKmh: number;
  precipMm: number;
  snowfallCm: number;
};

export type WeatherRaw = {
  tempC: number;
  windKmh: number;
  visibilityKm: number | null;
  precipMm: number;
  snowfallCm: number;
  precipProb: number;
  humidityPct: number | null;
  cloudCoverPct: number | null;
  weatherCode: number | null;
  symbol?: string;
};

export type GeoHit = {
  name: string;
  latitude: number;
  longitude: number;
  elevation: number | null;
  country: string | null;
  admin1: string | null;
  timezone: string | null;
};

export type OsrmLeg = {
  distanceKm: number;
  durationMin: number;
  path: { lat: number; lng: number }[];
  roadName?: string;
  snapFromM: number;
  snapToM: number;
  cached: boolean;
};

export type OsmWay = {
  highway?: string;
  surface?: string;
  name?: string;
  bridge?: boolean;
  tunnel?: boolean;
  tracktype?: string;
};

export function idleFeed(provider: string, detail?: string): FeedKindStatus {
  return { status: "fallback", provider, fetchedAt: null, detail };
}

export function liveFeed(provider: string, detail?: string): FeedKindStatus {
  return { status: "live", provider, fetchedAt: new Date().toISOString(), detail };
}

export function cachedFeed(provider: string, fetchedAt: string | null, detail?: string): FeedKindStatus {
  return { status: "cached", provider, fetchedAt, detail };
}
