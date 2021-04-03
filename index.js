'use strict';

const pDebounce = (fn, wait, options = {}) => {
	if (!Number.isFinite(wait)) {
		throw new TypeError('Expected `wait` to be a finite number');
	}

	let result;
	let timeout;
	let resolveList = [];

	return function (...arguments_) {
		return new Promise(resolve => {
			const shouldCallNow = options.before && !timeout;

			clearTimeout(timeout);

			timeout = setTimeout(() => {
				timeout = null;

				const result = options.before ? result : fn.apply(this, arguments_);

				for (resolve of resolveList) {
					resolve(result);
				}

				resolveList = [];
			}, wait);

			if (shouldCallNow) {
				result = fn.apply(this, arguments_);
				resolve(result);
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
