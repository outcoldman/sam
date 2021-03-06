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
  var shapeColor = d3.interpolateRgb('#4F5E61', '#A6E7EF');

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
      this._gShapes = dsvg.append("g").attr("class", "shapes");
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
        gShape: this._gShapes.append("rect"),
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
          gPath: this._gLines.append('path'),
          dsvg: this.get('dsvg'),
          jsvg: this.get('jsvg'),
          gLines: this._gLines
        });
        this._links[id] = link;
      }
      this._links[id].update(settings);
    },

    updateNode: function(id, settings) {
      this.getOrAddNode(id).update(settings);
    },

    save: function(nodes) {
      var svgWidth = this.get('jsvg').width();
      var svgHeight = this.get('jsvg').height();
      _.each(this._nodes, function(v, k) {
        nodes.push({
          cx: v.get('cx')/svgWidth,
          cy: v.get('cy')/svgHeight,
          id: v.get('id'),
          link: v.get('link')
        });
      });
    },

    load: function(nodes) {
      var svgWidth = this.get('jsvg').width();
      var svgHeight = this.get('jsvg').height();
      if (nodes) {
        _.each(nodes, _.bind(function(v) {
          if (!this._nodes[v.id]) {
            this.addNode(v.id, {
              id: v.id,
              cx: v.cx * svgWidth,
              cy: v.cy * svgHeight,
              link: v.link
            });
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
      gPath: null,
      dsvg: null,
      jsvg: null,
      gLines: null
    },

    initialize: function() {
      this.get('gPath')
        .datum(this)
        .attr("class", "link_line")
        .attr("fill", "none")
        .attr('stroke', '#585858')
        .attr("id", this.get('id'));

      this.listenTo(this.get('source'), 'change:cx change:cy', this._drawCurve);
      this.listenTo(this.get('target'), 'change:cx change:cy', this._drawCurve);

      this._drawCurve();

      this.animate();
    },

    dispose: function() {
      this.stopListening(this.get('source'));
      this.stopListening(this.get('target'));
    },

    update: function(settings) {
      // Update background, etc
      this.set('weight', settings.weight);
      this._drawCurve();
    },

    _drawCurve: function() {
      var source = this.get('source');
      var target = this.get('target');

      var cx1 = source.get('cx'), cy1 = source.get('cy'),
          cx2 = target.get('cx'), cy2 = target.get('cy');

      var slopePlus90 = Math.atan2((+cy2 - cy1), (+cx2 - cx1)) + (Math.PI/2);

      var cxm = (cx1 + cx2) / 2 + 10 * Math.cos(slopePlus90);
      var cym = (cy1 + cy2) / 2 + 10 * Math.sin(slopePlus90);

      var points = [
        [cx1, cy1],
        [cxm, cym],
        [cx2, cy2]
      ];

      this.get('gPath').attr('d', lineInterpolate(points));
    },

    animate: function() {
      var self = this;

      var source = this.get('source');
      var target = this.get('target');

      var cx1 = source.get('cx'), cy1 = source.get('cy'),
          cx2 = target.get('cx'), cy2 = target.get('cy');

      var weight = this.get('weight');
      var path = this.get('gPath')[0][0];
      var length = path.getTotalLength();
      var a = [];

      for (var i = 0; i < 10; i++) {
        var aa = this.get('gLines')
          .append('circle')
          .attr('r', 3)
          .attr('class', 'data-circle')
          .attr('cx', cx1)
          .attr('cy', cy2)
          .attr('fill', '#616161')
          .attr('opacity', 0);
        a.push(aa);
      }

      var animation = { step: 0 };
      var animationTo = { step: 1 };
      var animationOptions = {
        duration: 2000,
        easing: 'easeOutSine',
        start: onStart,
        progress: onProgress,
        complete: onComplete
      };

      function onStart() {

      }

      function onProgress() {
        for (var i = 0; i < a.length; i++) {
          var p = path.getPointAtLength(length * (i / 10) * (1 - animation.step));
          a[i]
            .attr('cx', p.x)
            .attr('cy', p.y);
        }
      }

      function onComplete() {
        for (var i = 0; i < a.length; i++) {
          a[i]
            .attr('opacity', 0);
        }
        startAnimation();
      }

      function startAnimation() {
        animation.step = 0;
        cx1 = source.get('cx');
        cy1 = source.get('cy');
        cx2 = target.get('cx'); 
        cy2 = target.get('cy');
        weight = self.get('weight');
        length = path.getTotalLength();

        var w = Math.round(weight);
        if (w > 0) {
          var d = (10 / w);
          for (var i = 0; i < a.length; i++) {
            if (i % d === 0) {
              a[i]
                .attr('opacity', 1)
                .attr('cx', cx2 + (cx1 - cx2) * (i / 10))
                .attr('cy', cy2 + (cy1 - cy2) * (i / 10));
            }
          }
        }

        $(animation).animate(animationTo, animationOptions);
      }

      startAnimation();
    }
  });

  var Node = Backbone.Model.extend({
    defaults: {
      radius: 20,
      cx: 0,
      cy: 0,
      gShape: null
    },

    initialize: function() {
      this.listenTo(this, 'change:cx change:cy', this._redraw);

      var gShape = this.get('gShape');
      gShape
        .datum(this)
        .attr("class", "rect")
        .attr("id", this.get('id'))
        .attr("fill", shapeColor(1))
        .attr("width", this.get('radius'))
        .attr("height", this.get('radius'))
        .attr("x", this.get('cx') - this.get('radius')/2)
        .attr("y", this.get('cy') - this.get('radius')/2)
        .on("dblclick", _.bind(function(d,i) { 
          if (this.get('link')) {
            window.location.href = this.get('link');
          }
        }, this))
        .call(dragBehavior);

        gShape.append("svg:title")
          .text(function(d) { return d.id; });
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

    update: function(settings) {
      var gShape = this.get('gShape');
      gShape.attr('fill', shapeColor(settings.active));
    },

    _redraw: function() {
      this.get('gShape')
        .attr("width", this.get('radius'))
        .attr("height", this.get('radius'))
        .attr("x", this.get('cx') - this.get('radius')/2)
        .attr("y", this.get('cy') - this.get('radius')/2);
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

    updateNodes: function(nodes) {
      _.each(nodes, _.bind(function(n) {
        this._nodes.updateNode(n.id, n);
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