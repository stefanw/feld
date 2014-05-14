/*jshint quotmark: false */
/* globals _, VIZI, Q, d3, simplify, throat */

(function() {
  "use strict";

  VIZI.DataOverpassCustom = function(options) {
    VIZI.Log("Inititialising Custom Overpass API manager");

    _.defaults(options, {
      gridUpdate: true,
      urlBase: "http://overpass-api.de/api/interpreter?data=",
      query: {
        way:[
          '"building"',
          'aeroway~"aerodrome|runway"',
          'waterway~"riverbank|dock"',
          'waterway="canal"][area="yes"',
          'natural~"water|scrub"',
          'leisure~"park|pitch"',
          'landuse~"grass|meadow|forest"'
        ]
      }
    });
    if (VIZI.ENABLE_ROADS) {
      options.query.way.push(
        'highway~"motorway|trunk|primary|secondary|tertiary|motorway_link|primary_link|secondary_link|tertiary_link|road"'
      );
    }

    VIZI.Data.call(this);
    this.objectManager = new VIZI.ObjectManagerOverpass();


    this.url = options.urlBase + this.buildQuery(options.query);
    this.urlHigh = this.url;
    // this.urlBase = "http://overpass.osm.rambler.ru/cgi/interpreter?data=";
    // this.urlBase = "http://api.openstreetmap.fr/oapi/interpreter?data=";

    if (options.gridUpdate) {
      this.subscribe("gridUpdated", this.update);
    }
  };
  VIZI.DataOverpassCustom.prototype = Object.create( VIZI.DataOverpassCache.prototype );

  VIZI.DataOverpassCustom.prototype.buildQuery = function(query) {
    var out = ["[out:json];("];
    var kindAccessor = {
      "rel": ";(._;way(r););(._;node(w););",
      "way": "(._;node(w););"
    };
    for (var kind in query) {
      out.push("(");
      for (var i = 0; i < query[kind].length; i += 1) {
        if (query[kind][i]) {
          out.push(kind + "({s},{w},{n},{e})[" + query[kind][i].replace(/"/g, "%22") + "];");
        }
      }
      out.push(");" + kindAccessor[kind]);
    }
    out.push(");out;");
    return out.join("");
  };

  VIZI.DataOverpassCustom.prototype.load = function(url, parameters, cacheKey) {
    var self = this;
    var deferred = Q.defer();

    var fileCacheKey = cacheKey.replace(':', '-').replace('.', '_');
    if (this.cache.get(cacheKey)) {
      return VIZI.DataOverpass.prototype.load.call(self, url, parameters, cacheKey);
    }

    var resolvedUrl = url.replace(/\{([swne])\}/g, function(value, key) {
      // Replace with paramter, otherwise keep existing value
      return parameters[key];
    });

    if (this.commands === undefined) {
      this.commands = [];
    }

    this.commands.push('curl "' + resolvedUrl + '" > ' + fileCacheKey.replace(':', '-') + '.json');
    if (this.cache.get(cacheKey)) {
      return VIZI.DataOverpass.prototype.load.call(self, url, parameters, cacheKey);
    }

    var allowedRange = ['17602-10752', '17602-10753', '17602-10754', '17603-10751', '17603-10752', '17603-10753', '17603-10754', '17604-10751', '17604-10752', '17604-10753', '17604-10754', '17605-10751', '17605-10752', '17605-10753', '17605-10754'];
    if (allowedRange.indexOf(fileCacheKey) === -1) {
      deferred.resolve();
    } else {

      d3.json('./overpass/' + fileCacheKey + '.json', function(error, data){
        if (error) {
          VIZI.DataOverpass.prototype.load.call(self, url, parameters, cacheKey)
            .then(function(){
              deferred.resolve();
            });
        } else {
          self.loadingDone(error, data, cacheKey, deferred);
        }
      });
    }

    return deferred.promise;
  };

  VIZI.DataOverpassCustom.prototype.processHeight = function(tags) {
    // Distance conversion
    // From: https://github.com/kekscom/osmbuildings/blob/master/src/Import.js#L39
    var height;
    var scalingFactor = (tags["building"] === "office") ? 1.45 : 1;
    if (tags.height) {
      height = this.toMeters(tags.height);
    } else if (!height && tags["building:height"]) {
      height = this.toMeters(tags["building:height"]);
    } else if (!height && tags.levels) {
      height = tags.levels * this.METERS_PER_LEVEL * scalingFactor <<0;
    } else if (!height && tags["building:levels"]) {
      height = tags["building:levels"] * this.METERS_PER_LEVEL * scalingFactor <<0;
    } else if (tags["building"]) {
      height = 20;
    } else if (tags["landuse"] === "forest") {
      height = 7;
    // } else if (tags["waterway"] || tags["natural"] && /water|scrub/.test(tags["natural"]) || tags["leisure"] && /park|pitch/.test(tags["leisure"]) || tags["landuse"] && /grass|meadow|commercial|retail|industrial|brownfield/.test(tags["landuse"])) {
    } else if (tags["waterway"] || tags["natural"] === "water") {
      height = 4;
    } else if (tags["natural"] === "scrub" || tags["leisure"] && /park|pitch/.test(tags["leisure"]) || tags["landuse"] && /grass|meadow/.test(tags["landuse"]) || tags["aeroway"] === "runway") {
      height = 3;
    } else {
      height = 1;
    }

    height *= this.geo.pixelsPerMeter;

    return height;
  };

}());