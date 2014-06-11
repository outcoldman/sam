var deps = [
    'splunkjs/ready!',
    'underscore', 
    'backbone',
    'sam/views/page'
];

define(
  'sam/routers/router', 
  deps, 
  function() { 'use strict';

  var _ = require('underscore');
  var Backbone = require('backbone');
  var mvc = require('splunkjs/ready!');
  var PageView = require('sam/views/page');

  var Router = Backbone.Router.extend({
    routes: {
      '': 'create',
      ':id': 'show'
    },

    create: function() {
      this.pageView().create();
    },

    show: function(id) {
      this.pageView().load(id);
    },

    pageView: function() {
      return this._pageView || (this._pageView = new PageView().render());
    }
  });

  return Router;
});