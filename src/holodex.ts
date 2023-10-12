import config from "config";
import { Channel, HolodexApiClient, Video, VideosParam } from "holodex.js";
import { cache } from "./cache";

export const holoapi = new HolodexApiClient({
	apiKey: config.get<string>("holodex_apikey"),
});

const videosCacheTTL = 60 * 3;

function cacheVideos(videos: Video[]) {
	for (const video of videos) {
		cache.set(video.videoId, video);
		cache.set(video.channelId, video.channel);
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
	return cache.getDefault(videoId, () => holoapi.getVideo(videoId).then(video => {
		cache.set(video.channelId, video.channel);
		return video;
	}).catch(() => undefined));
}

export function getGroup(channelId: string) {
	const channel = cache.get<Channel | undefined>(channelId);
	if (!channel) return null;

	if (channel.organization !== "Hololive") return "其他Vtuber";

	const name = channel.name.toLowerCase();
	const group = channel.group?.toLowerCase() ?? "";

	if (group === "official") return "hololive";
	if (group === "misc") return "hololive";

	if (group.startsWith("indonesia")) return "hololive-ID";
	if (name.includes("hololive-id")) return "hololive-ID";

	if (group.startsWith("english")) return "hololive-EN";
	if (name.includes("hololive-en")) return "hololive-EN";

	if (group.startsWith("holostars english")) return "holostars-EN";
	if (name.includes("holostars-en")) return "holostars-EN";

	if (group.startsWith("holostars")) return "holostars";
	if (name.includes("holostars")) return "holostars";

	if (group.includes("DEV_IS")) return "hololive DEV_IS";
	if (name.includes("ReGLOSS")) return "hololive DEV_IS";

	return "hololive-JP";
}
