import config from "config";
import NodeCache from "node-cache";

class MyCache extends NodeCache {
	getDefault<T>(setting: string, fetch: () => T, ttl?: number | string): T {
		let value = this.get<T>(setting);
		if (!value) {
			value = fetch();
			if (ttl) this.set(setting, value, ttl);
			else this.set(setting, value);
		}
		return value;
	}
	sismember(key: string, member: string): boolean {
		const list = this.get<string[]>(key) ?? [];
		if (!Array.isArray(list)) {
			throw new TypeError(`Cache "${key}" is not array.`);
		}
		return list.includes(member);
	}
	sadd(key: string, arg1: string | string[]): void {
		const list = this.get<string[]>(key) ?? [];
		if (!Array.isArray(list)) {
			throw new TypeError(`Cache "${key}" is not array.`);
		}
		if (Array.isArray(arg1)) {
			list.push(...arg1);
		}
		else {
			list.push(arg1);
		}
		this.set(key, [...new Set(list)]);
	}
	srem(key: string, arg1: string | string[]): void {
		const list = this.get<string[]>(key) ?? [];
		if (!Array.isArray(list)) {
			throw new TypeError(`Cache "${key}" is not array.`);
		}
		if (Array.isArray(arg1)) {
			for (const str of arg1) {
				list.splice(list.indexOf(str), 1);
			}
		}
		else {
			list.splice(list.indexOf(arg1), 1);
		}
		this.set(key, list);
	}
}

export const cache = new MyCache({
	stdTTL: config.get("cacheTTL"),
	useClones: true,
});
