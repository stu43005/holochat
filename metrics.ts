import { BloomFilter } from "bloom-filters";
import fs from "fs";
import type { Video } from "holodex.js";
import path from "path";
import { Counter, Gauge, register } from "prom-client";
import { cache } from "./cache";
import { CustomChatItem } from "./masterchat-parser";

//#region types

const videoLabels = ["channelId", "channelName", "videoId", "title"] as const;

interface VideoLabel {
	channelId: string;
	channelName: string;
	videoId: string;
	title: string;
}

const enum MessageType {
	Milestone = "milestone",
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

const counterReceiveMessageUsers = new Counter({
	name: "holochat_receive_message_users",
	help: "Number of received user count",
	labelNames: [...videoLabels, "type", "authorType"],
});

const userFilters: Record<string, {
	[MessageType.TextMessage]?: {
		[MessageAuthorType.Owner]?: Set<string>;
		[MessageAuthorType.Marked]?: Set<string>;
		[MessageAuthorType.Moderator]?: Set<string>;
		[MessageAuthorType.Sponsor]?: Set<string>;
		[MessageAuthorType.Verified]?: Set<string>;
		[MessageAuthorType.Other]?: Set<string>;
	};
	[MessageType.SuperChat]?: Set<string>;
}> = {};

const gaugeSuperChatJpyValue = new Gauge({
	name: "holochat_super_chat_value",
	help: "Sum of super chat value in jpy",
	labelNames: [...videoLabels, "type", "authorType", "currency"],
});

const gaugeSuperChatValue = new Gauge({
	name: "holochat_super_chat_value_origin",
	help: "Sum of super chat value in origin currency",
	labelNames: [...videoLabels, "type", "authorType", "currency"],
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
	holochat_receive_message_users: counterReceiveMessageUsers,
	holochat_super_chat_value: gaugeSuperChatJpyValue,
	holochat_super_chat_value_origin: gaugeSuperChatValue,
	holochat_video_viewers: videoViewers,
	holochat_video_start_time_seconds: videoStartTime,
	holochat_video_end_time_seconds: videoEndTime,
	holochat_video_up_time_seconds: videoUpTime,
	holochat_video_duration_seconds: videoDuration,
	holochat_filter_test_failed: counterFilterTestFailed,
};

//#endregion

//#region functions

export function getVideoLabel(live: Video): VideoLabel {
	const cacheKey = getVideoLabelKey(live.videoId);
	return cache.getDefault(cacheKey, () => ({
		channelId: live.channel.channelId,
		channelName: live.channel.name,
		videoId: live.videoId,
		title: live.title,
	}));
}

function getVideoLabelKey(videoId: string) {
	return `metrics_video_label_${videoId}`;
}

export function initVideoMetrics(live: Video) {
	updateVideoMetrics(live);
}

export function updateVideoMetrics(live: Video) {
	const label = getVideoLabel(live);
	if (live.liveViewers) {
		videoViewers.labels(label).set(live.liveViewers);
	}
	else {
		videoViewers.labels(label).set(0);
	}
	const startDate = live.actualStart ?? live.scheduledStart;
	const endDate = live.actualEnd ?? new Date();
	if (startDate) {
		videoStartTime.labels(label).set(startDate.getTime() / 1000);

		const duration = endDate.getTime() - startDate.getTime();
		if (duration > 0) {
			videoDuration.labels(label).set(duration / 1000);
		}
	}
	if (live.actualEnd) {
		videoEndTime.labels(label).set(live.actualEnd.getTime() / 1000);
	}
	videoUpTime.labels(label).set(endDate.getTime() / 1000);
}

export function updateVideoEnding(live: Video, endTime: Date) {
	const label = getVideoLabel(live);
	videoEndTime.labels(label).set(endTime.getTime() / 1000);
}

function getMessageType(message: CustomChatItem) {
	switch (message.type) {
		case "addMembershipItemAction":
			return MessageType.NewSponsor;
		case "addMembershipMilestoneItemAction":
			return MessageType.Milestone;
		case "addSuperChatItemAction":
			return MessageType.SuperChat;
		case "addSuperStickerItemAction":
			return MessageType.SuperSticker;
		case "addChatItemAction":
			return MessageType.TextMessage;
	}
	return MessageType.Other;
}

function getMessageAuthorType(message: CustomChatItem) {
	let authorType = MessageAuthorType.Other;
	if (message.isOwner) authorType = MessageAuthorType.Owner;
	else if (message.isMarked) authorType = MessageAuthorType.Marked;
	else if (message.isModerator) authorType = MessageAuthorType.Moderator;
	else if (message.isSponsor) authorType = MessageAuthorType.Sponsor;
	else if (message.isVerified) authorType = MessageAuthorType.Verified;
	return authorType;
}

export function addMessageMetrics(live: Video, message: CustomChatItem) {
	const type = getMessageType(message);
	const authorType = getMessageAuthorType(message);

	const label: MessageLabel = {
		...getVideoLabel(live),
		type,
		authorType,
	};

	const videoId = live.videoId;
	if (!messageLabels[videoId]) messageLabels[videoId] = new Set();
	messageLabels[videoId].add(JSON.stringify(label));

	counterReceiveMessages.labels(label).inc(1);

	if (message.scJpyAmount > 0) {
		const scLabel = {
			...label,
			currency: message.scCurrency,
		};
		gaugeSuperChatJpyValue.labels(scLabel).inc(message.scJpyAmount);
		messageLabels[videoId].add(JSON.stringify(scLabel));
	}

	if (message.scAmount > 0) {
		const scLabel = {
			...label,
			currency: message.scCurrency,
		};
		gaugeSuperChatValue.labels(scLabel).inc(message.scAmount);
		messageLabels[videoId].add(JSON.stringify(scLabel));
	}

	if (!userFilters[videoId]) userFilters[videoId] = {};
	if (type === MessageType.SuperChat) {
		if (!userFilters[videoId][type]) {
			// userFilters[videoId][type] = BloomFilter.create(2000, 0.02);
			userFilters[videoId][type] = new Set();
		}
		if (!userFilters[videoId][type]?.has(message.authorChannelId)) {
			counterReceiveMessageUsers.labels(label).inc(1);
			userFilters[videoId][type]?.add(message.authorChannelId);
		}
	}
	if (type === MessageType.TextMessage) {
		if (!userFilters[videoId][type]) userFilters[videoId][type] = {};
		const textMessage = userFilters[videoId][type]!;
		if (!textMessage[authorType]) {
			switch (authorType) {
				default:
					textMessage[authorType] = new Set();
					break;
				// case MessageAuthorType.Sponsor:
				// 	textMessage[authorType] = BloomFilter.create(5000, 0.02);
				// 	break;
				// case MessageAuthorType.Other:
				// 	textMessage[authorType] = BloomFilter.create(15000, 0.02);
				// 	break;
			}
		}
		if (!Object.values(textMessage).some(set => set?.has(message.authorChannelId))) {
			counterReceiveMessageUsers.labels(label).inc(1);
			textMessage[authorType]?.add(message.authorChannelId);
		}
	}
}

export function guessMessageAuthorType(videoId: string, channelId: string) {
	const authorType = {
		isOwner: false,
		isModerator: false,
		isVerified: false,
		isSponsor: false,
	};
	const textMessage = userFilters[videoId]?.[MessageType.TextMessage];
	if (!textMessage) return authorType;

	if (textMessage[MessageAuthorType.Owner]?.has(channelId)) authorType.isOwner = true;
	if (textMessage[MessageAuthorType.Moderator]?.has(channelId)) authorType.isModerator = true;
	if (textMessage[MessageAuthorType.Sponsor]?.has(channelId)) authorType.isSponsor = true;
	if (textMessage[MessageAuthorType.Verified]?.has(channelId)) authorType.isVerified = true;
	return authorType;
}

export function removeVideoMetrics(live: Video) {
	const label = getVideoLabel(live);
	const videoId = live.videoId;
	if (messageLabels[videoId]) {
		messageLabels[videoId].forEach(l => {
			const ll = JSON.parse(l);
			if (ll.currency) {
				gaugeSuperChatJpyValue.remove(ll);
				gaugeSuperChatValue.remove(ll);
			}
			else {
				counterReceiveMessages.remove(ll);
				counterReceiveMessageUsers.remove(ll);
			}
		});
		delete messageLabels[videoId];
	}
	videoViewers.remove(label);
	videoStartTime.remove(label);
	videoEndTime.remove(label);
	videoUpTime.remove(label);
	videoDuration.remove(label);
	counterFilterTestFailed.remove(label);
	delete userFilters[videoId];
}

//#endregion

//#region delay remove metrics

const removeMetricsTimer: Record<string, NodeJS.Timeout> = {};
const removeMetricsTimerMs = 10 * 60 * 1000;

export function delayRemoveVideoMetrics(live: Video) {
	const videoId = live.videoId;
	if (!removeMetricsTimer[videoId]) {
		removeMetricsTimer[videoId] = global.setTimeout(() => {
			removeVideoMetrics(live);
			delete removeMetricsTimer[videoId];
		}, removeMetricsTimerMs);
	}
}

export function deleteRemoveMetricsTimer(videoId: string) {
	if (removeMetricsTimer[videoId]) {
		global.clearTimeout(removeMetricsTimer[videoId]);
		delete removeMetricsTimer[videoId];
	}
}

//#endregion

//#region backup metrics

const backupPath = path.join(__dirname, "backup/backup_metrics.json");
const backupUserFiltersPath = path.join(__dirname, "backup/backup_user_filters.json");
let receivedSignal = false;

export async function handleExit(signal?: NodeJS.Signals, exitCode = 0, saveUserFilter = true) {
	console.log(`Received ${signal}`);
	if (!receivedSignal) {
		receivedSignal = true;

		const json = await register.getMetricsAsJSON();
		try {
			fs.mkdirSync(path.dirname(backupPath));
		}
		catch (e) {
			// nothing
		}
		fs.writeFileSync(backupPath, JSON.stringify(json));

		if (saveUserFilter) {
			const userFiltersJson = JSON.stringify(userFilters, (key, value) => {
				if (value instanceof BloomFilter) {
					return value.saveAsJSON();
				}
				if (value instanceof Set) {
					return {
						type: "Set",
						data: [...value],
					};
				}
				return value;
			});
			fs.writeFileSync(backupUserFiltersPath, userFiltersJson);
		}
	}
	if (exitCode >= 0) {
		process.exit(exitCode);
	}
};

process.on("SIGINT", (signal) => handleExit(signal));
process.on("SIGTERM", (signal) => handleExit(signal));
process.on("SIGUSR2", (signal) => handleExit(signal)); // for nodemon

function readJsonFile(filepath: string) {
	try {
		const content = fs.readFileSync(filepath, { encoding: "utf8" });
		const json = JSON.parse(content);
		return json;
	}
	catch (error) {
		return;
	}
}

export function restoreAllMetrics(now: Video[]) {
	const backup = readJsonFile(backupPath);
	if (backup) {
		for (const live of now) {
			restoreVideoMetrics(backup, live);
		}
	}

	const userFiltersBackup = readJsonFile(backupUserFiltersPath);
	if (userFiltersBackup) {
		const userFiltersBackup2 = JSON.parse(JSON.stringify(userFiltersBackup), (key, value) => {
			if (typeof value === "object" && value.type === "BloomFilter") {
				return BloomFilter.fromJSON(value);
			}
			if (typeof value === "object" && value.type === "Set") {
				return new Set<string>(value.data);
			}
			return value;
		});
		for (const live of now) {
			const videoId = live.videoId;
			if (userFiltersBackup2[videoId]) {
				// convert old backup
				if (userFiltersBackup2[videoId][MessageType.TextMessage] instanceof BloomFilter) {
					userFiltersBackup2[videoId][MessageType.TextMessage] = {
						[MessageAuthorType.Other]: userFiltersBackup2[videoId][MessageType.TextMessage],
					};
				}

				userFilters[videoId] = userFiltersBackup2[videoId];
			}
		}
	}
}

function restoreVideoMetrics(backup: any[], live: Video) {
	const videoId = live.videoId;
	const keys: (keyof typeof metrics)[] = Object.keys(metrics) as any;
	for (const key of keys) {
		const metric = metrics[key];
		const oldData = backup?.find(entry => entry.name === key);
		if (!oldData) continue;
		const values = oldData?.values?.filter((value: any) => value?.labels?.videoId === videoId);
		if (!values?.length) continue;

		for (const value of values) {
			const valueLabel = value.labels;
			const valueValue = value.value;
			if (!valueLabel || !valueValue) continue;

			if (metric instanceof Gauge) {
				metric.labels(valueLabel).set(valueValue);
			}
			else if (metric instanceof Counter) {
				metric.labels(valueLabel).inc(valueValue);
			}

			if (key === "holochat_receive_messages" || key === "holochat_super_chat_value") {
				if (!messageLabels[videoId]) messageLabels[videoId] = new Set();
				messageLabels[videoId].add(JSON.stringify(valueLabel));
			}

			cache.set(getVideoLabelKey(videoId), {
				channelId: valueLabel.channelId,
				channelName: valueLabel.channelName,
				videoId: valueLabel.videoId,
				title: valueLabel.title,
			});
		}
	}
}

//#endregion
