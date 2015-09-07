"use strict";
var gulp = require("gulp");
var mocha = require("gulp-mocha");
var babel = require("gulp-babel");
var mochaBabel = require("mocha-babel");

gulp.task("default", function() {
	return gulp.src(["src/**/*js"])
	.pipe(babel())
	.pipe(gulp.dest("dist"));
});

gulp.task("test", function() {
	return gulp.src(["test/**/*.js"])
	.pipe(mocha({
		compilers: {
			js: mochaBabel
		}
	}));
});
