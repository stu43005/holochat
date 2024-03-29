import config from "config";
import currencyConverter from "currency-converter";
import fs from "fs";
import moment from "moment";
import type { CurrencyMap, CurrencyMapEntry } from "./currencymap";
import path from "path";

const currencymap = JSON.parse(fs.readFileSync(path.join(__dirname, "../currencymap.json"), { encoding: "utf8" })) as CurrencyMap;
const cc = currencyConverter({
	CLIENTKEY: config.get<string>("open_exchange_rates_app_id"),
});

const amountRegex = /^(?<currency>(?:[A-Z]{1,2})?\$|(?:[A-Z]{2})?¥|£|€|₹|￦|₪|₫|[A-Z]{3})\s?(?<amount>(?:\d{1,3},(?:\d{3},)*\d{3}|\d+)(?:\.\d+)?)$/;

export function parseAmountDisplayString(amountDisplayString: string) {
	const match = amountDisplayString.match(amountRegex);
	const amount = parseFloat(match?.groups?.amount?.replace(/,/g, "") ?? "");
	const currency = match?.groups?.currency;
	if (isNaN(amount) || !currency) {
		console.error(`Cannot parse amount: "${amountDisplayString}"`);
		return;
	}
	return {
		amount,
		currency,
	};
}

export function getCurrencymapItem(currency: string): CurrencyMapEntry {
	let currencymapEntry: undefined | typeof currencymap.JPY;
	for (const key of ["code", "symbol", "symbol_native"] as const) {
		currencymapEntry = Object.values(currencymap).find(entry => entry[key] === currency);
		if (currencymapEntry) break;
	}
	return currencymapEntry ?? {
		symbol: "¥",
		code: "JPY",
		symbol_native: "￥",
		decimal_digits: 0,
		rounding: 0.0
	};
}

let ccUpdateTime = 0;
function isOutdate() {
	if (moment().isSameOrAfter(moment(ccUpdateTime).add(1, "hour"))) {
		ccUpdateTime = Date.now();
		return true;
	}
	return false;
}

export async function currencyToJpyAmount(amount: number, currency: string) {
	const currencymapEntry = getCurrencymapItem(currency);
	const live = isOutdate();
	if (live) {
		try {
			const jpyAmount = await cc.convert(amount, currencymapEntry.code, "JPY", true);
			return {
				amount: jpyAmount.amount,
				currency: "¥",
			};
		}
		catch (error) {
			console.error(error);
		}
	}
	try {
		const jpyAmount = await cc.convert(amount, currencymapEntry.code, "JPY");
		return {
			amount: jpyAmount.amount,
			currency: "¥",
		};
	}
	catch (error) {
		console.error(error);
		return {
			amount,
			currency,
		};
	}
}

export function secondsToHms(d: number) {
	d = Number(d);
	const h = Math.floor(d / 3600).toString();
	const m = Math.floor(d % 3600 / 60).toString();
	const s = Math.floor(d % 3600 % 60).toString();

	const display = `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.padStart(2, "0")}`;
	return display;
}

export function shuffle<T>(array: T[]) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}
