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
