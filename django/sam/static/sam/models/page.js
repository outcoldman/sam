var deps = [
    'splunkjs/ready!',
    'underscore', 
    'backbone'
];

define(
  'sam/models/page', 
  deps, 
  function() { 'use strict';

  var _ = require('underscore');
  var Backbone = require('backbone');
  var mvc = require('splunkjs/ready!');

  var baseUrl = 'https://api.mongolab.com/api/1/databases/splunk-activity-monitor/collections/pages';
  var addUrl = '?apiKey=8beBSPN-nKYvRxczasPH16nEo1ZAavw5';

  var Page = Backbone.Model.extend({
    idAttribute: "_id",

    url: function() {
      if (this.isNew()) {
        return baseUrl + addUrl;
      } else {
        return baseUrl + '/' + this.displayId() + addUrl;
      }
    },

    displayId: function(oid) {
      if (this.isNew()) {
        this.set({'_id': { $oid: oid }});
      }
      return this.id.$oid;
    }
  });

  return Page;
});