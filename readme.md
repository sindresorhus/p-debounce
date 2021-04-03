# p-debounce

> [Debounce](https://css-tricks.com/debouncing-throttling-explained-examples/) promise-returning & async functions

## Install

```
$ npm install p-debounce
```

## Usage

```js
import pDebounce from 'p-debounce';

const expensiveCall = async input => input;

const debouncedFn = pDebounce(expensiveCall, 200);

for (const number of [1, 2, 3]) {
	console.log(await debouncedFn(number));
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

### pDebounce.promise(function_)

Execute `function_` unless a previous call is still pending, in which case, return the pending promise. Useful, for example, to avoid processing extra button clicks if the previous one is not complete.

#### function_

Type: `Function`

Promise-returning/async function to debounce.

```js
import {setTimeout as delay} from 'timers/promises';
import pDebounce from 'p-debounce';

const expensiveCall = async value => {
	await delay(200);
	return value;
}

const debouncedFn = pDebounce.promise(expensiveCall);

for (const number of [1, 2, 3]) {
	console.log(await debouncedFn(number));
}
//=> 1
//=> 2
//=> 3
```

## Related

- [p-throttle](https://github.com/sindresorhus/p-throttle) - Throttle promise-returning & async functions
- [p-limit](https://github.com/sindresorhus/p-limit) - Run multiple promise-returning & async functions with limited concurrency
- [p-memoize](https://github.com/sindresorhus/p-memoize) - Memoize promise-returning & async functions
- [debounce-fn](https://github.com/sindresorhus/debounce-fn) - Debounce a function
- [More…](https://github.com/sindresorhus/promise-fun)
