import { VideoBase } from "@holores/holoapi/dist/types";
import fs from "fs";
import path from "path";
import { Counter, Gauge, register } from "prom-client";
import { YouTubeLiveChatMessage } from "youtube-live-chat-ts";
import { cache } from "./cache";
import { YtcMessage } from "./ytc-fetch-parser";

//#region types

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

//#endregion

//#region metrics

const counterReceiveMessages = new Counter({
	name: "holochat_receive_messages",
	help: "Number of received chat messages",
	labelNames: [...videoLabels, "type", "authorType"],
});

const messageLabels: Record<string, Set<string>> = {};

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

const videoUpTime = new Gauge({
	name: "holochat_video_up_time_seconds",
	help: "Up time of the video since unix epoch in seconds.",
	labelNames: videoLabels,
});

const videoDuration = new Gauge({
	name: "holochat_video_duration_seconds",
	help: "Duration of the video in seconds.",
	labelNames: videoLabels,
});

export const counterFilterTestFailed = new Counter({
	name: "holochat_filter_test_failed",
	help: "Number of filter test failed",
	labelNames: videoLabels,
});

const metrics = {
	holochat_receive_messages: counterReceiveMessages,
	holochat_super_chat_value: gaugeSuperChatValue,
	holochat_video_viewers: videoViewers,
	holochat_video_start_time_seconds: videoStartTime,
	holochat_video_end_time_seconds: videoEndTime,
	holochat_video_up_time_seconds: videoUpTime,
	holochat_video_duration_seconds: videoDuration,
	holochat_filter_test_failed: counterFilterTestFailed,
};

//#endregion

//#region functions

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
	videoViewers.labels(label).set(0);
	updateVideoMetrics(live);
}

export function updateVideoMetrics(live: VideoBase) {
	const label = getVideoLabel(live);
	if (live.viewers) {
		videoViewers.labels(label).set(live.viewers);
	}
	const endDate = live.endDate ?? new Date();
	if (live.startDate) {
		videoStartTime.labels(label).set(live.startDate.getTime() / 1000);

		const duration = endDate.getTime() - live.startDate.getTime();
		if (duration > 0) {
			videoDuration.labels(label).set(duration / 1000);
		}
	}
	if (live.endDate) {
		videoEndTime.labels(label).set(live.endDate.getTime() / 1000);
	}
	videoUpTime.labels(label).set(endDate.getTime() / 1000);
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
	if (!messageLabels[videoId]) messageLabels[videoId] = new Set();
	messageLabels[videoId].add(JSON.stringify(label));

	counterReceiveMessages.labels(label).inc(1);
}

export function removeVideoMetrics(live: VideoBase) {
	const label = getVideoLabel(live);
	const videoId = live.youtubeId!;
	if (messageLabels[videoId]) {
		messageLabels[videoId].forEach(l => {
			const ll = JSON.parse(l);
			counterReceiveMessages.remove(ll);
		});
		delete messageLabels[videoId];
	}
	gaugeSuperChatValue.remove(label);
	videoViewers.remove(label);
	videoStartTime.remove(label);
	videoEndTime.remove(label);
	videoUpTime.remove(label);
	videoDuration.remove(label);
	counterFilterTestFailed.remove(label);
}

//#endregion

//#region delay remove metrics

const removeMetricsTimer: Record<string, NodeJS.Timeout> = {};
const removeMetricsTimerMs = 5 * 60 * 1000;

export function delayRemoveVideoMetrics(live: VideoBase) {
	const videoId = live.youtubeId!;
	deleteRemoveMetricsTimer(videoId);
	removeMetricsTimer[videoId] = global.setTimeout(() => {
		removeVideoMetrics(live);
	}, removeMetricsTimerMs);
}

export function deleteRemoveMetricsTimer(videoId: string) {
	if (removeMetricsTimer[videoId]) {
		global.clearTimeout(removeMetricsTimer[videoId]);
		delete removeMetricsTimer[videoId];
	}
}

//#endregion

//#region backup metrics

const backupPath = path.join(__dirname, "backup_metrics.json");

async function handleExit(signal: NodeJS.Signals) {
	console.log(`Received ${signal}`);
	const json = await register.getMetricsAsJSON();
	fs.writeFileSync(backupPath, JSON.stringify(json));
	process.exit(0);
};

process.on("SIGINT", handleExit);
process.on("SIGTERM", handleExit);
process.on("SIGUSR2", handleExit); // for nodemon

function readBackupMetrics() {
	try {
		const content = fs.readFileSync(backupPath, { encoding: "utf8" });
		const json = JSON.parse(content);
		return json;
	}
	catch (error) {
		return;
	}
}

export function restoreAllMetrics(videoIds: string[]) {
	const backup = readBackupMetrics();
	if (!backup) return;

	for (const videoId of videoIds) {
		restoreVideoMetrics(backup, videoId);
	}
}

function restoreVideoMetrics(backup: any[], videoId: string) {
	const keys: (keyof typeof metrics)[] = Object.keys(metrics) as any;
	for (const key of keys) {
		const metric = metrics[key];
		const oldData = backup?.find(entry => entry.name === key);
		if (!oldData) continue;
		const values = oldData?.values?.filter((value: any) => value?.labels?.videoId === videoId);
		if (!values?.length) continue;

		for (const value of values) {
			if (!value.labels || !value.value) continue;

			if (metric instanceof Gauge) {
				metric.labels(value.labels).set(value.value);
			}
			else if (metric instanceof Counter) {
				metric.labels(value.labels).inc(value.value);
			}

			if (key === "holochat_receive_messages") {
				if (!messageLabels[videoId]) messageLabels[videoId] = new Set();
				messageLabels[videoId].add(JSON.stringify(value.labels));
			}
		}
	}
}

//#endregion
