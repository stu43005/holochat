import { bold, italic } from "@discordjs/builders";
import config from "config";
import type { Video } from "holodex.js";
import { AddChatItemAction, AddMembershipItemAction, AddMembershipMilestoneItemAction, AddSuperChatItemAction, AddSuperStickerItemAction, endpointToUrl, stringify, SuperChatSignificance, SUPERCHAT_COLOR_MAP, SUPERCHAT_SIGNIFICANCE_MAP, YTTextRun } from "masterchat";
import { guessMessageAuthorType } from "./metrics";
import { currencyToJpyAmount, secondsToHms } from "./utils";

const channels = config.has("channels") ? config.get<string[]>("channels") : [];

type TextedChatItem = AddChatItemAction | AddSuperChatItemAction | AddSuperStickerItemAction | AddMembershipItemAction | AddMembershipMilestoneItemAction;

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
		let text = run.text;
		if (run.navigationEndpoint) {
			const url = endpointToUrl(run.navigationEndpoint);
			if (url) {
				text = `[${text}](${url})`;
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
		message: "message" in action && action.message ? stringify(action.message, runsToStringOptions) : "",
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
	return !!(channels.length && channels.includes(channelId));
}
