const convertTimestampUsec = (timestampUsec: string) => {
	timestampUsec = `${timestampUsec}`;
	const timestamp = +timestampUsec.substr(0, timestampUsec.length - 3);
	return new Date(timestamp).toISOString();
};

const toMessage = (messages: LiveChatTextMessageRun[] = []) => {
	return (
		messages.reduce((acc, msg) => {
			if (msg.text) {
				return acc + msg.text;
			}
			else if (msg.emoji) {
				return acc + msg.emoji.shortcuts.reverse()[0];
			}
			return acc;
		}, "") || ""
	);
};

export const fetchParser = (text: string) => {
	const json = JSON.parse(text);
	const result: YtcMessage[] = [];
	try {
		if (json.continuationContents?.liveChatContinuation.actions) {
			for (let action of json.continuationContents.liveChatContinuation.actions) {
				if (action.replayChatItemAction) {
					action = action.replayChatItemAction.actions[0];
				}

				const chatMessage: LiveChatTextMessageRenderer | LiveChatPaidMessageRenderer = action?.addChatItemAction?.item?.liveChatTextMessageRenderer || action?.addChatItemAction?.item?.liveChatPaidMessageRenderer;

				if (chatMessage) {
					try {
						let snippet: YtcMessageSnippet;
						if (chatMessage.purchaseAmountText) {
							const superChat: YtcMessageSuperChat = {
								type: "superChatEvent",
								superChatDetails: {
									amountDisplayString: chatMessage.purchaseAmountText.simpleText,
									userComment: toMessage(chatMessage.message?.runs),
									tier: 0,
								},
								publishedAt: convertTimestampUsec(chatMessage.timestampUsec),
							};
							switch (chatMessage.bodyBackgroundColor) {
								case 4280191205:
									superChat.superChatDetails.tier = 1;
									break;
								case 4278248959:
									superChat.superChatDetails.tier = 2;
									break;
								case 4280150454:
									superChat.superChatDetails.tier = 3;
									break;
								case 4294953512:
									superChat.superChatDetails.tier = 4;
									break;
								case 4294278144:
									superChat.superChatDetails.tier = 5;
									break;
								case 4293467747:
									superChat.superChatDetails.tier = 6;
									break;
								case 4293271831:
									superChat.superChatDetails.tier = 7; // or 8
									break;
							}
							snippet = superChat;
						}
						else {
							const message = toMessage(chatMessage.message?.runs);
							const textMessage: YtcMessageTextMessage = {
								type: "textMessageEvent",
								displayMessage: message,
								textMessageDetails: {
									messageText: message,
								},
								publishedAt: convertTimestampUsec(chatMessage.timestampUsec),
							};
							snippet = textMessage;
						}
						const msg: YtcMessage = {
							id: chatMessage.id,
							authorDetails: {
								channelId: chatMessage.authorExternalChannelId ?? "",
								channelUrl: chatMessage.authorExternalChannelId ? `https://www.youtube.com/channel/${chatMessage.authorExternalChannelId}` : "",
								displayName: chatMessage.authorName?.simpleText ?? "",
								profileImageUrl: chatMessage.authorPhoto?.thumbnails.find((t, i, a) => !a.find(t2 => t.width < t2.width))?.url ?? "",
								isVerified: false,
								isChatOwner: false,
								isChatSponsor: false,
								isChatModerator: false,
							},
							snippet,
						};
						if (chatMessage.authorBadges) {
							for (const authorBadge of chatMessage.authorBadges) {
								const chatBadge = authorBadge.liveChatAuthorBadgeRenderer;
								const iconType = chatBadge?.icon?.iconType;
								switch (iconType) {
									case "MODERATOR":
										msg.authorDetails.isChatModerator = true;
										break;
									case "VERIFIED":
										msg.authorDetails.isVerified = true;
										break;
									case "OWNER":
										msg.authorDetails.isChatOwner = true;
										break;
									default:
										msg.authorDetails.badgeUrl = chatBadge?.customThumbnail?.thumbnails?.[0]?.url;
										msg.authorDetails.isChatSponsor = true;
										break;
								}
							}
						}
						result.push(msg);
					}
					catch (e) {
						console.error("[ytc] Failed retrieving message informations:", text);
						console.error(chatMessage);
						console.error(e);
					}
				}
				else {
					// console.log('[ytc] Unsupported chat action', action);
				}
			}
		}
		else {
			// console.log('[ytc] Non interesting actions', json);
		}
	}
	catch (e) {
		console.error("[ytc] Fetch interceptor failed parsing:", text);
		console.error(e);
	}
	return result;
};

export interface YtcMessage {
	id: string;
	snippet: YtcMessageSnippet;
	authorDetails: {
		channelId: string;
		channelUrl: string;
		displayName: string;
		profileImageUrl: string;
		isVerified: boolean;
		isChatOwner: boolean;
		isChatSponsor: boolean;
		isChatModerator: boolean;
		badgeUrl?: string;
	};
}

export interface YtcMessageSnippetBase {
	publishedAt: string;
}

type YtcMessageSnippet = YtcMessageTextMessage | YtcMessageSuperChat;

export interface YtcMessageTextMessage extends YtcMessageSnippetBase {
	type: "textMessageEvent";
	displayMessage: string;
	textMessageDetails: {
		messageText: string;
	};
}

export interface YtcMessageSuperChat extends YtcMessageSnippetBase {
	type: "superChatEvent";
	superChatDetails: {
		amountDisplayString: string;
		userComment: string;
		tier: number;
	};
}

interface LiveChatTextMessageRenderer {
	id: string;
	timestampUsec: string;

	authorName: LiveChatSimpleText;
	authorPhoto: LiveChatAuthorPhoto;
	authorExternalChannelId: string;
	authorBadges?: LiveChatAuthorBadge[];

	message: LiveChatTextMessage;

	purchaseAmountText: undefined;
}

interface LiveChatPaidMessageRenderer {
	id: string;
	timestampUsec: string;

	authorName: LiveChatSimpleText;
	authorPhoto: LiveChatAuthorPhoto;
	authorExternalChannelId: string;
	authorBadges?: LiveChatAuthorBadge[];
	authorNameTextColor: number;

	message: LiveChatTextMessage;

	purchaseAmountText: LiveChatSimpleText;
	headerBackgroundColor: number;
	headerTextColor: number;
	bodyBackgroundColor: number;
	bodyTextColor: number;
	timestampColor: number;
}

interface LiveChatAuthorBadge {
	liveChatAuthorBadgeRenderer: LiveChatAuthorBadgeRenderer | LiveChatAuthorBadgeRendererMod;
}

interface LiveChatAuthorBadgeRenderer {
	customThumbnail: LiveChatAuthorBadgeCustomThumbnail;
	icon: undefined;
	tooltip: string;
}

interface LiveChatAuthorBadgeRendererMod {
	customThumbnail: undefined;
	icon: LiveChatAuthorBadgeIcon;
	tooltip: string;
}

interface LiveChatAuthorBadgeIcon {
	iconType: string;
}

interface LiveChatAuthorBadgeCustomThumbnail {
	thumbnails: LiveChatAuthorBadgeThumbnail[];
}

interface LiveChatAuthorBadgeThumbnail {
	url: string;
}

interface LiveChatSimpleText {
	simpleText: string;
}

interface LiveChatAuthorPhoto {
	thumbnails: LiveChatAuthorPhotoThumbnail[];
}

interface LiveChatAuthorPhotoThumbnail {
	url: string;
	width: number;
	height: number;
}

interface LiveChatTextMessage {
	runs: LiveChatTextMessageRun[];
}

type LiveChatTextMessageRun = LiveChatTextMessageText | LiveChatTextMessageEmoji;

interface LiveChatTextMessageText {
	text: string;
	emoji: undefined;
}

interface LiveChatTextMessageEmoji {
	text: undefined;
	emoji: LiveChatEmoji;
}

interface LiveChatEmoji {
	emojiId: string;
	shortcuts: string[];
	searchTerms: string[];
	image: LiveChatEmojiImage;
	isCustomEmoji: boolean;
}

interface LiveChatEmojiImage {
	thumbnails: LiveChatEmojiThumbnail[];
}

interface LiveChatEmojiThumbnail {
	url: string;
	width: number;
	height: number;
}
