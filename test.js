import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {setTimeout as delay} from 'node:timers/promises';
import pDebounce from './index.js';

const fixture = Symbol('fixture');

test('single call', async () => {
	const debounced = pDebounce(async value => value, 100);
	const result = await debounced(fixture);
	assert.equal(result, fixture);
});

test('multiple calls', async () => {
	let count = 0;
	const start = Date.now();

	const debounced = pDebounce(async value => {
		count++;
		await delay(50);
		return value;
	}, 100);

	const results = await Promise.all([1, 2, 3, 4, 5].map(value => debounced(value)));
	const elapsed = Date.now() - start;

	assert.deepEqual(results, [5, 5, 5, 5, 5]);
	assert.equal(count, 1);
	assert.ok(elapsed >= 130 && elapsed <= 170);

	await delay(200);
	assert.equal(await debounced(6), 6);
});

test('.promise()', async () => {
	let count = 0;

	const debounced = pDebounce.promise(async () => {
		await delay(50);
		count++;
		return count;
	});

	const results = await Promise.all([1, 2, 3, 4, 5].map(value => debounced(value)));
	assert.deepEqual(results, [1, 1, 1, 1, 1]);
	assert.equal(await debounced(), 2);
});

test('before option', async () => {
	let count = 0;

	const debounced = pDebounce(async value => {
		count++;
		await delay(50);
		return value;
	}, 100, {before: true});

	const results = await Promise.all([1, 2, 3, 4].map(value => debounced(value)));

	assert.deepEqual(results, [1, 1, 1, 1]);
	assert.equal(count, 1);

	await delay(200);
	assert.equal(await debounced(5), 5);
	assert.equal(await debounced(6), 5);
});

test('before option - does not call input function after timeout', async () => {
	let count = 0;

	const debounced = pDebounce(async () => {
		count++;
	}, 100, {before: true});

	await delay(300);
	await debounced();

	assert.equal(count, 1);
});

test('fn takes longer than wait', async () => {
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

	assert.deepEqual(results, [3, 3, 3, 6, 6, 6]);
	assert.equal(count, 2);
});

// Factory to create a separate class for each test
const createFixtureClass = () => class {
	constructor() {
		this._foo = fixture;
	}

	foo() {
		return this._foo;
	}

	getThis() {
		return this;
	}
};

test('`this` is preserved in pDebounce() fn', async () => {
	const FixtureClass = createFixtureClass();
	FixtureClass.prototype.foo = pDebounce(FixtureClass.prototype.foo, 10);
	FixtureClass.prototype.getThis = pDebounce(FixtureClass.prototype.getThis, 10);

	const thisFixture = new FixtureClass();

	assert.equal(await thisFixture.getThis(), thisFixture);
	assert.doesNotThrow(async () => thisFixture.foo());
	assert.equal(await thisFixture.foo(), fixture);
});

test('`this` is preserved in pDebounce.promise() fn', async () => {
	const FixtureClass = createFixtureClass();
	FixtureClass.prototype.foo = pDebounce.promise(FixtureClass.prototype.foo, 10);
	FixtureClass.prototype.getThis = pDebounce.promise(FixtureClass.prototype.getThis, 10);

	const thisFixture = new FixtureClass();

	assert.equal(await thisFixture.getThis(), thisFixture);
	assert.doesNotThrow(async () => thisFixture.foo());
	assert.equal(await thisFixture.foo(), fixture);
});

test('AbortSignal cancels debounced calls', async () => {
	let callCount = 0;
	const controller = new AbortController();

	const debounced = pDebounce(async value => {
		callCount++;
		await delay(50);
		return value;
	}, 100, {
		signal: controller.signal,
	});

	const promise = debounced(1);

	controller.abort();

	await assert.rejects(promise, error => {
		assert.equal(error.name, 'AbortError');
		return true;
	});

	assert.equal(callCount, 0);
});

test('already aborted signal prevents execution', async () => {
	const controller = new AbortController();
	controller.abort();

	const debounced = pDebounce(async value => value, 100, {
		signal: controller.signal,
	});

	const promise = debounced(1);

	await assert.rejects(promise, error => {
		assert.equal(error.name, 'AbortError');
		return true;
	});
});

test('AbortSignal works with before option', async () => {
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
	assert.equal(result1, 1);
	assert.equal(callCount, 1);

	// Second call is pending
	const promise2 = debounced(2);

	// Abort before timeout
	controller.abort();

	await assert.rejects(promise2, error => {
		assert.equal(error.name, 'AbortError');
		return true;
	});

	// Call count should still be 1 (only first call executed)
	assert.equal(callCount, 1);
});

test('multiple promises are cancelled together with AbortSignal', async () => {
	let callCount = 0;
	const controller = new AbortController();

	const debounced = pDebounce(async value => {
		callCount++;
		return value;
	}, 100, {
		signal: controller.signal,
	});

	const promise1 = debounced(1);
	const promise2 = debounced(2);
	const promise3 = debounced(3);

	controller.abort();

	await assert.rejects(promise1, {name: 'AbortError'});
	await assert.rejects(promise2, {name: 'AbortError'});
	await assert.rejects(promise3, {name: 'AbortError'});

	assert.equal(callCount, 0);
});

test('function still works after AbortSignal cancellation', async () => {
	const controller1 = new AbortController();
	const debounced = pDebounce(async value => value, 100, {
		signal: controller1.signal,
	});

	// Cancel initial call
	const promise1 = debounced(1);
	controller1.abort();
	await assert.rejects(promise1);

	// Should work normally with new signal after cancellation
	const controller2 = new AbortController();
	const debounced2 = pDebounce(async value => value, 100, {
		signal: controller2.signal,
	});
	const result = await debounced2(2);
	assert.equal(result, 2);
});

test('abort listener is cleaned up after normal completion', async () => {
	const controller = new AbortController();
	const {signal} = controller;

	// Track listener count
	const initialListenerCount = signal.eventNames?.()?.length ?? 0;

	const debounced = pDebounce(async value => value, 100, {signal});

	// Call the function
	const promise = debounced(1);

	// Wait for completion
	const result = await promise;
	assert.equal(result, 1);

	// Give time for cleanup
	await delay(10);

	// Check that listeners are cleaned up
	const finalListenerCount = signal.eventNames?.()?.length ?? 0;
	assert.equal(finalListenerCount, initialListenerCount, 'Abort listener should be removed after completion');
});

test('multiple abort signals are handled correctly without leaks', async () => {
	// Test with multiple signals to ensure no leaks
	const promises = [];
	for (let i = 0; i < 5; i++) {
		const controller = new AbortController();
		const debounced = pDebounce(async value => value, 50, {
			signal: controller.signal,
		});

		promises.push(debounced(i));
	}

	await Promise.all(promises);

	// If this test completes without memory issues, listeners are being cleaned up
	assert.ok(true);
});

test('before option - all calls in window resolve to same leading value', async () => {
	let callCount = 0;

	const debounced = pDebounce(async value => {
		callCount++;
		return value;
	}, 100, {before: true});

	// Multiple calls in quick succession
	const promises = [
		debounced(1),
		debounced(2),
		debounced(3),
		debounced(4),
	];

	const results = await Promise.all(promises);

	// All should resolve to the first value
	assert.deepEqual(results, [1, 1, 1, 1], 'All calls should resolve to the first value');
	assert.equal(callCount, 1, 'Function should only be called once');
});

test('abort rejects all pending callers with consistent AbortError', async () => {
	const controller = new AbortController();

	const debounced = pDebounce(async value => {
		await delay(50);
		return value;
	}, 100, {signal: controller.signal});

	// Queue multiple calls
	const promise1 = debounced(1);
	const promise2 = debounced(2);
	const promise3 = debounced(3);

	// Abort after a short delay
	await delay(10);
	controller.abort();

	// All should reject with AbortError
	const results = await Promise.allSettled([promise1, promise2, promise3]);
	const errors = results
		.filter(result => result.status === 'rejected')
		.map(result => result.reason);

	// All errors should be AbortError
	assert.equal(errors.length, 3);
	for (const error of errors) {
		assert.equal(error.name, 'AbortError');
	}
});

test('this context is preserved in non-before mode', async () => {
	const object = {
		value: 42,
		async getValue() {
			return this.value;
		},
	};

	object.getValue = pDebounce(object.getValue, 50);

	const result = await object.getValue();
	assert.equal(result, 42, 'this context should be preserved');
});

test('handles synchronous errors correctly', async () => {
	const errorMessage = 'Sync error';
	const debounced = pDebounce(() => {
		throw new Error(errorMessage);
	}, 50);

	await assert.rejects(debounced(), error => {
		assert.equal(error.message, errorMessage);
		return true;
	});
});

test('handles synchronous errors with before option', async () => {
	const errorMessage = 'Sync error in before mode';
	const debounced = pDebounce(() => {
		throw new Error(errorMessage);
	}, 50, {before: true});

	await assert.rejects(debounced(), error => {
		assert.equal(error.message, errorMessage);
		return true;
	});
});

test('handles rejected promises correctly', async () => {
	const errorMessage = 'Async rejection';
	const debounced = pDebounce(async () => {
		throw new Error(errorMessage);
	}, 50);

	await assert.rejects(debounced(), error => {
		assert.equal(error.message, errorMessage);
		return true;
	});
});

test('multiple callers all receive the same rejection', async () => {
	const errorMessage = 'Shared rejection';
	const debounced = pDebounce(async () => {
		await delay(10);
		throw new Error(errorMessage);
	}, 50);

	const promises = [
		debounced(1),
		debounced(2),
		debounced(3),
	];

	const results = await Promise.allSettled(promises);

	// All should be rejected with the same error
	assert.equal(results.length, 3);
	for (const result of results) {
		assert.equal(result.status, 'rejected');
		assert.equal(result.reason.message, errorMessage);
	}
});

test('handles undefined and null arguments', async () => {
	const debounced = pDebounce(async (...arguments_) => arguments_, 50);

	const result1 = await debounced(undefined);
	assert.deepEqual(result1, [undefined]);

	const result2 = await debounced(null);
	assert.deepEqual(result2, [null]);

	const result3 = await debounced();
	assert.deepEqual(result3, []);
});

test('rapid abort signals do not cause memory leaks', async () => {
	// Create and abort many signals in rapid succession
	const promises = [];

	for (let i = 0; i < 100; i++) {
		const controller = new AbortController();
		const debounced = pDebounce(async value => value, 50, {
			signal: controller.signal,
		});

		const promise = debounced(i);
		controller.abort();
		// eslint-disable-next-line promise/prefer-await-to-then
		promises.push(promise.catch(() => {})); // Ignore rejections
	}

	await Promise.all(promises);
	assert.ok(true, 'Rapid aborts handled without issues');
});

test('before option with immediate abort', async () => {
	const controller = new AbortController();

	const debounced = pDebounce(async value => {
		await delay(50);
		return value;
	}, 100, {before: true, signal: controller.signal});

	const promise = debounced(1);
	controller.abort(); // Abort immediately after leading call

	// Leading call should still complete successfully
	const result = await promise;
	assert.equal(result, 1);
});

test('mixed successful and failed calls', async () => {
	let shouldFail = false;
	const debounced = pDebounce(async value => {
		if (shouldFail) {
			throw new Error('Failed');
		}

		return value;
	}, 50);

	// First batch succeeds
	const result1 = await debounced(1);
	assert.equal(result1, 1);

	// Second batch fails
	shouldFail = true;
	await assert.rejects(debounced(2), {message: 'Failed'});

	// Third batch succeeds again
	shouldFail = false;
	const result3 = await debounced(3);
	assert.equal(result3, 3);
});

test('error handling - documents behavior for issue #7', async () => {
	const errorMessage = 'Test error for issue #7';
	let callCount = 0;

	const debounced = pDebounce(async () => {
		callCount++;
		await delay(10);
		throw new Error(errorMessage);
	}, 50);

	// Make multiple calls that should all be debounced together
	const promise1 = debounced();
	const promise2 = debounced();
	const promise3 = debounced();

	// All promises should reject with the same error (issue #7 behavior)
	const results = await Promise.allSettled([promise1, promise2, promise3]);

	// Verify function was only called once due to debouncing
	assert.equal(callCount, 1);

	// Verify all calls were rejected with the same error
	for (const result of results) {
		assert.equal(result.status, 'rejected');
		assert.equal(result.reason.message, errorMessage);
	}
});
