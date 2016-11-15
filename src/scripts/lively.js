module.exports = lively;

var initialised,
	instances,
	viewport;  // Position of visible part of page

const ns = require('util-news-selectors');
const cmimg = require('util-cmimg');
const url2cmid = require('util-url2cmid');
const playInline = require('iphone-inline-video');
const identifier = require('util-identifier')('Lively');
const win = window;
const template = require('../templates/lively.hbs');
const iOS = /iPad|iPhone|iPod/i.test(navigator.userAgent) && !window.MSStream;
const isWhitelisted = /iPhone|iPod|iPad/i.test(navigator.userAgent) && !matchMedia('(-webkit-video-playable-inline)').matches;

// Initialise the whole thing
function lively($container) {

	var $videos;

	$container = $container || $('body');
	$videos = $container
	.find(ns('embed:video'))
	.add($('.embed-content:has(.type-video)'))
	.filter((idx, el) => {
		return $(el).prev().is('a[name^="video"]');
	});

	$videos.each((idx, node) => new Lively(node));
}

function init() {

	// Don't do this twice
	if (initialised) {
		return;
	}

	// Make sure there's an instances array;
	instances = instances || [];

	lively.instances = instances;

	updateViewport();

	win.addEventListener('scroll', onScroll);
	win.addEventListener('wheel', onWheel, {passive:true});

	// watch for changes
	win.addEventListener('resize', rebuild);
	win.addEventListener('orientationchange', rebuild);

	// startFastCheckTimer();

	initialised = true;
}

function rebuild() {
	updateViewport();
	updatePositions();
}

function updateViewport() {
	viewport = viewport || {};
	viewport.top = $(win).scrollTop();
	viewport.bottom = viewport.top + $(window).height();
}

function onScroll() {
	if (viewport.top !== $(win).scrollTop()) {
		updateViewport();
		updatePositions();
	}
}

function onWheel() {
	setTimeout(() => {
		if (viewport.top !== $(win).scrollTop()) {
			updateViewport();
			updatePositions();
		}
	},0);
}

function updatePositions() {
	instances.forEach((inst) => inst.updatePosition());
}

function Lively(node) {

	var _this, $video, videoId, name, scrollplay;

	_this = this;

	// Make sure we're constructing
	if (!(_this instanceof Lively)) {
		return new Lively(node);
	}

	// Initialise global code
	init();

	$video = $(node);
	videoId = url2cmid($video.find('a').first().attr('href'));

	// Settings
	name = $video.prev().attr('name');
	scrollplay = name.match(/scrollplay([0-9]{1,2})/);

	_this.settings = {
		scrollplay: name.indexOf('scrollplay') > -1,
		scrollplayPosition: (scrollplay) ? +scrollplay[1]/100 : 0,
		autoplay: name.indexOf('autoplay') > -1,
		loop: name.indexOf('loop') > -1,
		fullscreen: name.indexOf('fullscreen') > -1,
		muted: name.indexOf('muted') > -1 || iOS
	};


	// This is mostly for testing, but it can also be used to avoid some requests
	// Add data to the window
	// window.livelyMetadata = {
	// 7662478: {
	// 	relatedItems: [{id: 7662482, docType: "Image", shortTeaserTitle: "Four Corners: Royal commission announced"}],
	// 	renditions: [{"url" : "http://mpegmedia.abc.net.au/news/video/201607/CNb_NTRoyalCom_2607_256k.mp4", "contentType" : "video/mp4", "bitrate" : 170, "fileSize" : 2250877}]
	// }
	if (win.livelyMetadata && win.livelyMetadata[videoId]) {
		initVid(window.livelyMetadata[videoId]);
	} else {
		$.getJSON(`https://content-gateway.abc-prod.net.au/api/v1/content/id/${videoId}`).done(initVid);
	}

	function initVid(json) {

		var $inst;

		$inst = $(template({
			renditions: json.renditions,
			poster: (json.relatedItems.length) ? cmimg(json.relatedItems[0].id, '16x9', $video.width() * win.devicePixelRatio) : false,
			settings: _this.settings
		}));

		$video.replaceWith($inst);

		// Wait a tick so we know for sure imgDiv is in DOM.
		setTimeout(()=>{

			_this.node = $inst[0];
			_this.video = $inst.find('video').get(0);
			_this.playButton = $inst.find(identifier('play', null, '.')).get(0);
			_this.progressBar = $inst.find(identifier('progress', null, '.')).get(0);
			_this.muteButton = $inst.find(identifier('mute', null, '.')).get(0);
			_this.replayButton = $inst.find(identifier('replay', null, '.')).get(0);
			_this.goneManual = false;
			_this.top = $inst.offset().top;
			_this.bottom = _this.top + $inst.height();

			// TODO: sort out sound on old iOS
			playInline(_this.video, false, !isWhitelisted); // iOS8-9

			if ('objectFit' in document.documentElement.style === false && _this.settings.fullscreen) {
				$(_this.video).attr('data-object-fit', 'cover'); // IE9+/Edge. See _section--cover.scss
			}

			if (_this.settings.autoplay) {
				$(_this.playButton).addClass('playing');
			}

			if ($(_this.video).prop('muted')) {
				$(_this.muteButton).addClass('muted');
			}

			_this.playButton.addEventListener('click', function() {
				_this.goneManual = true;
				if (_this.video.paused) {
					_this.play();
				} else {
					_this.pause();
				}
			});

			_this.muteButton.addEventListener('click', function() {

				if (isWhitelisted) {
					_this.video.webkitEnterFullScreen();
					_this.video.play();
				} else if (_this.video.muted) {
					_this.unmute();
				} else {
					_this.mute();
				}
			});

			_this.replayButton.addEventListener('click', function() {
				_this.pause();
				_this.video.currentTime = 0;
				_this.play();
			});

			_this.video.addEventListener('timeupdate', function() {
				$(_this.progressBar).attr("value", this.currentTime / this.duration);
			});

			_this.video.addEventListener('ended', function() {
				_this.pause();
				// TODO: Could probably do something better with the poster here.
				_this.video.currentTime = 0;
				_this.finishedOnce = true;
			});

			// References for later
			instances.push(_this);
			_this.node.Lively = _this;

			_this.initialised = true;
		},0);
	}
}

Lively.prototype.updatePosition = function() {

	this.position = this.position || {};
	this.position.top = $(this.node).offset().top;
	this.position.bottom = this.position.top + $(this.node).height();
	this.visible = (this.position.top-(viewport.top-viewport.bottom)*this.settings.scrollplayPosition < viewport.bottom) && (this.position.bottom+(viewport.top-viewport.bottom)*this.settings.scrollplayPosition > viewport.top);

	if (this.settings.scrollplay && !this.goneManual && !this.finishedOnce) {
		if (this.visible) {
			this.play();
		} else {
			this.pause();
		}
	}
};

Lively.prototype.play = function() {
	var promise = this.video.play();
	if (promise) {
		promise.then($(this.playButton).addClass('playing'));
	} else {
		$(this.playButton).addClass('playing');
	}

};

Lively.prototype.pause = function() {
	var promise = this.video.pause();
	if (promise) {
		promise.then($(this.playButton).removeClass('playing'));
	} else {
		$(this.playButton).removeClass('playing');
	}
};

Lively.prototype.mute = function() {
	$(this.video).prop('muted', true);
	$(this.muteButton).addClass('muted');
};

Lively.prototype.unmute = function() {
	$(this.video).prop('muted', false);
	$(this.muteButton).removeClass('muted');
};
