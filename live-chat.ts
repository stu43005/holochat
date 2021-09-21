import config from "config";
import { MessageEmbed, WebhookClient } from "discord.js";
import { ExtraData, HolodexApiClient, Video, VideoStatus, VideoType } from "holodex.js";
import { CloseLiveChatActionPanelAction, MasterchatError, MasterchatManager, ShowLiveChatActionPanelAction, UpdateLiveChatPollAction } from "masterchat";
import moment from "moment";
import { cache } from "./cache";
import { CustomChatItem, parseMembershipItemAction, parseMessage, parseSuperStickerItemAction } from "./masterchat-parser";
import { addMessageMetrics, delayRemoveVideoMetrics, deleteRemoveMetricsTimer, initVideoMetrics, restoreAllMetrics, updateVideoEnding, updateVideoMetrics } from "./metrics";
import { secondsToHms } from "./utils";
import { toMessage } from "./ytc-fetch-parser";

const KEY_YOUTUBE_LIVE_IDS = "youtube_live_ids";

const holoapi = new HolodexApiClient({
	apiKey: config.get<string>("holodex_apikey"),
});
const masterchatManager = new MasterchatManager({ isLive: true });
const webhook = new WebhookClient(config.get<string>("discord_id"), config.get<string>("discord_token"));
const webhook2 = config.has("discord_id_full") ? new WebhookClient(config.get<string>("discord_id_full"), config.get<string>("discord_token_full")) : null;

// const messageFilters: Record<string, BloomFilter> = {};
let inited = false;

function delay(sec: number) {
	return new Promise((resolve) => global.setTimeout(resolve, sec));
}

export async function fetchChannel() {
	const t = moment();
	const lives = await holoapi.getLiveVideos({
		org: "Hololive",
	});
	const ended = await holoapi.getVideos({
		org: "Hololive",
		status: VideoStatus.Past,
		type: VideoType.Stream,
		include: [ExtraData.LiveInfo],
	});
	for (const video of ended) {
		if (video.actualEnd) {
			const actualEnd = moment(video.actualEnd);
			const r = actualEnd.add(10, "minute");
			if (t.isSameOrBefore(r)) {
				lives.push(video);
			}
		}
	}

	if (!inited) {
		inited = true;
		restoreAllMetrics(lives);
	}

	const lived = cache.get<string[]>(KEY_YOUTUBE_LIVE_IDS) ?? [];
	for (const videoId of lived) {
		const live = lives.find(l => l.videoId === videoId);
		if (live) {
			deleteStopRecordTimer(videoId);
			continue;
		}

		delayStopRecord(videoId);
	}

	for (const live of lives) {
		const videoId = live.videoId;
		if (!videoId) continue;
		// if (channels.length && !channels.includes(live.channel.youtubeId)) continue; // Not in channel list

		cache.set(videoId, live);
		if (masterchatManager.has(videoId)) {
			// already started
			updateVideoMetrics(live);
			continue;
		}

		startChatRecord(live).catch(error => {
			console.error(`Start record error: ${videoId}:`, error.toString());
		});

		await delay(1000);
	}
}

async function startChatRecord(live: Video) {
	const videoId = live.videoId;
	cache.sadd(KEY_YOUTUBE_LIVE_IDS, videoId);

	deleteStopRecordTimer(videoId);
	deleteRemoveMetricsTimer(videoId);
	initVideoMetrics(live);

	// messageFilters[videoId] = BloomFilter.create(100000, 0.02);
	masterchatManager.subscribe(live.videoId, live.channel.channelId, {
		ignoreFirstResponse: true,
	});

	console.log(`Start record: ${videoId}`);
	logChatsCount();
}

function stopChatRecord(videoId: string, onError = false) {
	cache.srem(KEY_YOUTUBE_LIVE_IDS, videoId);

	const live = cache.get<Video>(videoId);
	if (live) {
		delayRemoveVideoMetrics(live);
	}

	// delete messageFilters[videoId];
	masterchatManager.unsubscribe(videoId);

	console.log(`Stop record: ${videoId}`);
	logChatsCount();
}

//#region delay stop

const stopRecordTimer: Record<string, NodeJS.Timeout> = {};
const stopRecordTimerMs = 10 * 60 * 1000;

export function delayStopRecord(videoId: string) {
	if (!stopRecordTimer[videoId]) {
		stopRecordTimer[videoId] = global.setTimeout(() => {
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

//#region masterchat listeners

masterchatManager.addListener("actions", (metadata, actions) => {
	const live = cache.get<Video>(metadata.videoId);
	if (live) {
		const chats = actions.filter(
			(action) => [
				"addChatItemAction",
				"addSuperChatItemAction",
				"addSuperStickerItemAction",
				"addMembershipItemAction",
				"showLiveChatActionPanelAction",
				"updateLiveChatPollAction",
				"closeLiveChatActionPanelAction",
			].includes(action.type)
		);

		for (const chat of chats) {
			// console.log(chat.authorName, runsToString(chat.rawMessage));

			// if (messageFilters[videoId]?.has(chat.id)) {
			// 	counterFilterTestFailed.labels(getVideoLabel(newlive)).inc(1);
			// 	return;
			// }
			// messageFilters[videoId]?.add(chat.id);
			if (chat.type === "addChatItemAction" || chat.type === "addSuperChatItemAction") {
				parseMessage(live, chat)
					.then(chatItem => doChatItem(live, chatItem));
			}
			else if (chat.type === "addSuperStickerItemAction") {
				parseMessage(live, parseSuperStickerItemAction(chat))
					.then(chatItem => doChatItem(live, chatItem));
			}
			else if (chat.type === "addMembershipItemAction") {
				parseMessage(live, parseMembershipItemAction(chat))
					.then(chatItem => doChatItem(live, chatItem));
			}
			else if (chat.type === "showLiveChatActionPanelAction") {
				// open poll
				startPoll(live, chat);
			}
			else if (chat.type === "updateLiveChatPollAction") {
				// update poll
				updatePoll(live, chat);
			}
			else if (chat.type === "closeLiveChatActionPanelAction") {
				// close poll
				closePoll(live, chat);
			}
		}
	}
});

masterchatManager.addListener("end", (metadata, reason) => {
	if (!reason) {
		const live = cache.get<Video>(metadata.videoId);
		if (live) {
			updateVideoEnding(live, new Date());
		}
	}
	stopChatRecord(metadata.videoId);
});

masterchatManager.addListener("error", (metadata, error) => {
	console.error(error);
	if (error instanceof MasterchatError) {
		switch (error.code) {
			case "membersOnly":
			case "private":
				// dont remove metrics
				return;
		}
		// "disabled" => Live chat is disabled
		// "membersOnly" => No permission (members-only)
		// "private" => No permission (private video)
		// "unavailable" => Deleted OR wrong video id
		// "unarchived" => Live stream recording is not available
		// "denied" => Access denied
		// "invalid" => Invalid request
		// "unknown" => Unknown error
	}
	stopChatRecord(metadata.videoId, true);
});

//#endregion

async function doChatItem(live: Video, chatItem: CustomChatItem) {
	const isImportant = chatItem.isOwner || chatItem.isModerator || chatItem.isMarked;
	if (isImportant) {
		console.log(`[${live.videoId}][${chatItem.timeCode}] ${chatItem.authorName}${chatItem.authorTags.length ? `(${chatItem.authorTags.join(",")})` : ""}: ${chatItem.message}`);
	}
	if (
		/^[[(]?(?:cht?|cn|tw|zh|中(?:譯|文)?(?:CHT)?)[\|\]): -]/i.test(chatItem.message)
		|| chatItem.type === "addSuperChatItemAction"
		|| chatItem.type === "addSuperStickerItemAction"
		|| isImportant
	) {
		if (webhook2) {
			postDiscord(webhook2, live, chatItem);
		}
	}
	if (chatItem.isMarked) {
		postDiscord(webhook, live, chatItem);
	}

	updateVideoMetrics(live);
	addMessageMetrics(live, chatItem);
}

function postDiscord(webhook: WebhookClient, live: Video, chatItem: CustomChatItem) {
	const message = new MessageEmbed();
	message.setAuthor(chatItem.authorName, chatItem.authorPhoto, `https://www.youtube.com/channel/${chatItem.authorChannelId}`);
	message.setTitle(`To ${live.channel.name} • At ${secondsToHms(chatItem.time)}`);
	message.setURL(`https://youtu.be/${live.videoId}?t=${chatItem.time}`);
	message.setThumbnail(`https://i.ytimg.com/vi/${live.videoId}/mqdefault.jpg`);
	message.setDescription(chatItem.message);
	message.setFooter(live.title, live.channel.avatarUrl);
	message.setTimestamp(chatItem.timestamp);
	const color = getEmbedColor(chatItem);
	if (color) message.setColor(color);
	return webhook.send(message);
}

type YTLiveChatPollRenderer = Omit<UpdateLiveChatPollAction, "type">;

interface PollInfo {
	openTime: Date;
	targetId: string;
	pollRender: YTLiveChatPollRenderer;
}

const pollInfos: Map<string, PollInfo> = new Map();

function startPoll(live: Video, action: ShowLiveChatActionPanelAction) {
	const poll = action.contents.pollRenderer;
	const pollInfo: PollInfo = {
		openTime: new Date(),
		targetId: action.targetId,
		pollRender: poll,
	};
	pollInfos.set(poll.liveChatPollId, pollInfo);
	return postPollDiscord(webhook, live, pollInfo);
}

function updatePoll(live: Video, poll: UpdateLiveChatPollAction) {
	const pollInfo = pollInfos.get(poll.liveChatPollId);
	if (pollInfo) {
		pollInfo.pollRender = poll;
		pollInfos.set(poll.liveChatPollId, pollInfo);
	}
}

function closePoll(live: Video, action: CloseLiveChatActionPanelAction) {
	const pollInfo = [...pollInfos.entries()].find(i => i[1].targetId === action.targetPanelId);
	if (pollInfo) {
		pollInfos.delete(pollInfo[0]);
		return postPollDiscord(webhook, live, pollInfo[1]);
	}
}

function postPollDiscord(webhook: WebhookClient, live: Video, pollInfo: PollInfo) {
	const poll = pollInfo.pollRender;
	const isBeforeStream = !live.actualStart || live.actualStart > pollInfo.openTime;
	const time = isBeforeStream ? 0 : Math.floor((pollInfo.openTime.getTime() - live.actualStart!.getTime()) / 1000);

	const message = new MessageEmbed();
	message.setAuthor(live.channel.name, live.channel.avatarUrl, `https://www.youtube.com/channel/${live.channel.channelId}`);
	message.setTitle(`Opened poll • At ${secondsToHms(time)}`);
	message.setURL(`https://youtu.be/${live.videoId}?t=${time}`);
	message.setThumbnail(`https://i.ytimg.com/vi/${live.videoId}/mqdefault.jpg`);
	message.setDescription(`${toMessage(poll.header.pollHeaderRenderer.metadataText as any)}
**${poll.header.pollHeaderRenderer.pollQuestion?.simpleText}**
${poll.choices.map((choice, index) => {
	return `${index + 1}. ${choice.text?.simpleText}: ${choice.votePercentage?.simpleText}`;
}).join("\n")}`);
	message.setFooter(live.title, live.channel.avatarUrl);
	message.setTimestamp(pollInfo.openTime);
	return webhook.send(message);
}

function getEmbedColor(message: CustomChatItem) {
	if (message.isOwner || message.isModerator) {
		return 0x5e84f1; // 板手
	}
	if (message.type === "addMembershipItemAction") {
		return 0x0f9d58; // 深綠
	}
	switch (message.scTier) {
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
		// case 8:
			return 0xe62117; // 紅
	}
}

function logChatsCount() {
	global.setTimeout(() => {
		// const lived = cache.get<string[]>(KEY_YOUTUBE_LIVE_IDS) ?? [];
		console.log(`Current recording chats: ${masterchatManager.streamCount()}`);
	}, 10);
}
