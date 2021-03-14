import { Counter } from "prom-client";

export const counterReceiveMessages = new Counter({
	name: "holochat_receive_messages",
	help: "Number of received chat messages",
	labelNames: ["channelId", "channelName", "videoId", "title"],
});

export const counterModeratorMessages = new Counter({
	name: "holochat_moderator_messages",
	help: "Number of received moderators chat messages",
	labelNames: ["channelId", "channelName", "videoId", "title"],
});
