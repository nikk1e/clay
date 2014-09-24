/**
 * cube - computable document format.
 * Copyright (c) 2014, Benjamin Norrington
 */

//requires window.Cube
;(function(base){

var Cube = base.Cube;

var Graph = {};

Graph.LineB = function(ytitle, values, xvalues, series) {
  var elem = document.createElement('div');

  d3.select(elem).attr("style", "width: 100%; min-width: 400px; min-height: 250px;")

// DUMMY graph to test the result concept

  var margin = {top: 20, right: 30, bottom: 30, left: 80},
    width = 800 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;


  var x = d3.scale.ordinal()
  //.range(xvalues.map(function(d,i) { return i; }));
    //.range(xvalues)
      .rangeBands([0, width]);

  var y = d3.scale.linear()
      .range([height, 0]);

  var color = d3.scale.category10();

  var xAxis = d3.svg.axis()
      .scale(x)
      .orient("bottom");

  var yAxis = d3.svg.axis()
      .scale(y)
      .orient("left");

  var line = d3.svg.line()
      //.interpolate("basis")
      .x(function(d, i) { return x(xvalues[i]) + x.rangeBand()/2; })
      .y(function(d, i) { return y(d); });

  var svg = d3.select(elem).append('svg')
    //.attr("height", height + margin.top + margin.bottom)
    .attr("style", "width: 100%;")
    .attr("viewBox", "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
      //.attr("width", width + margin.left + margin.right)    
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  color.domain(series);
  x.domain(xvalues);
  y.domain([
    d3.min(values, function(vs) { return d3.min(vs, function(v) { return v }); }),
    d3.max(values, function(vs) { return d3.max(vs, function(v) { return v }); })
  ]);

  svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis);

  svg.append("g")
      .attr("class", "y axis")
      .call(yAxis)
    .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text(ytitle);

    var serieses = svg.selectAll(".series")
      .data(values)
      .enter().append("g")
      .attr("class", "series");

    serieses.append("path")
      .attr("class", "line")
      .attr("d", function(d) { return line(d); })
      .style("stroke", function(d, i) { return color(series[i]); });

    serieses.append("text")
      .datum(function(d, i) { return {name: xvalues[xvalues.length - 1], value: d[d.length - 1]}; })
      .attr("transform", function(d) { 
        return "translate(" + (x(d.name) + x.rangeBand()/2) + "," + y(d.value) + ")"; 
      })
      .attr("x", 3)
      .attr("dy", ".35em")
      .text(function(d, i) { return series[i]; });

  return elem;
};

Cube.Functions.Graph = Graph;

}(this || (typeof window !== 'undefined' ? window : global)));