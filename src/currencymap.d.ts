export type CurrencyMap = Record<string, CurrencyMapEntry>;

export interface CurrencyMapEntry {
    symbol: string;
    code: string;
    symbol_native: string;
    decimal_digits: number;
    rounding: number;
}
