import test from 'ava';
import delay from 'yoctodelay'; // TODO: Replace with `import {setTimeout as delay} = from 'timers/promises';` when targeting Node.js 16
import inRange from 'in-range';
import timeSpan from 'time-span';
import pDebounce from './index.js';

const fixture = Symbol('fixture');

test('single call', async t => {
	const debounced = pDebounce(async value => value, 100);
	t.is(await debounced(fixture), fixture);
});

test('multiple calls', async t => {
	let count = 0;
	const end = timeSpan();

	const debounced = pDebounce(async value => {
		count++;
		await delay(50);
		return value;
	}, 100);

	const results = await Promise.all([1, 2, 3, 4, 5].map(value => debounced(value)));

	t.deepEqual(results, [5, 5, 5, 5, 5]);
	t.is(count, 1);
	t.true(inRange(end(), {
		start: 130,
		end: 170
	}));

	await delay(200);
	t.is(await debounced(6), 6);
});

test('.promise()', async t => {
	let count = 0;

	const debounced = pDebounce.promise(async () => {
		await delay(50);
		count++;
		return count;
	});

	t.deepEqual(await Promise.all([1, 2, 3, 4, 5].map(value => debounced(value))), [1, 1, 1, 1, 1]);

	t.is(await debounced(), 2);
});

test('before option', async t => {
	let count = 0;

	const debounced = pDebounce(async value => {
		count++;
		await delay(50);
		return value;
	}, 100, {before: true});

	const results = await Promise.all([1, 2, 3, 4].map(value => debounced(value)));

	t.deepEqual(results, [1, 1, 1, 1], 'value from the first promise is used without the timeout');
	t.is(count, 1);

	await delay(200);
	t.is(await debounced(5), 5);
	t.is(await debounced(6), 5);
});

test('before option - does not call input function after timeout', async t => {
	let count = 0;

	const debounced = pDebounce(async () => {
		count++;
	}, 100, {before: true});

	await delay(300);
	await debounced();

	t.is(count, 1);
});

test('fn takes longer than wait', async t => {
	let count = 0;

	const debounced = pDebounce(async value => {
		count++;
		await delay(200);
		return value;
	}, 100);

	const setOne = [1, 2, 3];
	const setTwo = [4, 5, 6];

	const promiseSetOne = setOne.map(value => debounced(value));
	await delay(101);
	const promiseSetTwo = setTwo.map(value => debounced(value));

	const results = await Promise.all([...promiseSetOne, ...promiseSetTwo]);

	t.deepEqual(results, [3, 3, 3, 6, 6, 6]);
	t.is(count, 2);
});

// Factory to create a separate class for each test below
// * Each test replaces methods in the class with a debounced variant,
//   hence the need to start with fresh class for each test.
const createFixtureClass = () => class {
	constructor() {
		this._foo = fixture;
	}

	foo() {
		// If `this` is not preserved by `pDebounce()` or `pDebounce.promise()`,
		// then `this` will be undefined and accessing `this._foo` will throw.
		return this._foo;
	}

	getThis() {
		// If `this` is not preserved by `pDebounce()` or `pDebounce.promise()`,
		// then `this` will be undefined.
		return this;
	}
};

const preserveThisCases = [
	['pDebounce()', pDebounce],
	['pDebounce().promise()', pDebounce.promise]
];

for (const [name, debounceFn] of preserveThisCases) {
	test(`\`this\` is preserved in ${name} fn`, async t => {
		const FixtureClass = createFixtureClass();
		FixtureClass.prototype.foo = debounceFn(FixtureClass.prototype.foo, 10);
		FixtureClass.prototype.getThis = debounceFn(FixtureClass.prototype.getThis, 10);

		const thisFixture = new FixtureClass();

		t.is(await thisFixture.getThis(), thisFixture);
		await t.notThrowsAsync(thisFixture.foo());
		t.is(await thisFixture.foo(), fixture);
	});
}

test('AbortSignal cancels debounced calls', async t => {
	let callCount = 0;
	const controller = new AbortController();

	const debounced = pDebounce(async value => {
		callCount++;
		await delay(50);
		return value;
	}, 100, {
		signal: controller.signal
	});

	const promise = debounced(1);

	controller.abort();

	await t.throwsAsync(promise, {
		name: 'AbortError'
	});

	t.is(callCount, 0);
});

test('already aborted signal prevents execution', async t => {
	const controller = new AbortController();
	controller.abort();

	const debounced = pDebounce(async value => value, 100, {
		signal: controller.signal
	});

	const promise = debounced(1);

	await t.throwsAsync(promise, {
		name: 'AbortError'
	});
});

test('AbortSignal works with before option', async t => {
	let callCount = 0;
	const controller = new AbortController();

	const debounced = pDebounce(async value => {
		callCount++;
		await delay(50);
		return value;
	}, 100, {before: true, signal: controller.signal});

	// First call executes immediately
	const promise1 = debounced(1);
	const result1 = await promise1;
	t.is(result1, 1);
	t.is(callCount, 1);

	// Second call is pending
	const promise2 = debounced(2);

	// Abort before timeout
	controller.abort();

	await t.throwsAsync(promise2, {
		name: 'AbortError'
	});

	// Call count should still be 1 (only first call executed)
	t.is(callCount, 1);
});

test('multiple promises are cancelled together with AbortSignal', async t => {
	let callCount = 0;
	const controller = new AbortController();

	const debounced = pDebounce(async value => {
		callCount++;
		return value;
	}, 100, {
		signal: controller.signal
	});

	const promise1 = debounced(1);
	const promise2 = debounced(2);
	const promise3 = debounced(3);

	controller.abort();

	await t.throwsAsync(promise1, {name: 'AbortError'});
	await t.throwsAsync(promise2, {name: 'AbortError'});
	await t.throwsAsync(promise3, {name: 'AbortError'});

	t.is(callCount, 0);
});

test('function still works after AbortSignal cancellation', async t => {
	const controller1 = new AbortController();
	const debounced = pDebounce(async value => value, 100, {
		signal: controller1.signal
	});

	// Cancel initial call
	const promise1 = debounced(1);
	controller1.abort();
	await t.throwsAsync(promise1);

	// Should work normally with new signal after cancellation
	const controller2 = new AbortController();
	const debounced2 = pDebounce(async value => value, 100, {
		signal: controller2.signal
	});
	const result = await debounced2(2);
	t.is(result, 2);
});
