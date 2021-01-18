'use strict';

const pDebounce = (fn, wait, options = {}) => {
	if (!Number.isFinite(wait)) {
		throw new TypeError('Expected `wait` to be a finite number');
	}

	let leadingValue;
	let timer;
	let resolveList = [];

	return function (...arguments_) {
		return new Promise(resolve => {
			const runImmediately = options.leading && !timer;

			clearTimeout(timer);

			timer = setTimeout(() => {
				timer = null;

				const result = options.leading ? leadingValue : fn(...arguments_);

				for (resolve of resolveList) {
					resolve(result);
				}

				resolveList = [];
			}, wait);

			if (runImmediately) {
				leadingValue = fn(...arguments_);
				resolve(leadingValue);
			} else {
				resolveList.push(resolve);
			}
		});
	};
};

pDebounce.promise = function_ => {
	let currentPromise;

	return async (...arguments_) => {
		if (currentPromise) {
			return currentPromise;
		}

		try {
			currentPromise = function_(...arguments_);
			return await currentPromise;
		} finally {
			currentPromise = undefined;
		}
	};
};

export default pDebounce;
