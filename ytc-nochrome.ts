import cheerio from "cheerio";
import { exec } from "child_process";
import _ from "lodash";
import fetch, { FetchError } from "node-fetch";
import { Subject } from "rxjs";
import { handleExit } from "./metrics";
import { fetchParser, YtcMessage } from "./ytc-fetch-parser";
import type { GetLiveChatBody, GetLiveChatData, Ytcfg } from "./ytc-nochrome.d";

const defaultFetchHeader: { [key: string]: string } = {
	"accept": "*/*",
	"accept-language": "zh-TW,zh;q=0.9",
	"cache-control": "no-cache",
	"pragma": "no-cache",
	"sec-ch-ua": '"Google Chrome";v="89", "Chromium";v="89", ";Not A Brand";v="99"',
	"sec-ch-ua-mobile": "?0",
	"sec-fetch-dest": "empty",
	"sec-fetch-mode": "same-origin",
	"sec-fetch-site": "same-origin",
	"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36"
};

const getLiveChatPageUrl = (videoId: string) => `https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`;

async function getLiveChatPage(videoId: string) {
	const res = await fetch(getLiveChatPageUrl(videoId), {
		headers: _.merge({}, defaultFetchHeader, {
			"accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
			"sec-fetch-dest": "document",
			"sec-fetch-mode": "navigate",
			"sec-fetch-site": "none",
			"sec-fetch-user": "?1",
			"upgrade-insecure-requests": "1",
		}),
		method: "GET",
	});
	const html = await res.text();
	return html;
}

const _YT_INITIAL_DATA_RE = /(?:window\s*\[\s*["\']ytInitialData["\']\s*\]|ytInitialData)\s*=\s*({.+?})\s*;/;

function parseLiveChatPage(videoId: string, html: string): GetLiveChatData | string | undefined {
	const $ = cheerio.load(html);
	const ytcfgScript = $("script").filter((index, scriptEl) => cheerio.html(scriptEl).includes("INNERTUBE_CONTEXT"));
	const ytcfgText = ytcfgScript.html()?.match(/ytcfg\.set\s*\(\s*({.+?})\s*\)\s*;/)?.[1];
	const ytInitialDataScript = $("script").filter((index, scriptEl) => cheerio.html(scriptEl).includes("ytInitialData"));
	const ytInitialDataText = ytInitialDataScript.html()?.match(_YT_INITIAL_DATA_RE)?.[1];

	if (ytcfgText && ytInitialDataText) {
		const ytcfg: Ytcfg = JSON.parse(ytcfgText);
		const ytInitialData = JSON.parse(ytInitialDataText);

		const firstMessage = ytInitialData?.contents?.messageRenderer?.text?.runs?.[0]?.text;

		const apiKey = ytcfg.INNERTUBE_API_KEY;
		const innertubeContext = ytcfg.INNERTUBE_CONTEXT;
		if (!apiKey || !innertubeContext) return firstMessage;

		const clientName = ytcfg.INNERTUBE_CONTEXT_CLIENT_NAME;
		const clientVersion = ytcfg.INNERTUBE_CONTEXT_CLIENT_VERSION ?? ytcfg.INNERTUBE_CLIENT_VERSION;
		const visitorData = ytcfg.VISITOR_DATA ?? innertubeContext.client.visitorData;
		const liveChatRenderer = ytInitialData?.contents?.liveChatRenderer;

		const body: GetLiveChatBody = _.merge({
			context: innertubeContext
		}, {
			context: {
				client: {
					screenWidthPoints: 1745,
					screenHeightPoints: 852,
					screenPixelDensity: 1,
					screenDensityFloat: 1,
					utcOffsetMinutes: 480,
					userInterfaceTheme: "USER_INTERFACE_THEME_DARK",
					connectionType: "CONN_CELLULAR_4G",
					mainAppWebInfo: {
						graftUrl: `https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`,
						webDisplayMode: "WEB_DISPLAY_MODE_BROWSER"
					},
					timeZone: "Asia/Taipei"
				},
				request: {
					internalExperimentFlags: [],
					consistencyTokenJars: [],
				},
				clickTracking: {
					// clickTrackingParams,
				},
				adSignalsInfo: {
					params: []
				}
			},
			continuation: "",
			webClientInfo: {
				isDocumentHidden: false
			}
		});

		const data: GetLiveChatData = {
			videoId,
			apiKey,
			clientName: `${clientName}`,
			clientVersion,
			visitorData,
			body,
			timeoutMs: 0,
			retry: 0,
		};
		return setLiveChatApiData(data, liveChatRenderer) ?? firstMessage;
	}
}

async function getLiveChatApi(data: GetLiveChatData) {
	const res = await fetch(`https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${data.apiKey}`, {
		headers: _.merge({}, defaultFetchHeader, {
			"content-type": "application/json",
			"referer": getLiveChatPageUrl(data.videoId),
			"x-goog-visitor-id": data.visitorData,
			"x-youtube-client-name": data.clientName,
			"x-youtube-client-version": data.clientVersion,
		}),
		body: JSON.stringify(data.body),
		method: "POST",
	});
	const json = await res.json();
	return json;
}

function parseLiveChatApi(data: GetLiveChatData, json: any) {
	const liveChatContinuation = json?.continuationContents?.liveChatContinuation;
	return setLiveChatApiData(data, liveChatContinuation);
}

const _KNOWN_SEEK_CONTINUATIONS = [
	"playerSeekContinuationData"
];

const _KNOWN_CHAT_CONTINUATIONS = [
	"invalidationContinuationData", "timedContinuationData",
	"liveChatReplayContinuationData", "reloadContinuationData"
];

function setLiveChatApiData(data: GetLiveChatData, liveChatContinuation: any) {
	let noContinuation = true;
	if (liveChatContinuation?.continuations) {
		for (const cont of liveChatContinuation?.continuations) {
			const continuationKey = Object.keys(cont)[0];
			const continuationData = cont[continuationKey];

			if (_KNOWN_CHAT_CONTINUATIONS.includes(continuationKey)) {
				data.body.continuation = continuationData?.continuation;
				data.body.context.clickTracking.clickTrackingParams = continuationData?.clickTrackingParams ?? continuationData?.trackingParams;
				noContinuation = false;
			}
			else if (_KNOWN_SEEK_CONTINUATIONS.includes(continuationKey)) {
				// ignore these continuations
			}
			else {
				console.log(`[ytc] Unknown continuation: ${continuationKey};`, JSON.stringify(cont, null, 2));
			}
			data.timeoutMs = continuationData?.timeoutMs ?? 0;
		}
		if (!noContinuation && data.body.continuation) {
			return data;
		}
	}
}

let globalRetryCount = 0;

export class YtcNoChrome {
	private subjectCache: { [index: string]: Subject<YtcMessage> } = {};

	public count() {
		return Object.keys(this.subjectCache).length;
	}

	public async listen(videoId: string) {
		if (!this.subjectCache[videoId]) {
			this.subjectCache[videoId] = new Subject();

			const nextFetchLoop = (data: GetLiveChatData) => {
				global.setTimeout(async () => {
					try {
						const result = await getLiveChatApi(data);
						const nextData = parseLiveChatApi(data, result);
						if (this.subjectCache[videoId]) {
							const messages = fetchParser(result);
							for (const msg of messages) {
								this.subjectCache[videoId].next(msg);
							}
							if (nextData) {
								nextData.retry = 0;
								globalRetryCount = 0;
								nextFetchLoop(nextData);
							}
							else {
								this.stop(videoId);
							}
						}
					}
					catch (error) {
						if (error instanceof FetchError && data.retry < 5) {
							data.retry++;
							globalRetryCount++;
							nextFetchLoop(data);
							if (globalRetryCount > 100) {
								console.log("[Fatal error] globalRetryCount > 100");
								await handleExit("SIGUSR1", -1, false);
								console.log("[System] rebooting system");
								exec("shutdown -r now", (error, stdout, stderr) => {
									console.log(stdout);
								});
								process.exit(1);
							}
						}
						else {
							this.subjectCache[videoId]?.error(error);
							this.stop(videoId);
						}
					}
				}, Math.min(data.timeoutMs, 8000));
			};

			global.setTimeout(async () => {
				try {
					const html = await getLiveChatPage(videoId);
					const getLiveChatData = parseLiveChatPage(videoId, html);
					if (typeof getLiveChatData === "object") {
						nextFetchLoop(getLiveChatData);
					}
					else if (typeof getLiveChatData === "string") {
						this.subjectCache[videoId]?.error(`Message from ${videoId}: ${getLiveChatData}`);
					}
					else {
						this.subjectCache[videoId]?.error(`Failed fetch ytc page: ${videoId}`);
						this.stop(videoId);
					}
				}
				catch (error) {
					this.subjectCache[videoId]?.error(error);
					this.stop(videoId);
				}
			}, 1);
		}
		return this.subjectCache[videoId];
	}

	public async stop(videoId: string) {
		if (this.subjectCache[videoId]) {
			this.subjectCache[videoId].complete();
			delete this.subjectCache[videoId];
		}
	}
}

async function test() {
	const nextFetchLoop = (data: GetLiveChatData) => {
		global.setTimeout(async () => {
			try {
				const result = await getLiveChatApi(data);
				const nextData = parseLiveChatApi(data, result);
				const messages = fetchParser(result);
				for (const msg of messages) {
					// console.log(msg);
					console.log(`${msg.authorDetails.displayName}: ${(msg as any).snippet.textMessageDetails?.messageText}`);
				}
				if (nextData) {
					nextFetchLoop(nextData);
				}
				else {
					console.log(`Chat end: ${data.videoId}`);
				}
			}
			catch (error) {
				console.error(error);
			}
		}, data.timeoutMs);
	};

	const videoId = "WTU3TIZRUCM";
	try {
		const html = await getLiveChatPage(videoId);
		const getLiveChatData = parseLiveChatPage(videoId, html);
		if (typeof getLiveChatData === "object") {
			nextFetchLoop(getLiveChatData);
		}
	}
	catch (error) {
		console.error(error);
	}
}
// test();
