"use strict";
var gulp = require("gulp");
// test suites
var babelRegister = require("babel-core/register");
var exec = require("child_process").exec;
var mocha = require("gulp-mocha");
var istanbul = require("gulp-babel-istanbul");
gulp.task("default", function(cb) {
	exec("browserify -t babelify voctopus.js | uglifyjs > dist/voctopus.ugly.js", function(err, stdout, stderr) {
		console.log(stderr);
		console.log(stdout);
		cb(err);
	});
});

gulp.task("doc", function (cb) {
	exec("jsdox --templateDir docs/templates --output docs src/*.js", function(err, stdout, stderr) {
		console.log(stderr);
		console.log(stdout);
		cb(err);
	});
});

gulp.task("test", function() {
	return gulp.src(["test/*.js"])
	.pipe(mocha({
		bail:true,
		compilers: {
			js: babelRegister
		}
	}))
});

gulp.task("test:core", function() {
	return gulp.src(["test/voctopus.core.test.js"])
	.pipe(mocha({
		bail:true,
		compilers: {
			js: babelRegister
		}
	}))
});

gulp.task("test:util", function() {
	return gulp.src(["test/voctopus.util.test.js"])
	.pipe(mocha({
		bail:true,
		compilers: {
			js: babelRegister
		}
	}))
});

gulp.task("test:schema", function() {
	return gulp.src(["test/voctopus.schema.test.js"])
	.pipe(mocha({
		bail:true,
		compilers: {
			js: babelRegister
		}
	}))
});

gulp.task("test:coverage", function(cb) {
	gulp.src(["src/*js"])
	.pipe(istanbul())
	.pipe(istanbul.hookRequire())
	.on("finish", function() {
		gulp.src(["test/*.js"])
		.pipe(mocha({
			bail:true,
			compilers: {
				js:babelRegister 
			}
		}))
		.pipe(istanbul.writeReports())
		.on("end", cb)
	});
});
