import puppeteer, { Browser, BrowserLaunchArgumentOptions, HTTPRequest, HTTPResponse, LaunchOptions, Page } from "puppeteer";
import { Subject } from "rxjs";
import { fetchParser, YtcMessage } from "./ytc-fetch-parser";

export class YtcHeadless {
	private browser: Browser | null = null;
	private pages: { [index: string]: Page } = {};
	private subjectCache: { [index: string]: Subject<YtcMessage> } = {};

	constructor(private puppeteerOptions?: LaunchOptions | BrowserLaunchArgumentOptions) { }

	public count() {
		return Object.keys(this.subjectCache).length;
	}

	public async listen(videoId: string) {
		if (!this.subjectCache[videoId]) {
			this.subjectCache[videoId] = new Subject();
			if (!this.browser) {
				this.browser = await puppeteer.launch(this.puppeteerOptions);
			}
			const page = await this.browser.newPage();
			this.pages[videoId] = page;
			page.on("response", async (interceptedRequest: HTTPResponse) => {
				const url = interceptedRequest.url();
				if (url.includes("live_chat/get_live_chat")) {
					const text = await interceptedRequest.text();
					if (text) {
						const messages = fetchParser(text);
						for (const msg of messages) {
							this.subjectCache[videoId].next(msg);
						}
					}
				}
			});
			const originUserAgent = await this.browser.userAgent();
			await page.setUserAgent(originUserAgent.replace("HeadlessChrome", "Chrome"));
			await page.goto(`https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`, {
				waitUntil: "load",
			});
			this.setReloadTimer(videoId);
		}
		return this.subjectCache[videoId];
	}

	public async stop(videoId: string) {
		if (this.subjectCache[videoId]) {
			this.subjectCache[videoId].complete();
			delete this.subjectCache[videoId];

			await this.pages[videoId]?.close();
			delete this.pages[videoId];
			if (Object.keys(this.pages).length === 0) {
				const browser = this.browser;
				this.browser = null;
				await browser?.close();
			}
		}
	}

	private setReloadTimer(videoId: string) {
		global.setTimeout(async () => {
			if (this.pages[videoId]) {
				await this.pages[videoId].reload();
				this.setReloadTimer(videoId);
			}
		}, 30 * 60 * 1000);
	};
}
