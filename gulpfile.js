var gulp = require('gulp'),
	browserify = require('gulp-browserify'),
	html = require('html-browserify'),
	jshint = require('gulp-jshint'),
	concat = require('gulp-concat'),
	plumber = require('gulp-plumber');

gulp.task('lint', function(){

	gulp.src(['./src/**/*.js'])
		.pipe(plumber())
		.pipe(jshint())
		.pipe(jshint.reporter('jshint-stylish'))
		.pipe(jshint.reporter('fail'));

});

gulp.task('compile-scripts', ['lint'], function() {

	gulp.src(['./src/app.js'])
		.pipe(plumber())
		.pipe(browserify({
			transform: [html],
			debug : true
		}))
		.pipe(concat('build.js'))
		.pipe(gulp.dest('./dist/'))
		
});

var livereload = require('gulp-livereload');

gulp.task('server', function() {

    var server = livereload();
    gulp.watch(['*.html','./src/**/*.js'], function(evt) {
    	gulp.run('compile-scripts', function(){;
	        setTimeout(function(){ server.changed(evt.path); },400);
	    });
    });

});

gulp.task('default', function() {

    gulp.watch(['./src/**/*.js'],function(event){
    	gulp.run('compile-scripts');
    });

});

