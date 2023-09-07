import config from "config";
import { HolodexApiClient, Video, VideosParam } from "holodex.js";
import { cache } from "./cache";

export const holoapi = new HolodexApiClient({
	apiKey: config.get<string>("holodex_apikey"),
});

const videosCacheTTL = 60 * 3;

function cacheVideos(videos: Video[]) {
	for (const video of videos) {
		cache.set(video.videoId, video);
	}
	return videos;
}

export async function getLiveVideos(org: string): Promise<Video[]> {
	return cache.getDefault(`getLiveVideos-${org}`, () => holoapi.getLiveVideos({
		org,
		max_upcoming_hours: 20000,
	}), videosCacheTTL).then(cacheVideos);
}

export async function getVideos(params: VideosParam): Promise<Video[]> {
	return cache.getDefault(`getVideos-${JSON.stringify(params)}`, () => holoapi.getVideos(params), videosCacheTTL).then(cacheVideos);
}

export async function getLiveVideosByChannelId(channelIds: string | string[]): Promise<Video[]> {
	return cache.getDefault(`getLiveVideosByChannelId-${channelIds}`, () => holoapi.getLiveVideosByChannelId(channelIds), videosCacheTTL).then(cacheVideos);
}

export async function getVideo(videoId: string): Promise<Video | undefined> {
	if (!videoId) return undefined;
	return cache.getDefault(videoId, () => holoapi.getVideo(videoId).catch(() => undefined));
}
