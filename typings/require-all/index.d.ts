declare module "require-all" {
	function requireAll(options: string | requireAll.Options): any;

	namespace requireAll {
		interface Options {
			dirname: string;
			excludeDirs?: RegExp;
			filter?: RegExp | ((filename: string) => string);
			recursive?: boolean;
			resolve?: (module: any) => any;
			map?: (filename: string, filepath: string) => string;
		}
	}

	export = requireAll;
}
