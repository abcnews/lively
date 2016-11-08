module.exports = {
	contentftp: {
		credentials: ".abc-credentials",
		targetName: "contentftp",
		target: "/www/res/sites/news-projects/lively/",
		files: [{
			expand: true,
			cwd: 'build/',
			src: ["**/*"]
		}]
	}
};
