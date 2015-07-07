/*
 * grunt-psi
 * https://github.com/lggarrison/grunt-psi
 *
 * Copyright (c) 2015 Lacy Garrison
 * Licensed under the MIT license.
 */

'use strict';

var ngrok = require('ngrok');
var psi = require('psi');
var json2csv = require('json2csv');
var fs = require("fs");
var csv = require('csv');
var Table = require('cli-table');
var mkdirp = require('mkdirp');

module.exports = function(grunt) {

    var options = null;
    var reportDir = 'reports/';
    var psiReportFile = '/psi_report.csv';
    var psiReport = '';

    grunt.registerMultiTask('psi', 'Automate running Speedgun with Grunt', function() {

        // Merge task-specific and/or target-specific options with these defaults.
        options = this.options({
            url: 'http://localhost',
            port: 4000,
            limit: 10,
            strategy: "desktop",
            threshold: 1
        });

        if (typeof(options.port) === 'string') {
            options.port = parseInt(options.port);
        }

        var done = this.async();

        var psiReportDir = reportDir + options.url;
        if (options.port !== null) {
            psiReportDir += '\:' + options.port;
        }

        psiReportDir = psiReportDir.replace(/(\:\/\/|\:)/g, "_");

        try {
            var stats = fs.lstatSync(psiReportDir);
            if (stats.isDirectory()) {
                // Do nothing
            }
        } catch (e) {
            mkdirp(psiReportDir, function(err) {
                if (err) console.error(err)
            });
        }

        psiReport = psiReportDir + psiReportFile;

        ngrok.connect(options.port, function(err, url) {

            if (err !== null) {
                grunt.fail.fatal(err);
                return done();
            }

            function createReport(data) {

                psi(
                    url, {
                        strategy: options.strategy,
                        threshold: options.threshold
                    },
                    function(err, psiData) {

                        var date = new Date();
                        psiData.pageStats.date = date.toString();
                        psiData.pageStats.score = psiData.score;
                        data.push(psiData.pageStats);

                        var fields = [
                            'date',
                            'score',
                            'numberResources',
                            'numberHosts',
                            'totalRequestBytes',
                            'numberStaticResources',
                            'htmlResponseBytes',
                            'cssResponseBytes',
                            'imageResponseBytes',
                            'javascriptResponseBytes',
                            'otherResponseBytes',
                            'numberJsResources',
                            'numberCssResources'
                        ];

                        json2csv({
                            data: data,
                            fields: fields
                        }, function(err, csv) {

                            if (err) console.log(err);
                            grunt.file.write(psiReport, csv);
                            grunt.task.run(['psi-report']);
                            done();

                        });

                    }
                );
            }

            if (grunt.file.isFile(psiReport)) {

                var input = fs.createReadStream(psiReport);
                var parser = csv.parse({
                    columns: true
                });
                var output = [];
                var record = null;

                parser.on('error', function(err) {
                    console.log(err.message);
                    done();
                });

                parser.on('readable', function() {
                    while (record = parser.read()) {
                        output.push(record);
                    }
                });

                parser.on('finish', function() {
                    createReport(output);
                });

                input.pipe(parser);

            } else {
                createReport([]);
            }

        });

    });

    grunt.registerTask('psi-report', function() {

        var done = this.async();

        function displayPsiReport() {

            var table = new Table({
                head: ['Date', '# of Resources', 'Total Bytes', 'HTML Bytes', 'CSS Bytes', 'Image Bytes', 'JS Bytes'],
                colWidths: [41, 23, 23, 23, 23, 23, 23]
            });

            var input = fs.createReadStream(psiReport);
            var parser = csv.parse({
                columns: true
            });
            var output = [];
            var record = null;

            parser.on('error', function(err) {
                console.log(err.message);
                done();
            });

            parser.on('readable', function() {
                while (record = parser.read()) {
                    output.push(record);
                }
            });

            parser.on('finish', function() {
                var outputLength = output.length;
                for (var i = (outputLength > options.limit) ? outputLength - options.limit : 0; i < outputLength; i++) {
                    record = output[i];
                    table.push([
                        record.date,
                        record.numberResources,
                        record.totalRequestBytes,
                        record.htmlResponseBytes,
                        record.cssResponseBytes,
                        record.imageResponseBytes,
                        record.javascriptResponseBytes
                    ]);
                }

                console.log('\n\n\n');
                console.log('Page Weight: Google Page Speed Insights');
                console.log(table.toString());
                console.log('\n\n\n');
                done();
            });

            input.pipe(parser);

        }

        if (grunt.file.isFile(psiReport)) {
            displayPsiReport();
        }

    });

    grunt.registerTask("default", ["psi"]);

};
