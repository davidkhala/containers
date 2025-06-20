import assert from 'assert';
import OCIContainerOptsBuilder from '../options.js';
import '../constants.js'
import '../container.js'
import '../image.js'
import '../oci.js'
import '../volume.js'
describe('opts', () => {
	it('constructor', () => {
		assert.throws(() => {
			new OCIContainerOptsBuilder('image', 'sh');
		});
	});

});