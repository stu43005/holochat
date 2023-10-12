declare module "currency-converter" {
	function currencyConverter(options: currencyConverter.Options): currencyConverter.CurrencyConverter;

	namespace currencyConverter {
		interface Options {
			/**
			 * YOUR_OPEN_EXCHANGE_RATES_KEY
			 */
			CLIENTKEY: string;
			/**
			 * @default 3600000
			 */
			fetchInterval?: number;
		}
		interface CurrencyConverter {
			convert(amount: number, convertFrom: string, convertTo: string, live?: boolean): Promise<Conversion>;
			rates(convertFrom: string, convertTo: string, live?: boolean): Promise<number>;
		}
		interface Conversion {
			currency: string;
			symbol: string;
			amount: number;
		}
	}

	export = currencyConverter;
}
