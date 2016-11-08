module.exports = {
	options:{
	},
	prod: {
		options: {
			reporter: 'dot'
		},
		files: {
			src: ['test/*.html']
		}
	},
	dev: ['test/*.html']
};
