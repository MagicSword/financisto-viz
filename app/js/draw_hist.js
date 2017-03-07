const parseTime = d3.timeFormat("%Y-%m");
let width, height
let x, y
let g

function init() {
  //d3.select("svg").remove()
  var svg = d3.select("svg"),
      margin = {top: 20, right: 20, bottom: 30, left: 60}
  width = +svg.attr("width") - margin.left - margin.right
  height = +svg.attr("height") - margin.top - margin.bottom;

  x = d3.scaleBand().range([0, width]).padding(0.2);
  y = d3.scaleLinear().range([height, 0]);

  g = svg.append("g")
    .attr("id", "barchart")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  g.append("g")
    .attr("class", "axis axis--x")

  g.append("g")
    .attr("class", "axis axis--y")

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -width/2 + 40)
    .attr("y", -56)
    .attr("dy", "0.71em")
    .attr("text-anchor", "end")
    .text("Balance");

}

function histogram(data) {

  data.forEach( elm => {
    elm.value = Math.round(elm.value / 100)
  })

  let vis = d3.select("#barchart")

  valueMax = d3.max(data, function(d) {return d.value})
  valueMin = d3.min(data, function(d) {return d.value})

  x.domain(data.map(function(d) { return parseTime(d.date); }));
  y.domain([valueMin, valueMax]);

  let axisX = d3.select(".axis--x")
  let axisY = d3.select(".axis--y")

  axisX
    .attr("transform", "translate(0," + y(0) + ")")
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", function(d, i) {
      if(data[i].value < 0) return "translate(0,-20)"
    })
    .exit()
    .remove()

  axisY
    .call(d3.axisLeft(y).ticks(5))
    .exit()
    .remove()

  let bar = vis.selectAll(".bar").data(data)

  bar.enter().append("rect")
    .attr("class", "bar")
    .attr("x", function(d) { return x(parseTime(d.date)); })
    .attr("y", function(d) {
      if(d.value > 0) return y(d.value)
      else return y(0)
    })
    .attr("width", x.bandwidth())
    .attr("height", function(d) {
      if(d.value > 0) return y(0) - y(d.value);
      else return y(d.value) - y(0)
    });

  bar.exit()
    .transition()
    .duration(300)
    .ease(d3.easeExp)
      .attr("width", 0)
      .remove()

  bar
    //.attr("stroke-width", 4)
    .transition()
    .duration(300)
    .ease(d3.easeQuad)
      .attr("x", function(d) { return x(parseTime(d.date)); })
      .attr("y", function(d) {
        if(d.value > 0) return y(d.value)
        else return y(0)
      })
      .attr("width", x.bandwidth())
      .attr("height", function(d) {
        if(d.value > 0) return y(0) - y(d.value);
        else return y(d.value) - y(0)
      })
      // .attr("transform", function(d, i) {
      //   return "translate(" + [0, y(i)] + ")"
      // })
}

module.exports = {
  histogram: histogram
}
