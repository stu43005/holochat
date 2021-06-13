import Client from "@holores/holoapi";
import { LiveLivestream, VideoBase } from "@holores/holoapi/dist/types";
import { BloomFilter } from "bloom-filters";
import config from "config";
import { MessageEmbed, WebhookClient } from "discord.js";
import moment from "moment";
import { YouTubeLiveChatMessage } from "youtube-live-chat-ts";
import { cache } from "./cache";
import { addMessageMetrics, counterFilterTestFailed, delayRemoveVideoMetrics, deleteRemoveMetricsTimer, getVideoLabel, guessMessageAuthorType, initVideoMetrics, restoreAllMetrics, updateVideoMetrics } from "./metrics";
import { currencyToJpyAmount, parseAmountDisplayString, secondsToHms } from "./utils";
import { YtcMessage } from "./ytc-fetch-parser";
import { YtcNoChrome } from "./ytc-nochrome";

const KEY_YOUTUBE_LIVE_IDS = "youtube_live_ids";

const holoapi = new Client();
// const ytcHeadless = new MyYouTubeLiveChat(config.get<string>("google_api_key"));
const ytcHeadless = new YtcNoChrome();
const webhook = new WebhookClient(config.get<string>("discord_id"), config.get<string>("discord_token"));

const channels = config.has("channels") ? config.get<string[]>("channels") : [];
const messageFilters: Record<string, BloomFilter> = {};
let inited = false;

function delay(sec: number) {
	return new Promise((resolve) => global.setTimeout(resolve, sec));
}

export async function fetchChannel() {
	const t = moment();
	const lives = await holoapi.videos.getLivestreams("", 1, 1);
	let now: VideoBase[] = [];
	if (lives.live) {
		now = now.concat(lives.live);
	}
	if (lives.upcoming) {
		for (const video of lives.upcoming) {
			const startTime = moment(video.scheduledDate);
			const r = startTime.subtract(60, "minute");
			if (t.isSameOrAfter(r)) {
				now.push(video);
			}
		}
	}
	if (lives.ended) {
		for (const video of lives.ended) {
			const endDate = moment(video.endDate);
			const r = endDate.add(10, "minute");
			if (t.isSameOrBefore(r)) {
				now.push(video);
			}
		}
	}

	if (!inited) {
		inited = true;
		restoreAllMetrics(now);
	}

	const lived = cache.get<string[]>(KEY_YOUTUBE_LIVE_IDS) ?? [];
	for (const videoId of lived) {
		const live = now.find(l => l.youtubeId === videoId);
		if (live) {
			deleteStopRecordTimer(videoId);
			continue;
		}

		delayStopRecord(videoId);
	}

	for (const live of now) {
		const videoId = live.youtubeId;
		if (!videoId) continue;
		// if (channels.length && !channels.includes(live.channel.youtubeId)) continue; // Not in channel list

		cache.set(videoId, live);
		if (cache.sismember(KEY_YOUTUBE_LIVE_IDS, videoId)) {
			// already started
			updateVideoMetrics(live);
			continue;
		}

		startChatRecord(videoId).catch(error => {
			console.error(`Start record error: ${videoId}:`, error.toString());
		});

		await delay(1000);
	}
}

async function startChatRecord(videoId: string) {
	cache.sadd(KEY_YOUTUBE_LIVE_IDS, videoId);

	deleteStopRecordTimer(videoId);
	deleteRemoveMetricsTimer(videoId);
	const live = cache.get<LiveLivestream>(videoId);
	if (live) initVideoMetrics(live);

	messageFilters[videoId] = BloomFilter.create(100000, 0.02);

	// const liveChatId = await ytcHeadless.getLiveChatIdFromVideoId(videoId);
	// if (!liveChatId) return false;

	// const observe = ytcHeadless.listen(liveChatId, () => {
	// 	const live = cache.get<LiveLivestream>(videoId);
	// 	const viewers = live?.viewers ?? 0;
	// 	return 120000 - viewers * 2;
	// });

	const observe = await ytcHeadless.listen(videoId);
	observe.subscribe(
		(chatMessage: YouTubeLiveChatMessage | YtcMessage) => {
			const live = cache.get<LiveLivestream>(videoId);
			if (live) {
				if (messageFilters[videoId]?.has(chatMessage.id)) {
					counterFilterTestFailed.labels(getVideoLabel(live)).inc(1);
					return;
				}
				guessMessageAuthorType(live, chatMessage);
				parseMessage(live, chatMessage);
				messageFilters[videoId]?.add(chatMessage.id);
			}
		},
		(error: any) => {
			console.error(error);
			if (`${error}`.includes("很抱歉，聊天室目前無法使用")) {
				// dont remove metrics
			}
			else {
				stopChatRecord(videoId, true);
				ytcHeadless.stop(videoId);
			}
		},
		() => {
			stopChatRecord(videoId);
		}
	);
	console.log(`Start record: ${videoId}`);
	logChatsCount();
}

function stopChatRecord(videoId: string, onError = false) {
	cache.srem(KEY_YOUTUBE_LIVE_IDS, videoId);

	const live = cache.get<LiveLivestream>(videoId);
	if (live) {
		delayRemoveVideoMetrics(live);
	}

	delete messageFilters[videoId];

	console.log(`Stop record: ${videoId}`);
	logChatsCount();
}

//#region delay stop

const stopRecordTimer: Record<string, NodeJS.Timeout> = {};
const stopRecordTimerMs = 5 * 60 * 1000;

export function delayStopRecord(videoId: string) {
	if (!stopRecordTimer[videoId]) {
		stopRecordTimer[videoId] = global.setTimeout(() => {
			ytcHeadless.stop(videoId);
			stopChatRecord(videoId);
			delete stopRecordTimer[videoId];
		}, stopRecordTimerMs);
	}
}

export function deleteStopRecordTimer(videoId: string) {
	if (stopRecordTimer[videoId]) {
		global.clearTimeout(stopRecordTimer[videoId]);
		delete stopRecordTimer[videoId];
	}
}

//#endregion

async function parseMessage(live: LiveLivestream, message: YouTubeLiveChatMessage | YtcMessage) {
	const videoId = live.youtubeId;
	const userName = message.authorDetails.displayName;
	const userDetail: string[] = [
		...(message.authorDetails.isChatOwner ? ["Owner"] : []),
		...(message.authorDetails.isChatModerator ? ["Moderator"] : []),
		...(message.authorDetails.isVerified ? ["Verified"] : []),
		...(message.authorDetails.isChatSponsor ? ["Sponsor"] : []),
	];
	const marked = !!(channels.length && channels.includes(message.authorDetails.channelId));
	const publishedAt = new Date(message.snippet.publishedAt);
	const isBeforeStream = !live.startDate || live.startDate > publishedAt;
	const time = isBeforeStream ? 0 : Math.floor((publishedAt.getTime() - live.startDate.getTime()) / 1000);
	const timeCode = secondsToHms(time);

	let content = "";
	let amountDisplayString = "";
	let amount = 0;
	let currency = "";

	switch (message.snippet.type) {
		case "newSponsorEvent":
			content = (message.snippet as any).displayMessage ?? "";
			break;
		case "superChatEvent":
			amountDisplayString = message.snippet.superChatDetails.amountDisplayString;
			// amountMicros = message.snippet.superChatDetails.amountMicros;
			// currency = message.snippet.superChatDetails.currency;
			content = `${message.snippet.superChatDetails.userComment ?? ""} (${amountDisplayString}, ${message.snippet.superChatDetails.tier})`.trim();
			break;
		case "superStickerEvent":
			amountDisplayString = message.snippet.superStickerDetails.amountDisplayString;
			// amountMicros = message.snippet.superStickerDetails.amountMicros;
			// currency = message.snippet.superStickerDetails.currency;
			content = `${message.snippet.superStickerDetails.superStickerMetadata?.altText ?? ""} (${amountDisplayString}, ${message.snippet.superStickerDetails.tier})`.trim();
			break;
		case "textMessageEvent":
			content = message.snippet.textMessageDetails.messageText;
			break;
	}

	if (amountDisplayString) {
		const value = parseAmountDisplayString(amountDisplayString);
		if (value) {
			const jpyAmount = await currencyToJpyAmount(value.amount, value.currency);
			// console.debug(amountDisplayString, "convert to", jpyAmount.currency, jpyAmount.amount);
			amount = jpyAmount.amount;
			currency = value.currency;
		}
	}

	if (marked || message.authorDetails.isChatOwner || message.authorDetails.isChatModerator) {
		console.log(`[${videoId}][${timeCode}] ${userName}${userDetail.length ? `(${userDetail.join(",")})` : ""}: ${content}`);
	}
	if (marked) {
		postDiscord(live, message, content, time);
	}

	updateVideoMetrics(live);
	addMessageMetrics(live, message, marked, amount, currency);
}

function postDiscord(live: LiveLivestream, chatMessage: YouTubeLiveChatMessage | YtcMessage, content: string, time: number) {
	const message = new MessageEmbed();
	message.setAuthor(chatMessage.authorDetails.displayName, chatMessage.authorDetails.profileImageUrl, chatMessage.authorDetails.channelUrl);
	message.setTitle(`To ${live.channel.name} • At ${secondsToHms(time)}`);
	message.setURL(`https://youtu.be/${live.youtubeId}?t=${time}`);
	message.setThumbnail(live.thumbnail ?? `https://i.ytimg.com/vi/${live.youtubeId}/mqdefault.jpg`);
	message.setDescription(content);
	message.setFooter(live.title, live.channel.photo);
	message.setTimestamp(new Date(chatMessage.snippet.publishedAt));
	const color = getEmbedColor(chatMessage);
	if (color) message.setColor(color);
	return webhook.send(message);
}

function getEmbedColor(message: YouTubeLiveChatMessage | YtcMessage) {
	if (message.authorDetails.isChatOwner || message.authorDetails.isChatModerator) {
		return 0x5e84f1; // 板手
	}
	let tier = 0;
	switch (message.snippet.type) {
		case "newSponsorEvent":
			return 0x0f9d58; // 深綠
		case "superChatEvent":
			tier = message.snippet.superChatDetails.tier;
			break;
		case "superStickerEvent":
			tier = message.snippet.superStickerDetails.tier;
			break;
	}
	switch (tier) {
		case 1:
			return 0x1e88e5; // 深藍
		case 2:
			return 0x00e5ff; // 藍
		case 3:
			return 0x1de9b6; // 綠
		case 4:
			return 0xffca28; // 黃
		case 5:
			return 0xf57c00; // 橘
		case 6:
			return 0xe91e63; // 紫
		case 7:
		case 8:
			return 0xe62117; // 紅
	}
}

function logChatsCount() {
	global.setTimeout(() => {
		const ytc = ytcHeadless as any;
		if (typeof ytc.count === "function") {
			console.log(`Current recording chats: ${ytc.count()}`);
		}
	}, 10);
}
