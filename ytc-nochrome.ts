import cheerio from "cheerio";
import _ from "lodash";
import fetch from "node-fetch";
import { Subject } from "rxjs";
import { fetchParser, YtcMessage } from "./ytc-fetch-parser";
import { GetLiveChatBody, GetLiveChatData, Ytcfg } from "./ytc-nochrome.d";

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

async function getLiveChatPage(videoId: string) {
	const res = await fetch(`https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`, {
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

function parseLiveChatPage(videoId: string, html: string): GetLiveChatData | string | undefined {
	const $ = cheerio.load(html);
	const ytcfgScript = $("script").filter((index, scriptEl) => cheerio.html(scriptEl).includes("INNERTUBE_CONTEXT"));
	const ytcfgText = ytcfgScript.html()?.match(/ytcfg\.set\((.*)\);/)?.[1];
	const ytInitialDataScript = $("script").filter((index, scriptEl) => cheerio.html(scriptEl).includes("ytInitialData"));
	const ytInitialDataText = ytInitialDataScript.html()?.match(/window\["ytInitialData"\] = (.*);/)?.[1];

	if (ytcfgText && ytInitialDataText) {
		const ytcfg: Ytcfg = JSON.parse(ytcfgText);
		const ytInitialData = JSON.parse(ytInitialDataText);

		const apiKey = ytcfg.INNERTUBE_API_KEY;
		const clientName = ytcfg.INNERTUBE_CONTEXT_CLIENT_NAME;
		const clientVersion = ytcfg.INNERTUBE_CONTEXT_CLIENT_VERSION;
		const visitorData = ytcfg.VISITOR_DATA;
		const continuations0 = ytInitialData?.contents?.liveChatRenderer?.continuations?.[0];
		const clickTrackingParams = continuations0?.timedContinuationData?.clickTrackingParams ?? continuations0?.invalidationContinuationData?.clickTrackingParams;
		const continuation = continuations0?.timedContinuationData?.continuation ?? continuations0?.invalidationContinuationData?.continuation;
		const timeoutMs = continuations0?.timedContinuationData?.timeoutMs ?? continuations0?.invalidationContinuationData?.timeoutMs;
		const firstMessage = ytInitialData?.contents?.messageRenderer?.text?.runs?.[0]?.text;

		const body: GetLiveChatBody = _.merge({
			context: ytcfg.INNERTUBE_CONTEXT
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
			continuation,
			webClientInfo: {
				isDocumentHidden: false
			}
		});

		if (apiKey && continuation) {
			return {
				videoId,
				apiKey,
				clientName: `${clientName}`,
				clientVersion,
				visitorData,
				body,
				timeoutMs,
			};
		}
		return firstMessage;
	}
}

async function getLiveChatApi(data: GetLiveChatData) {
	const res = await fetch(`https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${data.apiKey}`, {
		headers: _.merge({}, defaultFetchHeader, {
			"content-type": "application/json",
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

function setLiveChatApiData(data: GetLiveChatData, json: any) {
	const continuations0 = json?.continuationContents?.liveChatContinuation?.continuations?.[0];
	data.body.continuation = continuations0?.timedContinuationData?.continuation ?? continuations0?.invalidationContinuationData?.continuation;
	data.timeoutMs = continuations0?.timedContinuationData?.timeoutMs ?? continuations0?.invalidationContinuationData?.timeoutMs;
	if (data.body.continuation) {
		return data;
	}
}

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
						const nextData = setLiveChatApiData(data, result);
						if (this.subjectCache[videoId]) {
							const messages = fetchParser(result);
							for (const msg of messages) {
								this.subjectCache[videoId].next(msg);
							}
							if (nextData) {
								nextFetchLoop(nextData);
							}
							else {
								this.stop(videoId);
							}
						}
					}
					catch (error) {
						this.subjectCache[videoId]?.error(error);
						this.stop(videoId);
					}
				}, data.timeoutMs);
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
				const nextData = setLiveChatApiData(data, result);
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

	const videoId = "AK_DxiTXUts";
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
