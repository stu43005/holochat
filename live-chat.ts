import config from "config";
import { MessageEmbed, WebhookClient } from "discord.js";
import * as fs from "fs/promises";
import type { Video } from "holodex.js";
import { ExtraData, VideoStatus, VideoType } from "holodex.js";
import { AddPollResultAction, AddRedirectBannerAction, MasterchatError, ModeChangeAction, StreamPool, stringify } from "masterchat";
import moment from "moment";
import path from "path";
import { cache } from "./cache";
import { getLiveVideos, getLiveVideosByChannelId, getVideo, getVideos } from "./holodex";
import { checkIsMarked, CustomChatItem, parseMessage, runsToStringOptions } from "./masterchat-parser";
import { addMessageMetrics, delayRemoveVideoMetrics, deleteRemoveMetricsTimer, initVideoMetrics, restoreAllMetrics, updateVideoEnding, updateVideoMetrics } from "./metrics";
import { secondsToHms } from "./utils";

const KEY_YOUTUBE_LIVE_IDS = "youtube_live_ids";

const masterchatManager = new StreamPool({ mode: "live" });
const webhook = new WebhookClient({
	id: config.get<string>("discord_id"),
	token: config.get<string>("discord_token"),
});
const webhook2 = config.has("discord_id_full") ? new WebhookClient({
	id: config.get<string>("discord_id_full"),
	token: config.get<string>("discord_token_full"),
}) : null;
const extraChannels = config.has("extraChannels") ? config.get<string[]>("extraChannels") : [];

let inited = false;

export async function fetchChannel() {
	const t = moment();
	const lives = await getLiveVideos("Hololive");
	const ended = await getVideos({
		org: "Hololive",
		status: VideoStatus.Past,
		type: VideoType.Stream,
		include: [ExtraData.LiveInfo],
	});
	if (extraChannels && extraChannels.length) {
		const lives2 = await getLiveVideosByChannelId(extraChannels);
		lives2.forEach(video => {
			lives.push(video);
		});
	}
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

	masterchatManager.subscribe(live.videoId, live.channel.channelId, {
		ignoreFirstResponse: true,
	});

	console.log(`Start record: ${videoId}`);
	logChatsCount();
}

async function stopChatRecord(videoId: string, onError = false) {
	cache.srem(KEY_YOUTUBE_LIVE_IDS, videoId);

	const live = await getVideo(videoId);
	if (live) {
		delayRemoveVideoMetrics(live);
	}

	masterchatManager.unsubscribe(videoId);

	console.log(`Stop record: ${videoId}`);
	logChatsCount();
}

//#region delay stop

const stopRecordTimer: Record<string, NodeJS.Timeout> = {};
const stopRecordTimerMs = 10 * 60 * 1000;

export function delayStopRecord(videoId: string) {
	if (!stopRecordTimer[videoId]) {
		stopRecordTimer[videoId] = global.setTimeout(async () => {
			await stopChatRecord(videoId);
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

masterchatManager.addListener("actions", async (actions, mc) => {
	const live = await getVideo(mc.videoId);
	if (live) {
		for (const chat of actions) {
			// console.log(chat.authorName, runsToString(chat.rawMessage));

			switch (chat.type) {
				case "addChatItemAction":
				case "addSuperChatItemAction":
				case "addSuperStickerItemAction":
				case "addMembershipItemAction":
				case "addMembershipMilestoneItemAction":
				case "membershipGiftRedemptionAction":
				case "membershipGiftPurchaseAction":
					parseMessage(live, chat)
						.then(chatItem => onChatItem(live, chatItem));

					// if (chat.rawMessage?.some(run => (run as any).navigationEndpoint)) {
					// 	writeDebugJson(live, `navigationEndpoint-${chat.id}`, chat);
					// }
					break;

				case "modeChangeAction":
					onModeChange(live, chat);
					break;
				case "addPollResultAction":
					// writeDebugJson(live, `addPollResultAction-${chat.id}`, chat);
					onPollResult(live, chat);
					break;
				case "addRedirectBannerAction":
					onRaidIncoming(live, chat);
					break;
			}
		}
	}
});

masterchatManager.addListener("end", async (metadata, mc) => {
	const live = await getVideo(mc.videoId);
	if (live && !live.actualEnd) {
		updateVideoEnding(live, new Date());
	}
	await stopChatRecord(mc.videoId);
});

masterchatManager.addListener("error", async (error, mc) => {
	if (error instanceof MasterchatError) {
		console.error(`[${mc.videoId}] ${error.message}`);
		// "disabled" => Live chat is disabled
		// "membersOnly" => No permission (members-only)
		// "private" => No permission (private video)
		// "unavailable" => Deleted OR wrong video id
		// "unarchived" => Live stream recording is not available
		// "denied" => Access denied
		// "invalid" => Invalid request
		// "unknown" => Unknown error
	}
	else {
		console.error(`[${mc.videoId}]`, error);
	}
	await stopChatRecord(mc.videoId, true);
});

//#endregion

//#region chat item

async function onChatItem(live: Video, chatItem: CustomChatItem) {
	const isImportant = chatItem.isOwner || chatItem.isModerator || chatItem.isMarked;
	if (isImportant) {
		console.log(`[${live.videoId}][${chatItem.timeCode}] ${chatItem.authorName}${chatItem.authorTags.length ? `(${chatItem.authorTags.join(",")})` : ""}: ${chatItem.message}`);
	}
	if (
		/^[[(]?(?:cht?|cn|tw|zh|中(?:譯|文)?(?:CHT)?)[\|\]): -]/i.test(chatItem.message)
		|| chatItem.type === "addSuperChatItemAction"
		|| chatItem.type === "addSuperStickerItemAction"
		|| chatItem.type === "addMembershipItemAction"
		|| chatItem.type === "addMembershipMilestoneItemAction"
		|| chatItem.type === "membershipGiftRedemptionAction"
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
	if (chatItem.authorName) {
		message.setAuthor({
			name: chatItem.authorName,
			iconURL: chatItem.authorPhoto,
			url: `https://www.youtube.com/channel/${chatItem.authorChannelId}`,
		});
	}
	message.setTitle(`To ${live.channel.name} • At ${secondsToHms(chatItem.time)}`);
	message.setURL(`https://youtu.be/${live.videoId}?t=${chatItem.time}`);
	message.setThumbnail(`https://i.ytimg.com/vi/${live.videoId}/mqdefault.jpg`);
	message.setDescription(chatItem.message);
	message.setFooter({
		text: live.title,
		iconURL: live.channel.avatarUrl,
	});
	message.setTimestamp(chatItem.timestamp);
	if (chatItem.image) message.setImage(chatItem.image);
	const color = getEmbedColor(chatItem);
	if (color) message.setColor(color);
	return webhook.send({ embeds: [message] });
}

function getEmbedColor(message: CustomChatItem) {
	if (message.isOwner) {
		return 0xffd600; // 台主
	}
	if (message.isModerator) {
		return 0x5e84f1; // 板手
	}
	if (
		message.type === "addMembershipItemAction" ||
		message.type === "addMembershipMilestoneItemAction" ||
		message.type === "membershipGiftPurchaseAction" ||
		message.type === "membershipGiftRedemptionAction"
	) {
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

//#endregion

//#region poll

function onPollResult(live: Video, action: AddPollResultAction) {
	if (!checkIsMarked(live.channelId)) return;

	const actionTime = new Date();
	const isBeforeStream = !live.actualStart || live.actualStart > actionTime;
	const time = isBeforeStream ? 0 : Math.floor((actionTime.getTime() - live.actualStart!.getTime()) / 1000);

	const message = new MessageEmbed();
	message.setAuthor({
		name: live.channel.name,
		iconURL: live.channel.avatarUrl,
		url: `https://www.youtube.com/channel/${live.channel.channelId}`,
	});
	message.setTitle(`Poll • At ${secondsToHms(time)} • ${action.total} votes`);
	message.setURL(`https://youtu.be/${live.videoId}?t=${time}`);
	message.setThumbnail(`https://i.ytimg.com/vi/${live.videoId}/mqdefault.jpg`);
	message.setDescription(`${action.question ? stringify(action.question, runsToStringOptions) : ""}
${action.choices.map(choice => `${stringify(choice.text, runsToStringOptions)} (${choice.votePercentage})`).join("\n")}`);
	message.setFooter({
		text: live.title,
		iconURL: live.channel.avatarUrl,
	});
	message.setTimestamp(actionTime);
	return webhook.send({ embeds: [message] });
}

//#endregion

//#region mode change

function onModeChange(live: Video, chat: ModeChangeAction) {
	if (!checkIsMarked(live.channelId)) return;

	const now = new Date();
	const isBeforeStream = !live.actualStart || live.actualStart > now;
	const time = isBeforeStream ? 0 : Math.floor((now.getTime() - live.actualStart!.getTime()) / 1000);

	const message = new MessageEmbed();
	message.setAuthor({
		name: live.channel.name,
		iconURL: live.channel.avatarUrl,
		url: `https://www.youtube.com/channel/${live.channel.channelId}`,
	});
	message.setTitle(`Mode changed • At ${secondsToHms(time)}`);
	message.setURL(`https://youtu.be/${live.videoId}?t=${time}`);
	message.setThumbnail(`https://i.ytimg.com/vi/${live.videoId}/mqdefault.jpg`);
	message.setDescription(chat.description);
	message.addField("Enabled", `${chat.enabled}`, true);
	message.addField("Mode", `${chat.mode}`, true);
	message.setFooter({
		text: live.title,
		iconURL: live.channel.avatarUrl,
	});
	message.setTimestamp(now);
	return webhook.send({ embeds: [message] });
}

//#endregion

//#region raid event notifications

function onRaidIncoming(live: Video, chat: AddRedirectBannerAction) {
	if (!checkIsMarked(live.channelId)) return;

	const now = new Date();
	const isBeforeStream = !live.actualStart || live.actualStart > now;
	const time = isBeforeStream ? 0 : Math.floor((now.getTime() - live.actualStart!.getTime()) / 1000);

	const message = new MessageEmbed();
	message.setAuthor({
		name: chat.authorName,
		iconURL: chat.authorPhoto,
	});
	message.setTitle(`Raid Event • At ${secondsToHms(time)}`);
	message.setURL(`https://youtu.be/${live.videoId}?t=${time}`);
	message.setThumbnail(`https://i.ytimg.com/vi/${live.videoId}/mqdefault.jpg`);
	message.setDescription(`${chat.authorName} and their viewers just joined. Say hello!`);
	message.setFooter({
		text: live.title,
		iconURL: live.channel.avatarUrl,
	});
	message.setTimestamp(now);
	return webhook.send({ embeds: [message] });
}

//#endregion

function logChatsCount() {
	global.setTimeout(() => {
		// const lived = cache.get<string[]>(KEY_YOUTUBE_LIVE_IDS) ?? [];
		console.log(`Current recording chats: ${masterchatManager.streamCount()}`);
	}, 10);
}

function delay(sec: number) {
	return new Promise((resolve) => global.setTimeout(resolve, sec));
}

async function writeDebugJson(live: Video, name: string, obj: any) {
	const json = JSON.stringify(obj, null, 2);
	const outPath = `debug/${live.videoId}-${name}.json`;
	try {
		await fs.mkdir(path.dirname(outPath)).catch(e => {});
		await fs.writeFile(outPath, json);
	}
	catch (e) {
		console.error("[writeDebugJson]", e, json);
	}
}
