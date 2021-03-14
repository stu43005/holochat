const convertTimestampUsec = (timestampUsec: string) => {
	timestampUsec = `${timestampUsec}`;
	const timestamp = +timestampUsec.substr(0, timestampUsec.length - 3);
	return new Date(timestamp).toISOString();
};

const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()!@:%_\+.~#?&\/\/=]*)/;
const getNavigationEndpointUrl = (navigationEndpoint: string | NavigationEndpoint | Record<string, any>): string | undefined => {
	if (!navigationEndpoint) return;
	if (typeof navigationEndpoint === "string") {
		if (urlRegex.test(navigationEndpoint)) return navigationEndpoint;
		return;
	}
	if (navigationEndpoint?.urlEndpoint?.url) return navigationEndpoint?.urlEndpoint?.url;
	return Object.values(navigationEndpoint).find(element => getNavigationEndpointUrl(element));
};

const toMessage = (message: LiveChatTextMessage) => {
	if (message?.simpleText) return message.simpleText;
	if (!message?.runs) return "";
	return message.runs.reduce((acc, msg) => {
		if (msg.emoji) {
			return acc + msg.emoji.shortcuts.reverse()[0];
		}
		if (msg.text) {
			if (msg.navigationEndpoint) {
				const url = getNavigationEndpointUrl(msg.navigationEndpoint);
				if (url) {
					return acc + `[${msg.text}](${url})`;
				}
			}
			return acc + msg.text;
		}
		return acc;
	}, "");
};

export const fetchParser = (json: any) => {
	const result: YtcMessage[] = [];
	try {
		if (json.continuationContents?.liveChatContinuation.actions) {
			for (let action of json.continuationContents.liveChatContinuation.actions) {
				if (action.replayChatItemAction) {
					action = action.replayChatItemAction.actions[0];
				}

				const textRenderer: LiveChatTextMessageRenderer | undefined = action?.addChatItemAction?.item?.liveChatTextMessageRenderer;
				const paidMessageRenderer: LiveChatPaidMessageRenderer | undefined = action?.addChatItemAction?.item?.liveChatPaidMessageRenderer;
				const membershipItemRenderer: LiveChatMembershipItemRenderer | undefined = action?.addChatItemAction?.item?.liveChatMembershipItemRenderer;
				const chatMessage = textRenderer || paidMessageRenderer || membershipItemRenderer;

				if (chatMessage) {
					try {
						let snippet: YtcMessageSnippet | undefined;
						if (paidMessageRenderer) {
							const superChat: YtcMessageSuperChat = {
								type: "superChatEvent",
								superChatDetails: {
									amountDisplayString: paidMessageRenderer.purchaseAmountText.simpleText,
									userComment: toMessage(paidMessageRenderer.message),
									tier: 0,
								},
								publishedAt: convertTimestampUsec(paidMessageRenderer.timestampUsec),
							};
							switch (paidMessageRenderer.bodyBackgroundColor) {
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
						else if (membershipItemRenderer) {
							const message = toMessage(membershipItemRenderer.headerSubtext);
							const newSponsor: YtcMessageNewSponsor = {
								type: "newSponsorEvent",
								displayMessage: message,
								publishedAt: convertTimestampUsec(chatMessage.timestampUsec),
							};
							snippet = newSponsor;
						}
						else if (textRenderer) {
							const message = toMessage(textRenderer.message);
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
						if (!snippet) continue;
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
						console.error("[ytc] Failed retrieving message informations:", json);
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
		console.error("[ytc] Fetch interceptor failed parsing:", json);
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

type YtcMessageSnippet = YtcMessageTextMessage | YtcMessageSuperChat | YtcMessageNewSponsor;

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

export interface YtcMessageNewSponsor extends YtcMessageSnippetBase {
	type: "newSponsorEvent";
	displayMessage: string;
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

interface LiveChatMembershipItemRenderer {
	id: string;
	timestampUsec: string;

	authorName: LiveChatSimpleText;
	authorPhoto: LiveChatAuthorPhoto;
	authorExternalChannelId: string;
	authorBadges: LiveChatAuthorBadge[];

	headerSubtext: LiveChatTextMessage;
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
	simpleText?: string;
}

type LiveChatTextMessageRun = LiveChatTextMessageText | LiveChatTextMessageEmoji;

interface LiveChatTextMessageText {
	text: string;
	navigationEndpoint?: string | NavigationEndpoint;
	emoji: undefined;
}

interface NavigationEndpoint {
	urlEndpoint: UrlEndpoint
}

interface UrlEndpoint {
	url: string;
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
