# p-debounce

> [Debounce](https://css-tricks.com/debouncing-throttling-explained-examples/) promise-returning & async functions

## Install

```sh
npm install p-debounce
```

## Usage

```js
import pDebounce from 'p-debounce';

const expensiveCall = async input => input;

const debouncedFunction = pDebounce(expensiveCall, 200);

for (const number of [1, 2, 3]) {
	(async () => {
		console.log(await debouncedFunction(number));
	})();
}
//=> 3
//=> 3
//=> 3
```

## API

### pDebounce(fn, wait, options?)

Returns a function that delays calling `fn` until after `wait` milliseconds have elapsed since the last time it was called.

#### fn

Type: `Function`

Promise-returning/async function to debounce.

#### wait

Type: `number`

Milliseconds to wait before calling `fn`.

#### options

Type: `object`

##### before

Type: `boolean`\
Default: `false`

Call the `fn` on the [leading edge of the timeout](https://css-tricks.com/debouncing-throttling-explained-examples/#article-header-id-1). Meaning immediately, instead of waiting for `wait` milliseconds.

##### signal

Type: `AbortSignal`

An [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) to cancel the debounced function.

### pDebounce.promise(function_, options?)

Execute `function_` unless a previous call is still pending, in which case, return the pending promise. Useful, for example, to avoid processing extra button clicks if the previous one is not complete.

```js
import {setTimeout as delay} from 'timers/promises';
import pDebounce from 'p-debounce';

const expensiveCall = async value => {
	await delay(200);
	return value;
};

const debouncedFunction = pDebounce.promise(expensiveCall);

for (const number of [1, 2, 3]) {
	(async () => {
		console.log(await debouncedFunction(number));
	})();
}
//=> 1
//=> 1
//=> 1
```

#### function_

Type: `Function`

Promise-returning/async function to debounce.

#### options

Type: `object`

##### after

Type: `boolean`\
Default: `false`

If a call is made while a previous call is still running, queue the latest arguments and run the function again after the current execution completes.

Use cases:
- With `after: false` (default): API fetches, data loading, read operations - concurrent calls share the same result.
- With `after: true`: Saving data, file writes, state updates - ensures latest data is never lost.

```js
import {setTimeout as delay} from 'timers/promises';
import pDebounce from 'p-debounce';

const save = async data => {
	await delay(200);
	console.log(`Saved: ${data}`);
	return data;
};

const debouncedSave = pDebounce.promise(save, {after: true});

// If data changes while saving, it will save again with the latest data
debouncedSave('data1');
debouncedSave('data2'); // This will run after the first save completes
//=> Saved: data1
//=> Saved: data2
```

## Related

- [p-throttle](https://github.com/sindresorhus/p-throttle) - Throttle promise-returning & async functions
- [p-limit](https://github.com/sindresorhus/p-limit) - Run multiple promise-returning & async functions with limited concurrency
- [p-memoize](https://github.com/sindresorhus/p-memoize) - Memoize promise-returning & async functions
- [debounce-fn](https://github.com/sindresorhus/debounce-fn) - Debounce a function
- [More…](https://github.com/sindresorhus/promise-fun)
