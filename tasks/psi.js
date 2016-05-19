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

    // Globals
    var options = null;
    var reportDir = 'reports/';
    var psiReportDir = '';
    var psiReportFile = '/psi_report.csv';
    var psiReportFileData = null;
    var psiReport = '';
    var done = null;
    var serverUrl = null;

    function setReportFile() {

        psiReportDir = reportDir + options.url;

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
            // try to create the directory
            mkdirp(psiReportDir, function(err) {
                if (err) console.error(err)
            });
        }

        return psiReportDir + psiReportFile;

    }

    function readPsiReportFileData() {

        console.log('Read data from ' + psiReport);

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
                psiReportFileData = output;
                sumbitToPSI();
            });

            input.pipe(parser);

        } else {

            psiReportFileData = [];
            sumbitToPSI();

        }

    }

    function sumbitToPSI() {

        console.log('Submit ' + serverUrl + ' to Google PSI.');

        var psiOptions = {};
        if(options.strategy) {
            psiOptions.strategy = options.strategy
        }

        psi(serverUrl, psiOptions).then(function(data) {
            processPsiData(data);
        });

    }

    function processPsiData(psiData) {

        console.log('Received data from PSI');

        if(options.debug) {
            console.log(psiData);
        }

        var date = new Date();
        psiData.pageStats.date = date.toString();
        psiData.pageStats.score = psiData.score;
        psiReportFileData.push(psiData.pageStats);

        writeNewReport();

    }

    function writeNewReport() {

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
            data: psiReportFileData,
            fields: fields
        }, function(err, csv) {

            if (err) console.log(err);
            grunt.file.write(psiReport, csv);
            grunt.task.run(['psi-report']);
            done();

        });

    }

    grunt.registerMultiTask('psi', 'Automate running Google PSI with Grunt', function() {

        // Merge task-specific and/or target-specific options with these defaults.
        options = this.options({
            url: 'http://localhost',
            limit: 10,
            publicServer: true,
            debug: false
        });

        if (typeof(options.port) === 'string') {
            options.port = parseInt(options.port);
        }

        if (typeof(options.publicServer) === 'string') {
            options.publicServer = (options.publicServer === 'true')
        }

        if (typeof(options.debug) === 'string') {
            options.debug = (options.debug === 'true')
        }

        psiReport = setReportFile();

        done = this.async();

        if(!options.publicServer) {

            console.log('Open ngrok connection to localhost:' + options.port);

            ngrok.connect(options.port, function(err, ngrokServer) {

                console.log('Connected to ' + ngrokServer);

                if (err !== null) {
                    grunt.fail.fatal(err);
                    return done();
                }

                serverUrl = ngrokServer + options.path;
                readPsiReportFileData();


            });

        } else {

            serverUrl = options.url;

            if(Number.isInteger(options.port)) {
                serverUrl += ":" + options.port;
            }

            serverUrl += options.path;

            readPsiReportFileData();

        }

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
