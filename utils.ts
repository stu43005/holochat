export function getRealAmount(amountMicros: number, currency: string) {
	switch (currency) {
		case "GBP": // 1GBP=?JPY
			amountMicros = amountMicros * 139;
			break;
		case "PEN": // 1PEN=?JPY
			amountMicros = amountMicros * 32.43;
			break;
		case "TWD": // 1TWD=?JPY
			amountMicros = amountMicros * 3.5;
			break;
		case "USD": // 1USD=?JPY
			amountMicros = amountMicros * 108;
			break;
		case "EUR": // 1EUR=?JPY
			amountMicros = amountMicros * 120;
			break;
		case "KRW": // 1KRW=?JPY
			amountMicros = amountMicros * 0.09;
			break;
		case "SEK": // 1SEK=?JPY
			amountMicros = amountMicros * 11.22;
			break;
		case "AUD": // 1AUD=?JPY
			amountMicros = amountMicros * 74.14;
			break;
		case "CAD": // 1CAD=?JPY
			amountMicros = amountMicros * 83.21;
			break;
		case "BRL": // 1BRL=?JPY
			amountMicros = amountMicros * 27.15;
			break;
		case "MXN": // 1MXN=?JPY
			amountMicros = amountMicros * 5.7;
			break;
		case "HKD": // 1HKD=?JPY
			amountMicros = amountMicros * 13.86;
			break;
		case "RUB": // 1RUB=?JPY
			amountMicros = amountMicros * 1.71;
			break;
		case "PHP": // 1PHP=?JPY
			amountMicros = amountMicros * 2.13;
			break;
		case "INR": // 1INR=?JPY
			amountMicros = amountMicros * 1.53;
			break;
	}

	return Math.floor(amountMicros / 1000000);
}

export function secondsToHms(d: number) {
	d = Number(d);
	const h = Math.floor(d / 3600).toString();
	const m = Math.floor(d % 3600 / 60).toString();
	const s = Math.floor(d % 3600 % 60).toString();

	const display = `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.padStart(2, "0")}`;
	return display;
}
