var gulp = require("gulp");
var rename = require("gulp-rename");
var replace = require("gulp-replace");
var sourcemaps = require("gulp-sourcemaps");
var uglify = require("gulp-uglify");

var { version } = require("./package.json");

gulp.task("dist", () => gulp
	.src("src/parser.js")
	.pipe(sourcemaps.init())
	.pipe(rename("sactory-dom-parser.js"))
	.pipe(replace(/%version%/, version))
	.pipe(gulp.dest("dist"))
	.pipe(uglify({mangle: true}))
	.pipe(rename("sactory-dom-parser.min.js"))
	.pipe(sourcemaps.write("."))
	.pipe(gulp.dest("dist"))
);
