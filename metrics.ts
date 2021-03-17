import { VideoBase } from "@holores/holoapi/dist/types";
import { Counter, Gauge } from "prom-client";
import { YouTubeLiveChatMessage } from "youtube-live-chat-ts";
import { cache } from "./cache";
import { YtcMessage } from "./ytc-fetch-parser";

const videoLabels = ["channelId", "channelName", "videoId", "title"] as const;

interface VideoLabel {
	channelId: string;
	channelName: string;
	videoId: string;
	title: string;
}

const enum MessageType {
	NewSponsor = "newSponsor",
	SuperChat = "superChat",
	SuperSticker = "superSticker",
	TextMessage = "textMessage",
	Other = "other",
}

const enum MessageAuthorType {
	Owner = "owner",
	Marked = "marked",
	Moderator = "moderator",
	Sponsor = "sponsor",
	Verified = "verified",
	Other = "other",
}

interface MessageLabel extends VideoLabel {
	type: MessageType;
	authorType: MessageAuthorType;
}

const counterReceiveMessages = new Counter({
	name: "holochat_receive_messages",
	help: "Number of received chat messages",
	labelNames: [...videoLabels, "type", "authorType"],
});

const messageLabels: Record<string, MessageLabel[]> = {};

const gaugeSuperChatValue = new Gauge({
	name: "holochat_super_chat_value",
	help: "Sum of super chat value",
	labelNames: videoLabels,
});

const videoViewers = new Gauge({
	name: "holochat_video_viewers",
	help: "Number of viedo viewer count",
	labelNames: videoLabels,
});

const videoStartTime = new Gauge({
	name: "holochat_video_start_time_seconds",
	help: "Start time of the video since unix epoch in seconds.",
	labelNames: videoLabels,
	aggregator: "omit",
});

const videoEndTime = new Gauge({
	name: "holochat_video_end_time_seconds",
	help: "End time of the video since unix epoch in seconds.",
	labelNames: videoLabels,
	aggregator: "omit",
});

const videoDuration = new Gauge({
	name: "holochat_video_duration_seconds",
	help: "Duration of the video in seconds.",
	labelNames: videoLabels,
});

export const counterFilterTestFailed = new Counter({
	name: "holochat_filter_test_failed",
	help: "Number of filter test failed",
});

export function getVideoLabel(live: VideoBase): VideoLabel {
	const cacheKey = `metrics_video_label_${live.youtubeId}`;
	return cache.getDefault(cacheKey, () => ({
		channelId: live.channel.youtubeId,
		channelName: live.channel.name,
		videoId: live.youtubeId!,
		title: live.title,
	}));
}

export function initVideoMetrics(live: VideoBase) {
	const label = getVideoLabel(live);
	gaugeSuperChatValue.labels(label).set(0);
	videoViewers.labels(label).set(0);
	updateVideoMetrics(live);
}

export function updateVideoMetrics(live: VideoBase) {
	const label = getVideoLabel(live);
	if (live.viewers) videoViewers.labels(label).set(live.viewers);

	const startTimeCacheKey = `metrics_video_start_time_${live.youtubeId}`;
	if (live.startDate && !cache.has(startTimeCacheKey)) {
		videoStartTime.labels(label).set(live.startDate.getTime() / 1000);
		cache.set(startTimeCacheKey, 1);
	}
	if (live.startDate) {
		const duration = (Date.now() - live.startDate.getTime()) / 1000;
		if (duration > 0) {
			videoDuration.labels(label).set(duration);
		}
	}
}

export function addMessageMetrics(live: VideoBase, message: YouTubeLiveChatMessage | YtcMessage, marked = false) {
	let type = MessageType.Other;
	let authorType = MessageAuthorType.Other;
	switch (message.snippet.type) {
		case "newSponsorEvent":
			type = MessageType.NewSponsor;
			break;
		case "superChatEvent":
			type = MessageType.SuperChat;
			break;
		case "superStickerEvent":
			type = MessageType.SuperSticker;
			break;
		case "textMessageEvent":
			type = MessageType.TextMessage;
			break;
	}

	if (message.authorDetails.isChatOwner) authorType = MessageAuthorType.Owner;
	else if (marked) authorType = MessageAuthorType.Marked;
	else if (message.authorDetails.isChatModerator) authorType = MessageAuthorType.Moderator;
	else if (message.authorDetails.isChatSponsor) authorType = MessageAuthorType.Sponsor;
	else if (message.authorDetails.isVerified) authorType = MessageAuthorType.Verified;

	const label: MessageLabel = {
		...getVideoLabel(live),
		type,
		authorType,
	};

	const videoId = live.youtubeId!;
	messageLabels[videoId] = messageLabels[videoId] || [];
	if (!messageLabels[videoId].find(b => label.type === b.type && label.authorType === b.authorType)) messageLabels[videoId].push(label);

	counterReceiveMessages.labels(label).inc(1);
}

export function removeVideoMetrics(live: VideoBase) {
	const label = getVideoLabel(live);
	const videoId = live.youtubeId!;
	if (messageLabels[videoId]) {
		messageLabels[videoId].forEach(l => {
			counterReceiveMessages.remove(l);
		});
	}
	gaugeSuperChatValue.remove(label);
	videoViewers.remove(label);
	videoStartTime.remove(label);

	const endTimeCacheKey = `metrics_video_end_time_${live.youtubeId}`;
	if (live.endDate && !cache.has(endTimeCacheKey)) {
		videoEndTime.labels(label).set(live.endDate.getTime() / 1000);
		if (live.startDate) {
			videoDuration.labels(label).set((live.endDate.getTime() - live.startDate.getTime()) / 1000);
		}

		global.setTimeout(() => {
			videoEndTime.remove(label);
			videoDuration.remove(label);
		}, 60000);
		cache.set(endTimeCacheKey, 1);
	}
}
