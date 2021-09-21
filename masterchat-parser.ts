import config from "config";
import { Video } from "holodex.js";
import { AddChatItemAction, AddMembershipItemAction, AddSuperChatItemAction, AddSuperStickerItemAction, SuperChat, SuperChatSignificance, SUPERCHAT_COLOR_MAP, SUPERCHAT_SIGNIFICANCE_MAP } from "masterchat";
import { guessMessageAuthorType } from "./metrics";
import { currencyToJpyAmount, getCurrencymapItem, secondsToHms } from "./utils";
import { toMessage } from "./ytc-fetch-parser";

const channels = config.has("channels") ? config.get<string[]>("channels") : [];

//#region super sticker action

interface CustomAddSuperStickerItemAction extends Omit<AddSuperChatItemAction, "type" | "superchat"> {
	type: "addSuperStickerItemAction";
	superchat: Omit<SuperChat, "headerBackgroundColor" | "headerTextColor" | "bodyBackgroundColor" | "bodyTextColor">
}

export function parseSuperStickerItemAction(renderer: AddSuperStickerItemAction): CustomAddSuperStickerItemAction {
	const { timestampUsec, authorExternalChannelId: authorChannelId } =
		renderer;

	const timestamp = new Date(parseInt(timestampUsec, 10) / 1000);

	const authorPhoto =
		renderer.authorPhoto.thumbnails[
			renderer.authorPhoto.thumbnails.length - 1
		].url;

	const stickerPhoto =
		renderer.sticker.thumbnails[
			renderer.sticker.thumbnails.length - 1
		].url;

	const AMOUNT_REGEXP = /[\d.,]+/;

	const input = renderer.purchaseAmountText.simpleText;
	const amountString = AMOUNT_REGEXP.exec(input)![0].replace(/,/g, "");

	const amount = parseFloat(amountString);
	const currency = getCurrencymapItem(input.replace(AMOUNT_REGEXP, "").trim()).code;
	const color =
		SUPERCHAT_COLOR_MAP[renderer.backgroundColor.toString() as keyof typeof SUPERCHAT_COLOR_MAP];
	const significance = SUPERCHAT_SIGNIFICANCE_MAP[color];

	const raw: CustomAddSuperStickerItemAction = {
		type: "addSuperStickerItemAction",
		id: renderer.id,
		timestamp,
		timestampUsec,
		rawMessage: [{ text: `[Sticker]:${renderer.sticker.accessibility.accessibilityData.label}:${stickerPhoto}` }],
		authorName: renderer.authorName?.simpleText,
		authorPhoto,
		authorChannelId,
		superchat: {
			amount,
			currency,
			color,
			significance,
		},
	};
	return raw;
}

//#endregion

//#region membership item action

interface CustomAddMembershipItemAction extends Omit<AddChatItemAction, "type" | "isOwner" | "isModerator" | "isVerified"> {
	type: "addMembershipItemAction";
	isSponsor: true;
}

export function parseMembershipItemAction(renderer: AddMembershipItemAction) {
	const { timestampUsec, authorExternalChannelId: authorChannelId } =
		renderer;

	const timestamp = new Date(parseInt(timestampUsec, 10) / 1000);

	const authorPhoto =
		renderer.authorPhoto.thumbnails[
			renderer.authorPhoto.thumbnails.length - 1
		].url;

	const raw: CustomAddMembershipItemAction = {
		type: "addMembershipItemAction",
		id: renderer.id,
		timestamp,
		timestampUsec,
		rawMessage: renderer.headerSubtext.runs,
		authorName: renderer.authorName?.simpleText,
		authorPhoto,
		authorChannelId,
		contextMenuEndpointParams: renderer.contextMenuEndpoint.clickTrackingParams,
		isSponsor: true,
	};
	return raw;
}

//#endregion

type TextedChatItem = AddChatItemAction | AddSuperChatItemAction | CustomAddSuperStickerItemAction | CustomAddMembershipItemAction;

export interface CustomChatItem extends Omit<TextedChatItem, ""> {
	isOwner: boolean;
	isModerator: boolean;
	isVerified: boolean;
	isSponsor: boolean;
	isMarked: boolean;
	authorTags: string[];
	message: string;
	scTier: SuperChatSignificance | 0;
	scAmount: number;
	scCurrency: string;
	scJpyAmount: number;
	isBeforeStream: boolean;
	time: number;
	timeCode: string;
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

export async function parseMessage(live: Video, message: TextedChatItem) {
	const isBeforeStream = !live.actualStart || live.actualStart > message.timestamp;
	const time = isBeforeStream ? 0 : Math.floor((message.timestamp.getTime() - live.actualStart!.getTime()) / 1000);
	const timeCode = secondsToHms(time);

	const chatItem: CustomChatItem = {
		...(message.type === "addChatItemAction" ? {
			...message,
			isSponsor: !!message.membership,
		} : guessMessageAuthorType(live.videoId, message.authorChannelId)),
		...message,
		isMarked: !!(channels.length && channels.includes(message.authorChannelId)),
		authorTags: [],
		message: toMessage({ runs: message.rawMessage as any }),
		scTier: 0,
		scAmount: 0,
		scCurrency: "",
		scJpyAmount: 0,
		isBeforeStream,
		time,
		timeCode,
	};
	chatItem.authorTags = getAuthorTypeTags(chatItem);

	if (message.type === "addSuperChatItemAction" || message.type === "addSuperStickerItemAction") {
		chatItem.scTier = message.superchat.significance;
		chatItem.scAmount = message.superchat.amount;
		chatItem.scCurrency = message.superchat.currency;
		chatItem.message += ` (${chatItem.scCurrency} ${chatItem.scAmount}, ${message.superchat.color}, tier ${message.superchat.significance})`;

		const jpy = await currencyToJpyAmount(chatItem.scAmount, chatItem.scCurrency);
		chatItem.scJpyAmount = jpy.amount;
	}

	return chatItem;
}
