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

  var PageView = Backbone.View.extend({
    el: '#content',

    defaults: {
    },

    events: {
      'click #btnSave': 'savePage'
    },

    render: function() {
      this._svg = $('svg');

      this._searchManager = mvc.Components.get('appSearchManager');
      this._searchBarView = mvc.Components.get('appSearchBar');

      setTimeout(_.bind(function() {
          this._searchBarView.timerange.val({
              earliest_time: 'rt-5m',
              latest_time: 'rt'
          });
      }, this), 500);

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
      this._svg.empty();

      this._pageWidth = this._svg.width();
      this._pageHeight = this._svg.height();
      this._circleRadius = 30; /* radius of circles */
      this._offsetScale = 0.1; /* percentage of line line to offset curves */
      this._d3LineBasis = d3.svg.line().interpolate("basis");
      
      var d3color = d3.interpolateRgb("#BAE4B3", "#006D2C"); /* color range for flow lines */

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

      function createDefs(defs) {
          var dropShadowFilter = defs.append('svg:filter').attr('id', 'dropShadow');
          dropShadowFilter.append('svg:feGaussianBlur').attr('in', 'SourceAlpha').attr('stdDeviation', 1);
          dropShadowFilter.append('svg:feOffset').attr('dx', 0).attr('dy', 1).attr('result', 'offsetblur');
          var feMerge = dropShadowFilter.append('svg:feMerge');
          feMerge.append('svg:feMergeNode');
          feMerge.append('svg:feMergeNode').attr('in', "SourceGraphic");
      }

      var drag = d3.behavior.drag().origin(Object).on("drag", _.bind(function() {
          this._dragmove(this);
      }, this));

      //RANDOMLY GENERATE COORDINATES FOR CIRCLES
      var numCircles = 6; /* number of circles - you must update link source/target values to match changes in the number of circles */
      var circles = d3.range(numCircles).map(_.bind(function(i, d) {
          return [Math.round(50 + (i / numCircles) * (this._pageWidth - 50)), Math.round(30 + Math.random() * (this._pageHeight - 80))];
      }, this));

      //GLOBAL STRENGTH SCALE
      this._strength_scale = d3.scale.linear().range([2, 10]) /* thickness range for flow lines */
      .domain([0, d3.max(links, function(d) {
          return d.strength;
      })]);

      var color_scale = d3.scale.linear().range([0, 1]).domain([0, d3.max(links, function(d) {
          return d.strength;
      })]);

      var svg = d3.select("svg");

      var g_lines = svg.append("g").attr("class", "lines");
      var g_circles = svg.append("g").attr("class", "circles");

      //SHADOW DEFINITION
      createDefs(svg.append('svg:defs'));

      $.each(circles, _.bind(function(i, d) {
          g_circles.append("circle").attr('filter', 'url(#dropShadow)').attr("class", "circle").attr("id", "circle" + i).attr("r", this._circleRadius).attr("cx", d[0]).attr("cy", d[1]).call(drag);
      }, this));

      g_lines.selectAll(".link_line").data(links).enter().append("path").attr("class", "link_line").attr("fill", _.bind(function(d) {
          return d3color(color_scale(d.strength));
      }, this)).attr("id", _.bind(function(i, d) {
          return "link_line" + d;
      }, this)).attr("d", _.bind(function(d) {
          return this._drawCurve(d);
      }, this));
    },

    _dragmove: function(dragged) {
      var x = d3.select(dragged).attr("cx");
      var y = d3.select(dragged).attr("cy");
      d3.select(dragged).attr("cx", Math.max(this._circleRadius, Math.min(this._pageWidth - this._circleRadius, +x + d3.event.dx))).attr("cy", Math.max(this._circleRadius, Math.min(this._pageHeight - this._circleRadius, +y + d3.event.dy)));
      $.each(links, _.bind(function(i, link) {
        if (link.source == dragged.id.match(/\d+/)[0] || link.target == dragged.id.match(/\d+/)[0]) {
          d3.select('#link_line' + i).attr("d", _.bind(function(d) {
            return this._drawCurve(d);
          }, this));
        }
      }, this));
    },

    _drawCurve: function(d) {
      var slope = Math.atan2((+d3.select('#circle' + d.target).attr("cy") - d3.select('#circle' + d.source).attr("cy")), (+d3.select('#circle' + d.target).attr("cx") - d3.select('#circle' + d.source).attr("cx")));
      var slopePlus90 = Math.atan2((+d3.select('#circle' + d.target).attr("cy") - d3.select('#circle' + d.source).attr("cy")), (+d3.select('#circle' + d.target).attr("cx") - d3.select('#circle' + d.source).attr("cx"))) + (Math.PI/2);

      var sourceX = +d3.select('#circle' + d.source).attr("cx");
      var sourceY = +d3.select('#circle' + d.source).attr("cy");
      var targetX = +d3.select('#circle' + d.target).attr("cx");
      var targetY = +d3.select('#circle' + d.target).attr("cy");

      var halfX = (sourceX + targetX)/2;
      var halfY = (sourceY + targetY)/2;

      var lineLength = Math.sqrt(Math.pow(targetX - sourceX, 2) + Math.pow(targetY - sourceY, 2));

      var MP1X = halfX + (this._offsetScale * lineLength + this._strength_scale(d.strength)/2) * Math.cos(slopePlus90);
      var MP1Y = halfY + (this._offsetScale * lineLength + this._strength_scale(d.strength)/2) * Math.sin(slopePlus90);
      var MP2X = halfX + (this._offsetScale * lineLength - this._strength_scale(d.strength)/2) * Math.cos(slopePlus90);
      var MP2Y = halfY + (this._offsetScale * lineLength - this._strength_scale(d.strength)/2) * Math.sin(slopePlus90);

      var points = [];
      points.push([(sourceX - this._strength_scale(d.strength) * Math.cos(slopePlus90)),(sourceY - this._strength_scale(d.strength) * Math.sin(slopePlus90))]);
      points.push([MP2X,MP2Y]);
      points.push(([(targetX  + this._circleRadius * Math.cos(slope)), (targetY + this._circleRadius * Math.sin(slope))]));
      points.push(([(targetX  + this._circleRadius * Math.cos(slope)), (targetY + this._circleRadius * Math.sin(slope))]));
      points.push([MP1X, MP1Y]);
      points.push([(sourceX + this._strength_scale(d.strength) * Math.cos(slopePlus90)),(sourceY + this._strength_scale(d.strength) * Math.sin(slopePlus90))]);

      return this._d3LineBasis(points) + "Z";
    }
  });

  return PageView;
});