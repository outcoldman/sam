var deps = [
    'splunkjs/ready!',
    'underscore', 
    'backbone',
    'sam/models/page',
    'd3'
];

define(
  'sam/views/page', 
  deps, 
  function() { 'use strict';

  var _ = require('underscore');
  var Backbone = require('backbone');
  var mvc = require('splunkjs/ready!');
  var PageModel = require('sam/models/page');
  var d3 = require('d3');

  var dragBehavior = d3.behavior.drag().origin(Object).on("drag", function dragMove(dragged) {
    if (dragged.move) {
      dragged.move(d3.event.dx, d3.event.dy);
    }
  });

  var lineInterpolate = d3.svg.line().interpolate("basis");

  var Nodes = Backbone.Model.extend({
    defaults: {
      dsvg: null,
      jsvg: null
    },

    initialize: function() {
      this._nodes = {};
      this._links = {};
    },

    draw: function() {
      var dsvg = this.get('dsvg');
      this._gCircles = dsvg.append("g").attr("class", "circles");
      this._gLines = dsvg.append("g").attr("class", "lines");
    },

    addNode: function(id, settings){
      var node = new Node(_.extend(settings, {
        gCircle: this._gCircles.append("circle"),
        id: id,
        pageWidth: this.get('jsvg').width(),
        pageHeight: this.get('jsvg').height()
      }));
      this._nodes[id] = node;
      this.listenTo(node, 'change:cx change:cy', this._updateLinks);
    },

    updateLink: function(sourceId, targetId, settings) {
      var id = sourceId + "@" + targetId;
      var link = new Link({
        id: id,
        source: this._nodes[sourceId],
        target: this._nodes[targetId],
        gPath: this._gLines.append('path')
      });
      this._links[id] = link;
    }
  });

  var Link = Backbone.Model.extend({
    defaults: {
      id: null,
      source: null,
      target: null,
      gPath: null
    },

    initialize: function() {
      this.get('gPath')
        .datum(this)
        .attr("class", "link_line")
        .attr("id", this.get('id'));

      this.listenTo(this.get('source'), 'change:cx change:cy', this._drawCurve);
      this.listenTo(this.get('target'), 'change:cx change:cy', this._drawCurve);

      this._drawCurve();
    },

    _drawCurve: function() {
      var source = this.get('source');
      var target = this.get('target');

      var points = [
        [source.get('cx'), source.get('cy')],
        [target.get('cx'), target.get('cy')]
      ];

      this.get('gPath').attr('d', lineInterpolate(points));
    }
  });

  var Node = Backbone.Model.extend({
    defaults: {
      radius: 30,
      cx: 0,
      cy: 0,
      gCircle: null
    },

    initialize: function() {
      this.on('change:cx change:cy', this._redraw);

      var gCircle = this.get('gCircle');
      gCircle
        .datum(this)
        .attr("class", "circle")
        .attr("id", this.get('id'))
        .attr("r", this.get('radius'))
        .attr("cx", this.get('cx'))
        .attr("cy", this.get('cy'))
        .call(dragBehavior);
    },

    move: function(dx, dy) {
      var x = this.get('cx');
      var y = this.get('cy');
      this.set({
        cx: Math.max(this.get('radius'), Math.min(this.get('pageWidth') - this.get('radius'), + x + dx)),
        cy: Math.max(this.get('radius'), Math.min(this.get('pageHeight') - this.get('radius'), + y + dy))
      });
    },

    _redraw: function() {
      this.get('gCircle')
        .attr("cx", this.get('cx'))
        .attr("cy", this.get('cy'));
    }
  });

  var PageView = Backbone.View.extend({
    el: '#content',

    defaults: {
    },

    events: {
      'click #btnSave': 'savePage'
    },

    render: function() {
      this._dsvg = d3.select('svg');
      this._jsvg = $('svg');

      this._searchManager = mvc.Components.get('appSearchManager');
      this._searchBarView = mvc.Components.get('appSearchBar');

      setTimeout(_.bind(function() {
          this._searchBarView.timerange.val({
              earliest_time: 'rt-5m',
              latest_time: 'rt'
          });
      }, this), 500);

      this._nodes = new Nodes({
        dsvg: this._dsvg,
        jsvg: this._jsvg
      });

      return this;
    },

    create: function() {
      this.model(new PageModel());
    },

    load: function(id) {
      var model = new PageModel();
      model.displayId(id);
      this.model(model);
    },

    savePage: function() {
      this.model().save({
        search: this._searchBarView.val(),
        earliest_time: this._searchBarView.timerange.val().earliest_time,
        latest_time: this._searchBarView.timerange.val().latest_time
      });

      return false; // To not reload the page
    },

    model: function(model) {
      if (arguments.length > 0) {
        if (this._model) {
          this._searchManager.stopSearch();
          this.stopListening(this._model);
        }

        this._model = model;

        this.listenTo(this._model, 'sync', this._syncSuccess);
        this.listenTo(this._model, 'error', this._syncError);

        if (!this._model.isNew()){
          this._model.fetch();
        }
      }
      return this._model;
    },

    _syncSuccess: function(model) {
      Backbone.history.navigate(model.displayId());

      this._searchBarView.val(model.get('search'));
      this._searchBarView.timerange.val({
          earliest_time: model.get('earliest_time'),
          latest_time: model.get('latest_time')
      });

      this._draw();
      this._searchManager.startSearch();
    },

    _syncError: function(model, err) {
      alert(JSON.stringify(err));
    },

    _draw: function() {
      this._jsvg.empty();

      this._nodes.draw();

      this._pageWidth = this._jsvg.width();
      this._pageHeight = this._jsvg.height();



      //A LIST OF LINKS BETWEEN CIRCLES
      var links = [
          {
          source: 0,
          target: 5,
          strength: Math.round(Math.random() * 10)},
      {
          source: 0,
          target: 2,
          strength: Math.round(Math.random() * 10)},
      {
          source: 1,
          target: 3,
          strength: Math.round(Math.random() * 10)},
      {
          source: 2,
          target: 4,
          strength: Math.round(Math.random() * 10)},
      {
          source: 3,
          target: 5,
          strength: Math.round(Math.random() * 10)},
      {
          source: 5,
          target: 0,
          strength: Math.round(Math.random() * 10)},
      {
          source: 2,
          target: 0,
          strength: Math.round(Math.random() * 10)},
      {
          source: 3,
          target: 1,
          strength: Math.round(Math.random() * 10)}
      ];

      //RANDOMLY GENERATE COORDINATES FOR CIRCLES
      var numCircles = 6;
      d3.range(numCircles).map(_.bind(function(i) {
        this._nodes.addNode(
          i, 
          {
            cx: Math.round(50 + (i / numCircles) * (this._pageWidth - 50)), 
            cy: Math.round(30 + Math.random() * (this._pageHeight - 80))
          }
        );
      }, this));

      links.forEach(_.bind(function(line) {
        this._nodes.updateLink(line.source, line.target, line);
      }, this));
    }
  });

  return PageView;
});