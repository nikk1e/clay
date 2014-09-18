'use strict';

module.exports = function (grunt) {
	require('load-grunt-tasks')(grunt);

	grunt.initConfig({ 
		watch: {
			options: {
				livereload: true,
			},
			html: {
				files: [ '*.html' ],
			},
			jshint: {
				files: [ 'js/*.js', 'server.js', '!js/*.min.js' ],
				tasks:  [ 'jshint' ]
			},
			express: {
				files:  [ './server.js' ],
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
			all: [ 'js/*.js', 'server.js', '!js/*.min.js', '!js/clay.js', '!js/parser.js' ] 
		},
		express: {
			options: {
			},
			dev: {
				options: {
					script: './server.js'
				}
			}
		}
	}); 

	grunt.registerTask('default', ['express:dev', 'watch']);
};