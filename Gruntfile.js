/*
 * grunt-psi
 * https://github.com/lggarrison/grunt-psi
 *
 * Copyright (c) 2015 Lacy Garrison
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({

        jshint: {
            all: [
                'Gruntfile.js',
                'tasks/*.js',
            ],
            options: {
                jshintrc: '.jshintrc'
            }
        },

        psi: {
            default_options: {
                options: {
                    port: 3000,
                    limit: 5,
                    strategy: "desktop",
                    publicServer: false
                }
            },
            custom_options: {
                options: {
                    port: 4001,
                    limit: 5,
                    strategy: "mobile",
                    publicServer: false
                }
            },
            bloomberg_options: {
                options: {
                    url: 'http://bloomberg.com',
                    limit: 5,
                    strategy: "desktop"
                }
            }
        },

    });

    grunt.loadTasks('tasks');

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-clean');

    grunt.registerTask('test', ['psi']);

    grunt.registerTask('default ', ['jshint', 'test']);

};
