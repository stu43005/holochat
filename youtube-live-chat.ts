import axios from "axios";
import { Subject } from "rxjs";
import { YouTubeErrorObject, YouTubeLiveChatMessage, YouTubeLiveChatResponse, YouTubeSearchResponse, YouTubeVideoListResponse } from "youtube-live-chat-ts";

const SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const SEARCH_QUOTA_USAGE = 100;
const VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";
const VIDEOS_LIST_QUOTA_USAGE = 1;
const LIVE_CHAT_MESSAGES_URL = "https://www.googleapis.com/youtube/v3/liveChat/messages";
const LIVE_CHAT_MESSAGES_LIST_QUOTA = 5; // This was determined to be correct via experimentation on 10/7/20
const LIVE_CHAT_MESSAGE_QUOTA_PER_ITEM = 0; // This *should* be 0, but it's here in case it's not.
const MAX_MAX_RESULTS = 2000;
const MIN_REQUEST_DELAY = 5000;

export class MyYouTubeLiveChat {
	public estimatedQuotaUsed = 0;

	private static subjectCache: { [index: string]: Subject<YouTubeLiveChatMessage> } = {};

	constructor(private apiKey: string) { }

	public async searchChannelForLiveVideoIds(channelId: string) {
		const resp = await axios.get(SEARCH_URL, {
			params: {
				eventType: "live",
				part: "id",
				channelId,
				type: "video",
				key: this.apiKey,
			}
		});
		this.estimatedQuotaUsed += SEARCH_QUOTA_USAGE;
		const respData = resp.data as YouTubeSearchResponse;
		return respData.items.map((i) => i.id.videoId);
	}

	public async getLiveChatIdFromVideoId(id: string) {
		const resp = await axios.get(VIDEOS_URL, {
			params: {
				part: "liveStreamingDetails",
				id,
				key: this.apiKey,
			}
		});
		this.estimatedQuotaUsed += VIDEOS_LIST_QUOTA_USAGE;
		const respData = resp.data as YouTubeVideoListResponse;
		if (respData.items.length === 1) {
			return respData.items[0].liveStreamingDetails.activeLiveChatId;
		}
		else if (respData.items.length === 0) {
			return null;
		}
		else {
			throw new Error(`How are there ${respData.items.length} videos with the same ID (${id}) ?!?!`);
		}
	}

	private async fetchLiveChats(liveChatId: string, pageToken?: string, maxResults?: number) {
		const resp = await axios.get(LIVE_CHAT_MESSAGES_URL, {
			params: {
				liveChatId,
				pageToken,
				maxResults: maxResults || MAX_MAX_RESULTS,
				part: "id,snippet,authorDetails",
				profileImageSize: 16,
				key: this.apiKey,
			}
		});
		const respData = resp.data as YouTubeLiveChatResponse;
		this.estimatedQuotaUsed += LIVE_CHAT_MESSAGES_LIST_QUOTA;
		this.estimatedQuotaUsed += respData.items.length * LIVE_CHAT_MESSAGE_QUOTA_PER_ITEM;
		return respData;
	}

	public listen(liveChatId: string, getRequestDelay?: () => number) {
		if (!MyYouTubeLiveChat.subjectCache[liveChatId]) {
			MyYouTubeLiveChat.subjectCache[liveChatId] = new Subject<YouTubeLiveChatMessage>();
			const resultsFetchLoop = (result: YouTubeLiveChatResponse) => {
				if (MyYouTubeLiveChat.subjectCache[liveChatId].isStopped) {
					return;
				}
				if (!result) {
					MyYouTubeLiveChat.subjectCache[liveChatId].error({
						code: null,
						message: "Unkonwn error occurred - no result object was given",
					} as unknown as YouTubeErrorObject);
				}
				else if (result.error) {
					MyYouTubeLiveChat.subjectCache[liveChatId].error(result.error);
				}
				else {
					let chatEndedFlag = false;
					for (const message of result.items) {
						MyYouTubeLiveChat.subjectCache[liveChatId].next(message);
						if (message.snippet.type === "chatEndedEvent") {
							chatEndedFlag = true;
						}
					}
					if (result.offlineAt || chatEndedFlag) {
						this.stop(liveChatId);
						return;
					}
					global.setTimeout(() => {
						this.fetchLiveChats(liveChatId, result.nextPageToken).then(resultsFetchLoop);
					}, Math.max(result.pollingIntervalMillis, MIN_REQUEST_DELAY, getRequestDelay?.() ?? 0));
				}
			};
			this.fetchLiveChats(liveChatId, undefined, 1).then(resultsFetchLoop);
		}
		return MyYouTubeLiveChat.subjectCache[liveChatId];
	}

	public stop(liveChatId: string) {
		if (MyYouTubeLiveChat.subjectCache[liveChatId]) {
			MyYouTubeLiveChat.subjectCache[liveChatId].complete();
			delete MyYouTubeLiveChat.subjectCache[liveChatId];
		}
	}
}
