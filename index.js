const pDebounce = (fn, wait, options = {}) => {
	if (!Number.isFinite(wait)) {
		throw new TypeError('Expected `wait` to be a finite number');
	}

	let leadingValue;
	let timeout;
	let resolveList = [];
	let rejectList = [];

	return function (...arguments_) {
		return new Promise((resolve, reject) => {
			try {
				options.signal?.throwIfAborted();
			} catch (error) {
				reject(error);
				return;
			}

			const shouldCallNow = options.before && !timeout;

			clearTimeout(timeout);

			timeout = setTimeout(() => {
				timeout = null;

				const result = options.before ? leadingValue : fn.apply(this, arguments_);

				for (const resolveFunction of resolveList) {
					resolveFunction(result);
				}

				resolveList = [];
				rejectList = [];
			}, wait);

			if (shouldCallNow) {
				leadingValue = fn.apply(this, arguments_);
				resolve(leadingValue);
			} else {
				resolveList.push(resolve);
				rejectList.push(reject);

				if (options.signal) {
					options.signal.addEventListener('abort', () => {
						clearTimeout(timeout);
						timeout = null;

						try {
							options.signal.throwIfAborted();
						} catch (error) {
							for (const rejectFunction of rejectList) {
								rejectFunction(error);
							}

							resolveList = [];
							rejectList = [];
						}
					}, {once: true});
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
