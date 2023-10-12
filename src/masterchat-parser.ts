import config from "config";
import { bold, escapeMarkdown, hyperlink, italic } from "discord.js";
import type { Video } from "holodex.js";
import { AddChatItemAction, AddMembershipItemAction, AddMembershipMilestoneItemAction, AddSuperChatItemAction, AddSuperStickerItemAction, endpointToUrl, MembershipGiftPurchaseAction, MembershipGiftRedemptionAction, stringify, SuperChatSignificance, SUPERCHAT_COLOR_MAP, SUPERCHAT_SIGNIFICANCE_MAP, YTTextRun } from "@stu43005/masterchat";
import { guessMessageAuthorType } from "./metrics";
import { currencyToJpyAmount, secondsToHms } from "./utils";

const channels = config.has("channels") ? config.get<string[]>("channels") : [];
const extraChannels = config.has("extraChannels") ? config.get<string[]>("extraChannels") : [];

type TextedChatItem = AddChatItemAction | AddSuperChatItemAction | AddSuperStickerItemAction | AddMembershipItemAction | AddMembershipMilestoneItemAction | MembershipGiftPurchaseAction | MembershipGiftRedemptionAction;

export interface CustomChatItem extends Omit<TextedChatItem, ""> {
	isOwner: boolean;
	isModerator: boolean;
	isVerified: boolean;
	isSponsor: boolean;
	isMarked: boolean;
	authorTags: string[];
	message: string;
	scColor: string;
	scTier: SuperChatSignificance | 0;
	scAmount: number;
	scCurrency: string;
	scJpyAmount: number;
	isBeforeStream: boolean;
	time: number;
	timeCode: string;
	image?: string;
}

function getAuthorTypeTags(chatItem: CustomChatItem) {
	const authorTypeTags: string[] = [
		...(chatItem.isOwner ? ["Owner"] : []),
		...(chatItem.isModerator ? ["Moderator"] : []),
		...(chatItem.isVerified ? ["Verified"] : []),
		...(chatItem.isSponsor ? ["Sponsor"] : []),
		...(chatItem.isMarked ? ["Marked"] : []),
	];
	return authorTypeTags;
}

export const runsToStringOptions = {
	textHandler: (run: YTTextRun): string => {
		let text = escapeMarkdown(run.text);
		if (run.navigationEndpoint) {
			const url = endpointToUrl(run.navigationEndpoint);
			if (url) {
				text = hyperlink(text, url);
			}
		}
		if (run.bold) {
			text = bold(text);
		}
		if (run.italics) {
			text = italic(text);
		}
		return text;
	}
};

function getMessage(action: TextedChatItem): string {
	let message = "message" in action && action.message ? stringify(action.message, runsToStringOptions) : "";
	switch (action.type) {
		case "addMembershipItemAction":
			return action.level ? `歡迎加入 ${action.level}` : "新會員";
		case "addMembershipMilestoneItemAction":
			message += ` (里程碑訊息)`;
			break;
		case "membershipGiftPurchaseAction":
			return `送出了 ${action.amount} 個「${action.channelName}」的會籍`;
		case "membershipGiftRedemptionAction":
			return `獲得了 ${action.senderName} 送出的會籍`;
	}
	return message;
}

export async function parseMessage(live: Video, action: TextedChatItem) {
	const isBeforeStream = !live.actualStart || live.actualStart > action.timestamp;
	const time = isBeforeStream ? 0 : Math.floor((action.timestamp.getTime() - live.actualStart!.getTime()) / 1000);
	const timeCode = secondsToHms(time);
	const guessAuthorType = guessMessageAuthorType(live.videoId, action.authorChannelId);

	const chatItem: CustomChatItem = {
		...action,
		isOwner: "isOwner" in action ? action.isOwner : guessAuthorType.isOwner,
		isModerator: "isModerator" in action ? action.isModerator : guessAuthorType.isModerator,
		isVerified: "isVerified" in action ? action.isVerified : guessAuthorType.isVerified,
		isSponsor: "membership" in action ? !!action.membership : guessAuthorType.isSponsor,
		isMarked: checkIsMarked(action.authorChannelId),
		authorTags: [],
		message: getMessage(action),
		scColor: "color" in action ? action.color : "",
		scTier: "significance" in action ? action.significance : 0,
		scAmount: "amount" in action ? action.amount : 0,
		scCurrency: "currency" in action ? action.currency : "",
		scJpyAmount: 0,
		isBeforeStream,
		time,
		timeCode,
	};
	chatItem.authorTags = getAuthorTypeTags(chatItem);

	if (chatItem.scAmount && chatItem.scCurrency) {
		if (!chatItem.scTier) {
			["moneyChipBackgroundColor", "moneyChipTextColor", "backgroundColor", "authorNameTextColor"].forEach(key => {
				if (key in action) {
					const color = SUPERCHAT_COLOR_MAP[(action as any)[key].toString() as keyof typeof SUPERCHAT_COLOR_MAP];
					if (color) {
						const significance = SUPERCHAT_SIGNIFICANCE_MAP[color];
						chatItem.scColor = color;
						chatItem.scTier = significance;
					}
				}
			});
		}
		chatItem.message += ` (${chatItem.scCurrency} ${chatItem.scAmount}, ${chatItem.scColor}, tier ${chatItem.scTier})`;

		const jpy = await currencyToJpyAmount(chatItem.scAmount, chatItem.scCurrency);
		chatItem.scJpyAmount = jpy.amount;
	}

	if (action.type === "addSuperStickerItemAction") {
		chatItem.image = action.stickerUrl;
	}

	return chatItem;
}

export function checkIsMarked(channelId: string) {
	if (extraChannels?.length && extraChannels.includes(channelId)) {
		return true;
	}
	if (channels?.length && channels.includes(channelId)) {
		return true;
	}
	return false;
}
