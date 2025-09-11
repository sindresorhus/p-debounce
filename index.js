const pDebounce = (function_, wait, options = {}) => {
	if (!Number.isFinite(wait)) {
		throw new TypeError('Expected `wait` to be a finite number');
	}

	let leadingValue;
	let timeout;
	let resolveList = [];
	let rejectList = [];

	const cleanup = () => {
		resolveList = [];
		rejectList = [];
	};

	const onAbort = () => {
		clearTimeout(timeout);
		timeout = null;

		try {
			options.signal?.throwIfAborted();
		} catch (error) {
			for (const reject of rejectList) {
				reject(error);
			}

			cleanup();
		}
	};

	return function (...arguments_) {
		return new Promise((resolve, reject) => {
			// Check if already aborted
			try {
				options.signal?.throwIfAborted();
			} catch (error) {
				reject(error);
				return;
			}

			const shouldCallNow = options.before && !timeout;

			clearTimeout(timeout);

			timeout = setTimeout(async () => {
				timeout = null;

				try {
					const result = options.before ? leadingValue : await function_.apply(this, arguments_);

					for (const resolveFunction of resolveList) {
						resolveFunction(result);
					}
				} catch (error) {
					for (const rejectFunction of rejectList) {
						rejectFunction(error);
					}
				}

				cleanup();

				// Clear leading value for next cycle
				leadingValue = undefined;

				// Remove abort listener
				options.signal?.removeEventListener('abort', onAbort);
			}, wait);

			if (shouldCallNow) {
				// Execute immediately for leading edge
				try {
					const result = function_.apply(this, arguments_);
					if (result && typeof result.then === 'function') {
						// eslint-disable-next-line promise/prefer-await-to-then
						result.catch(reject).then(value => {
							leadingValue = value;
							resolve(value);
						});
					} else {
						leadingValue = result;
						resolve(result);
					}
				} catch (error) {
					reject(error);
				}
			} else {
				// Add to lists for later resolution
				resolveList.push(resolve);
				rejectList.push(reject);

				// Set up abort listener (only once per batch)
				if (options.signal && resolveList.length === 1) {
					options.signal.addEventListener('abort', onAbort, {once: true});
				}
			}
		});
	};
};

pDebounce.promise = function_ => {
	let currentPromise;

	return async function (...arguments_) {
		if (currentPromise) {
			return currentPromise;
		}

		try {
			currentPromise = function_.apply(this, arguments_);
			return await currentPromise;
		} finally {
			currentPromise = undefined;
		}
	};
};

export default pDebounce;
