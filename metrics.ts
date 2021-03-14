import { LiveLivestream } from "@holores/holoapi/dist/types";
import { Counter, Gauge } from "prom-client";
import { cache } from "./cache";

const videoLabels = ["channelId", "channelName", "videoId", "title"] as const;

export const counterReceiveMessages = new Counter({
	name: "holochat_receive_messages",
	help: "Number of received chat messages",
	labelNames: videoLabels,
});

export const counterModeratorMessages = new Counter({
	name: "holochat_moderator_messages",
	help: "Number of received moderator messages",
	labelNames: videoLabels,
});

export const videoViewers = new Gauge({
	name: "holochat_video_viewers",
	help: "Number of viedo viewer count",
	labelNames: videoLabels,
});

export const videoStartTime = new Gauge({
	name: "holochat_video_start_time_seconds",
	help: "Start time of the video since unix epoch in seconds.",
	labelNames: videoLabels,
	aggregator: "omit",
});

export function getVideoLabel(live: LiveLivestream) {
	const cacheKey = `metrics_video_label_${live.youtubeId}`;
	return cache.getDefault(cacheKey, () => ({
		channelId: live.channel.youtubeId,
		channelName: live.channel.name,
		videoId: live.youtubeId!,
		title: live.title,
	}));
}

export function initVideoMetrics(live: LiveLivestream) {
	const label = getVideoLabel(live);
	counterReceiveMessages.labels(label).inc(0);
	counterModeratorMessages.labels(label).inc(0);
	videoViewers.labels(label).inc(0);
	updateVideoMetrics(live);
}

export function updateVideoMetrics(live: LiveLivestream) {
	const label = getVideoLabel(live);
	if (live.viewers) videoViewers.labels(label).set(live.viewers);

	const startTimeCacheKey = `metrics_video_start_time_${live.youtubeId}`;
	if (live.startDate && !cache.has(startTimeCacheKey)) {
		videoStartTime.labels(label).set(live.startDate.getTime() / 1000);
		cache.set(startTimeCacheKey, 1);
	}
}

export function removeVideoMetrics(live: LiveLivestream) {
	const label = getVideoLabel(live);
	counterReceiveMessages.remove(label);
	counterModeratorMessages.remove(label);
	videoViewers.remove(label);
	videoStartTime.remove(label);
}
