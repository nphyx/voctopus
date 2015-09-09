"use strict";
var gulp = require("gulp");
var mocha = require("gulp-mocha");
var istanbul = require("gulp-istanbul");
var isparta = require("isparta");
var babel = require("gulp-babel");
var mochaBabel = require("mocha-babel");

gulp.task("default", function() {
	return gulp.src(["src/*js"])
	.pipe(babel())
	.pipe(gulp.dest("dist"));
});

gulp.task("test", function() {
	return gulp.src(["test/*.js"])
	.pipe(mocha({
		compilers: {
			js: mochaBabel
		}
	}))
});

gulp.task("test:coverage", function(cb) {
	gulp.src(["src/*js"])
	.pipe(istanbul({
		instrumenter:isparta.Instrumenter,
		includeUntested:true
	}))
	.pipe(istanbul.hookRequire())
	.on("finish", function() {
		gulp.src(["test/*.js"])
		.pipe(mocha({
			compilers: {
				js: mochaBabel
			}
		}))
		.pipe(mocha())
		.pipe(istanbul.writeReports())
		.pipe(istanbul.enforceThresholds({ thresholds: { global: 90 }}))
		.on("end", cb)
	});
});
