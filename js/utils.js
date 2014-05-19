/* globals VIZI: false, Q: false, _: false, THREE: false, d3: false, geoJSONArea: false, $: false,
          TWEEN: false */
(function(){
"use strict";

var applyVertexColors = function( g, c ) {
  g.faces.forEach( function( f ) {
    var n = ( f instanceof THREE.Face3 ) ? 3 : 4;
    for( var j = 0; j < n; j ++ ) {
      f.vertexColors[ j ] = c;
    }
  } );
};

var defaultColour = new THREE.Color(0xFF87FC);

window.createExtrudedObject = function(feature, geo, material) {

  var properties = feature.properties;

  // var area = properties.area;

  // // Skip if building area is too small
  // if (area < 200) {
  // return;
  // }

  var addPath = function(shape){
    return function(element, index) {
      var projectedCoords = geo.projection(element);

      // Move if first coordinate
      if (index === 0) {
        shape.moveTo( projectedCoords[0], projectedCoords[1] );
      } else {
        shape.lineTo( projectedCoords[0], projectedCoords[1] );
      }
    };
  };

  var coords = feature.coordinates;
  var shape = new THREE.Shape();
  if (coords.length > 0) {
    _.each(coords[0], addPath(shape));
  }
  if (coords.length > 1) {
    var hole;
    for (var i = 1; i < coords.length; i += 1) {
      hole = new THREE.Path();
      _.each(coords[i], addPath(hole));
      shape.holes.push(hole);
    }
  }

  // Height value is in meters
  var height = properties.height * geo.pixelsPerMeter;

  var extrudeSettings = { amount: height, bevelEnabled: false };
  var geom = new THREE.ExtrudeGeometry( shape, extrudeSettings );

  // Check if this shape only has four points, allowing us
  // to do roof shortcuts
  if (shape.curves.length === 4) {

    // Check if it's a gabled roof
    if (properties.roof.shape === "gabled") {

      // Roof geometry
      var roof = new THREE.Geometry();

      // Grab the points from the shape
      var points = shape.extractPoints();

      // Figure out the roof height
      var roofHeight = -(height / 2);

      // Figure out the center points
      var center1 = points.shape[0].clone().lerp(points.shape[1], 0.5);
      var center2 = points.shape[2].clone().lerp(points.shape[3], 0.5);

      // Create the vertices
      var vertices = [
        new THREE.Vector3(points.shape[0].x, points.shape[0].y, 0),
        new THREE.Vector3(center1.x,         center1.y,         roofHeight),
        new THREE.Vector3(points.shape[1].x, points.shape[1].y, 0),
        new THREE.Vector3(points.shape[2].x, points.shape[2].y, 0),
        new THREE.Vector3(center2.x,         center2.y,         roofHeight),
        new THREE.Vector3(points.shape[3].x, points.shape[3].y, 0),
      ];

      // Ensure the points are clockwise
      var clockwise = THREE.Shape.Utils.isClockWise(vertices);
      if (!clockwise) {
        vertices = vertices.reverse();
      }

      roof.vertices = vertices;

      // Side 1
      roof.faces.push(new THREE.Face3(3, 4, 1));
      roof.faces.push(new THREE.Face3(3, 1, 2));

      // Front/Back
      roof.faces.push(new THREE.Face3(4, 3, 5));
      roof.faces.push(new THREE.Face3(1, 0, 2));

      // Side 2
      roof.faces.push(new THREE.Face3(0, 1, 4));
      roof.faces.push(new THREE.Face3(0, 4, 5));

      // We aren't generating actual UVs, but the exporter needs
      // some placeholder points
      _.each(roof.faces, function() {
        roof.faceVertexUvs[0].push([false, false, false]);
      });

      // Add to the building geometry
      THREE.GeometryUtils.merge(geom, roof);
    }
  }

  var elementColour = (properties.colour) ? new THREE.Color(properties.colour) : defaultColour;
  applyVertexColors( geom, elementColour );

  geom.computeFaceNormals();
  var mesh = new THREE.Mesh(geom, material);

  mesh.position.y = height;

  // Flip buildings as they are up-side down
  mesh.rotation.x = 90 * Math.PI / 180;

  return mesh;
};

}());