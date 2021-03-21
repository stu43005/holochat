import { BloomFilter } from "bloom-filters";

/**
 * @deprecated
 */
export function bloomFilterSaveAsJSON(filter: BloomFilter) {
	const self = filter as any;
	const json = {
		type: "bloom-filter",
		size: self._size,
		nbHashes: self._nbHashes,
		filter: self._filter,
		length: self._length,
		seed: filter.seed,
	};
	return JSON.parse(JSON.stringify(json));
}

/**
 * @deprecated
 */
export function bloomFilterFromJSON(json: any) {
	if (json.type !== "bloom-filter") return;
	const filter = new BloomFilter(json.size, json.nbHashes);
	filter.seed = json.seed;
	const self = filter as any;
	self._filter = json.filter;
	self._length = json.length;
	return filter;
}
