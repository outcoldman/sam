/*jshint globalstrict: true*/ 'use strict';

var _ = require('underscore'),
    path = require('path'),
    splunkWatchConfig = require('./../lib/watchConfig');

module.exports = function(grunt) {
  grunt.config.requires('splunk.splunkHome');
  var splunkHome = grunt.config('splunk.splunkHome');

  var resolveSplunkDirectory = function(relative) {
    return path.resolve(splunkHome, relative);
  };


  grunt.loadNpmTasks('grunt-contrib-watch');

  /*
   * Register grunt task 'splunk-watch'
   */
  grunt.registerTask('splunk-watch', 'Watch splunk changes', function() {
    var watchConfig = {};

    if (arguments.length > 2) {
      grunt.fatal('Unexpected number of arguments.');
    }

    // If current application is specified - use it
    var watchTarget = arguments[0];
    var watchArgument = arguments[1];
    if (!watchTarget && !watchArgument) {
      var splunkApp = grunt.config('splunk.splunkApp');
      if (splunkApp) {
        watchTarget = 'apps';
        watchArgument = splunkApp;
      }
    }

    // Generate watch configuration from arguments.
    // Options:
    // apps - all applications
    // apps/[app] - specific application
    // splunk - all web (python) files under share/splunk
    // * - everything (splunk and apps)
    switch(watchTarget) {
      case 'apps': { // splunk-watch:apps:[app]
        var app = watchArgument || '*';
        grunt.log.subhead('Watching etc/apps/' + app + '...');
        splunkWatchConfig.watchForApp(watchConfig, app);
        break;
      }
      case 'splunk': { // splunk-watch:splunk
        grunt.log.subhead('Watching share/splunk...');
        splunkWatchConfig.watchForSplunk(watchConfig);
        break;
      }
      case undefined: // 0 arguments also means splunk-watch:*
      case '*': { // splunk-watch:*
        grunt.log.subhead('Watching all...');
        splunkWatchConfig.watchForApp(watchConfig);
        splunkWatchConfig.watchForSplunk(watchConfig);
        break;
      }
      default: {
        grunt.fatal('Unknown watch argument ' + watchTarget);
        break;
      }
    }
    
    grunt.log.debug('Watch config:\n' + JSON.stringify(watchConfig, null, '\t'));
    _(watchConfig).each(function(val, key) {
      grunt.config.set('watch.' + key, val);
    });
    grunt.task.run(['watch']);
  });
};