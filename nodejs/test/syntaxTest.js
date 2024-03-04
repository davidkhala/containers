import assert from 'assert';
import {OCIContainerOptsBuilder} from '../options.js';

describe('container Opts builder', () => {
	it('constructor', () => {
		assert.throws(() => {
			new OCIContainerOptsBuilder('image', 'sh');
		});

	});
});