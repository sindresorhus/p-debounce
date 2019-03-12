export interface Options {
	/**
	 * Call the `fn` on the [leading edge of the timeout](https://css-tricks.com/debouncing-throttling-explained-examples/#article-header-id-1). Meaning immediately, instead of waiting for `wait` milliseconds.
	 *
	 * @default false
	 */
	readonly leading?: boolean;
}

/**
 * [Debounce](https://css-tricks.com/debouncing-throttling-explained-examples/) promise-returning & async functions.
 *
 * @param fn - Promise-returning/async function to debounce.
 * @param wait - Milliseconds to wait before calling `fn`.
 * @returns Returns a function that delays calling `fn` until after `wait` milliseconds have elapsed since the last time it was called.
 */
export default function pDebounce<ArgumentsType extends unknown[], ReturnType>(
	fn: (...arguments: ArgumentsType) => PromiseLike<ReturnType> | ReturnType,
	wait: number,
	options?: Options
): (...arguments: ArgumentsType) => Promise<ReturnType>;
