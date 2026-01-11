import { defineConfig } from '@rslib/core';

export default defineConfig( {
	output: {
		sourceMap: true,
	},
	lib: [
		{
			format: 'cjs',
			syntax: [ 'node 21' ],
		},
	],
} );
