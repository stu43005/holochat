import Client from "@holores/holoapi";
import { LiveLivestream } from "@holores/holoapi/dist/types";
import config from "config";
import { MessageEmbed, WebhookClient } from "discord.js";
import { YouTubeLiveChatMessage } from "youtube-live-chat-ts";
import { cache } from "./cache";
import { getRealAmount, secondsToHms } from "./utils";
import { MyYouTubeLiveChat } from "./youtube-live-chat";

const KEY_YOUTUBE_LIVE_IDS = "youtube_live_ids";

const holoapi = new Client();
const ytchat = new MyYouTubeLiveChat(config.get<string>("google_api_key"));
const webhook = new WebhookClient(config.get<string>("discord_id"), config.get<string>("discord_token"));

const channels = config.has("channels") ? config.get<string[]>("channels") : [];

export async function fetchChannel() {
	const lives = await holoapi.videos.getLivestreams();
	for (const live of lives.live) {
		const videoId = live.youtubeId;
		if (!videoId) continue;
		if (channels.length && !channels.includes(live.channel.youtubeId)) continue; // Not in channel list

		cache.set(videoId, live);
		if (cache.sismember(KEY_YOUTUBE_LIVE_IDS, videoId)) continue; // already started

		return startChatRecord(videoId).catch(error => {
			console.error(`Start record error: ${videoId}:`, error.toString());
		});
	}
}

async function startChatRecord(videoId: string) {
	cache.sadd(KEY_YOUTUBE_LIVE_IDS, videoId);
	const liveChatId = await ytchat.getLiveChatIdFromVideoId(videoId);
	if (!liveChatId) return false;

	ytchat.listen(liveChatId, () => {
		const live = cache.get<LiveLivestream>(videoId);
		if ((live?.viewers ?? 0) >= 10000) return 10 * 1000;
		return 60 * 1000;
	}).subscribe(
		chatMessage => {
			const live = cache.get<LiveLivestream>(videoId);
			if (live) {
				parseMessage(live, chatMessage);
			}
		},
		error => {
			console.error(error);
		},
		() => {
			cache.srem(KEY_YOUTUBE_LIVE_IDS, videoId);
			console.log(`Stop record: ${videoId}`);
		}
	);
	console.log(`Start record: ${videoId}`);
}

function parseMessage(live: LiveLivestream, message: YouTubeLiveChatMessage) {
	const videoId = live.youtubeId;
	const userName = message.authorDetails.displayName;
	const publishedAt = new Date(message.snippet.publishedAt);
	const isBeforeStream = !live.startDate || live.startDate > publishedAt;
	const time = isBeforeStream ? 0 : Math.floor((publishedAt.getTime() - live.startDate.getTime()) / 1000);
	const timeCode = secondsToHms(time);

	let log = false;
	let content = "";
	let amountDisplayString = "￥0";
	let amountMicros = 0;
	let currency = "";

	switch (message.snippet.type) {
		case "newSponsorEvent":
			content = (message.snippet as any).displayMessage ?? "";
			break;
		case "superChatEvent":
			amountDisplayString = message.snippet.superChatDetails.amountDisplayString;
			amountMicros = message.snippet.superChatDetails.amountMicros;
			currency = message.snippet.superChatDetails.currency;
			content = `${message.snippet.superChatDetails.userComment ?? ""} (${amountDisplayString}, ${message.snippet.superChatDetails.tier})`;
			break;
		case "superStickerEvent":
			amountDisplayString = message.snippet.superStickerDetails.amountDisplayString;
			amountMicros = message.snippet.superStickerDetails.amountMicros;
			currency = message.snippet.superStickerDetails.currency;
			content = `${message.snippet.superStickerDetails.superStickerMetadata.altText ?? ""} (${amountDisplayString}, ${message.snippet.superStickerDetails.tier})`;
			break;
		case "textMessageEvent":
			content = message.snippet.textMessageDetails.messageText;
			if (message.authorDetails.isChatOwner || message.authorDetails.isChatModerator) log = true;
			break;
	}

	const realAmount = getRealAmount(amountMicros, currency);

	if (log) {
		console.log(`[${videoId}][${timeCode}] ${userName}: ${content}`);
		postDiscord(live, message, content, time);
	}
}

function postDiscord(live: LiveLivestream, chatMessage: YouTubeLiveChatMessage, content: string, time: number) {
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

function getEmbedColor(message: YouTubeLiveChatMessage) {
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

