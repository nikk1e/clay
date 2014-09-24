'use strict';

module.exports = function (grunt) {
	require('load-grunt-tasks')(grunt);

	grunt.initConfig({ 
		watch: {
			options: {
				livereload: true,
			},
			html: {
				files: [ 'public/*.html', 'views/**/*.jade', 'public/**/*' ],
			},
			jshint: {
				files: [ 'public/js/*.js', 'app.js', '!public/js/*.min.js' ],
				tasks:  [ 'jshint' ]
			},
			express: {
				files:  [ './app.js', 'routes/**/*.js' ],
				tasks:  [ 'express:dev' ],
				options: {
					spawn: false
				}
			}
		},
		jshint: { 
			//options: { 
			//	jshintrc: '.jshintrc' 
			//}, 
			all: [ 'js/*.js', 'app.js', '!js/*.min.js', '!js/clay.js', '!js/parser.js' ] 
		},
		express: {
			options: {
			},
			dev: {
				options: {
					script: './app.js'
				}
			}
		}
	}); 

	grunt.registerTask('default', ['express:dev', 'watch']);
};