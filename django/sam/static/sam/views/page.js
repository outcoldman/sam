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
  var linkColor = d3.interpolateRgb("#BAE4B3", "#006D2C");
  var linkColorScale = d3.scale.linear().range([0, 1]).domain([0, 10]);

  var Nodes = Backbone.Model.extend({
    defaults: {
      dsvg: null,
      jsvg: null
    },

    initialize: function() {
      this.clear();
    },

    clear: function() {
      _.each(this._links, function(v) {
        v.dispose();
      });

      _.each(this._nodes, function(v) {
        v.dispose();
      });

      this._nodes = {};
      this._links = {};
    },

    draw: function() {
      var dsvg = this.get('dsvg');
      this._gCircles = dsvg.append("g").attr("class", "circles");
      this._gLines = dsvg.append("g").attr("class", "lines");
    },

    getOrAddNode: function(id) {
      if (!this._nodes[id]) {
        // Unknown node - let's create new one
        this.addNode(
          id, 
          {
            cx: Math.round(50 + Math.random() * (this.get('jsvg').width() - 50)), 
            cy: Math.round(30 + Math.random() * (this.get('jsvg').height() - 80))
          }
        );
      }

      return this._nodes[id];
    },

    addNode: function(id, settings) {
      this._nodes[id] = new Node(_.extend(settings, {
        gCircle: this._gCircles.append("circle"),
        id: id,
        pageWidth: this.get('jsvg').width(),
        pageHeight: this.get('jsvg').height()
      }));
    },

    updateLink: function(sourceId, targetId, settings) {
      var id = sourceId + "@" + targetId;
      if (!this._links[id]) {
        var link = new Link({
          id: id,
          source: this.getOrAddNode(sourceId),
          target: this.getOrAddNode(targetId),
          gPath: this._gLines.append('path')
        });
        this._links[id] = link;
      }
      this._links[id].update(settings);
    },

    save: function(nodes) {
      _.each(this._nodes, function(v, k) {
        nodes.push({
          cx: v.get('cx'),
          cy: v.get('cy'),
          id: v.get('id')
        });
      });
    },

    load: function(nodes) {
      if (nodes) {
        _.each(nodes, _.bind(function(v) {
          if (!this._nodes[v.id]) {
            this.addNode(v.id, v);
          }
        }, this));
      }
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
        .attr("id", this.get('id'))
        .attr('stroke', 'red');

      this.listenTo(this.get('source'), 'change:cx change:cy', this._drawCurve);
      this.listenTo(this.get('target'), 'change:cx change:cy', this._drawCurve);

      this._drawCurve();
    },

    dispose: function() {
      this.stopListening(this.get('source'));
      this.stopListening(this.get('target'));
    },

    update: function(settings) {
      // Update background, etc
      this.get('gPath')
        .attr('stroke', linkColor(linkColorScale(settings.weigth)));
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
      this.listenTo(this, 'change:cx change:cy', this._redraw);

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

    dispose: function() {
      this.stopListening(this);
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
      var m = {
        search: this._searchBarView.val(),
        earliest_time: this._searchBarView.timerange.val().earliest_time,
        latest_time: this._searchBarView.timerange.val().latest_time,
        nodes: []
      };

      this._nodes.save(m.nodes);

      this.model().save(m);

      return false; // To not reload the page
    },

    model: function(model) {
      if (arguments.length > 0) {
        if (this._model) {
          this._searchManager.stopSearch();
          this._nodes.clear();
          this.stopListening(this._model);
        }

        this._model = model;

        this.listenTo(this._model, 'sync', this._syncSuccess);
        this.listenTo(this._model, 'error', this._syncError);

        if (!this._model.isNew()){
          this._model.fetch();
        } else {
          this._draw();
        }
      }
      return this._model;
    },

    updateLinks: function(links) {
      _.each(links, _.bind(function(l) {
        this._nodes.updateLink(l.source, l.target, l);
      }, this));
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

      this._nodes.clear();
      this._nodes.draw();
      this._nodes.load(this.model().get('nodes'));
    }
  });

  return PageView;
});