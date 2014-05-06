/* globals window, _, VIZI, d3 */
(function() {
  "use strict";

  Date.prototype.toDateInputValue = function() {
      var local = new Date(this);
      local.setMinutes(this.getMinutes() - this.getTimezoneOffset());
      return local.toJSON().slice(0,10);
  };
  Date.prototype.toTimeInputValue = function() {
      var local = new Date(this);
      local.setMinutes(this.getMinutes() - this.getTimezoneOffset());
      return local.toJSON().slice(11, 16);
  };

  function update(){
    var d = $('#date').val().split('-');
    var t = $('#time').val().split(':');
    var c = [52.3, 13.4];
    var castInt = function(x){return parseInt(x, 10);};
    d = _.map(d, castInt);
    t = _.map(t, castInt);
    t[0] = t[0] + Math.floor(new Date().getTimezoneOffset() / 60);
    t[1] = t[1] + Math.floor(new Date().getTimezoneOffset() % 60);
    console.log(d, t, c);
    var res = sunPosition(d[0], d[1], d[2], t[0], t[1], 0, c[0], c[1]);
    console.log(res);
    instance.azimuth = res[0];
    instance.elevation = res[1];
    instance.publish('sunlightChanged')
  };

  function sunPosition(year, month, day, hour, min, sec, lat, lon) {
    'use strict';

    hour = (hour === undefined) ? 12 : hour;
    min = (min === undefined) ? 0 : min;
    sec = (sec === undefined) ? 0 : sec;
    lat = (lat === undefined)? 52.46 : lat;
    lon = (lon === undefined) ? 13.34 : lon;
    console.log(year, month, day, hour, min, sec, lat, lon);
    var twopi = 2 * Math.PI;
    var deg2rad = Math.PI / 180;

    // Get day of the year, e.g. Feb 1 = 32, Mar 1 = 61 on leap years
    var monthDays = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30];
    var i = 0;
    while (i < month) {
      day += monthDays[i];
      i += 1;
    }

    var leapdays = year % 4 === 0 && (year % 400 === 0 || year % 100 !== 0) && day >= 60 && !(month === 2 && day === 60);
    if (leapdays) {
      day += 1;
    }

    // Get Julian date - 2400000
    hour = hour + min / 60 + sec / 3600; // hour plus fraction
    var delta = year - 1949;
    var leap = Math.floor(delta / 4); // former leapyears
    var jd = 32916.5 + delta * 365 + leap + day + hour / 24;

    // The input to the Atronomer's almanach is the difference between
    // the Julian date and JD 2451545.0 (noon, 1 January 2000)
    var time = jd - 51545;

    // Ecliptic coordinates

    // Mean longitude
    var mnlong = 280.460 + 0.9856474 * time;
    mnlong = mnlong % 360;
    if (mnlong < 0) {
      mnlong += 360;
    }

    // Mean anomaly
    var mnanom = 357.528 + 0.9856003 * time;
    mnanom = mnanom % 360;
    if (mnanom < 0) {
      mnanom += 360;
    }
    mnanom = mnanom * deg2rad;

    // Ecliptic longitude and obliquity of ecliptic
    var eclong = mnlong + 1.915 * Math.sin(mnanom) + 0.020 * Math.sin(2 * mnanom);
    eclong = eclong % 360;
    if (eclong < 0) {
      eclong += 360;
    }
    var oblqec = 23.439 - 0.0000004 * time;
    eclong = eclong * deg2rad;
    oblqec = oblqec * deg2rad;

    // Celestial coordinates
    // Right ascension and declination
    var num = Math.cos(oblqec) * Math.sin(eclong);
    var den = Math.cos(eclong);
    var ra = Math.atan(num / den);
    if (den < 0) {
      ra += Math.PI;
    }
    if (den >= 0 && num < 0) {
      ra += twopi;
    }
    var dec = Math.asin(Math.sin(oblqec) * Math.sin(eclong));

    // Local coordinates
    // Greenwich mean sidereal time
    var gmst = 6.697375 + 0.0657098242 * time + hour;
    gmst = gmst % 24;
    if (gmst < 0) {
      gmst += 24.0;
    }

    // Local mean sidereal time
    var lmst = gmst + lon / 15.0;
    lmst = lmst % 24.0;
    if (lmst < 0) {
      lmst += 24.0;
    }
    lmst = lmst * 15.0 * deg2rad;

    // Hour angle
    var ha = lmst - ra;
    if (ha < -Math.PI) {
      ha += twopi;
    }
    if (ha > Math.PI) {
      ha -= twopi;
    }

    // Latitude to radians
    lat = lat * deg2rad;

    // Azimuth and elevation
    var el = Math.asin(Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha));
    var az = Math.asin(-Math.cos(dec) * Math.sin(ha) / Math.cos(el));

    var cosAzPos = 0 <= Math.sin(dec) - Math.sin(el) * Math.sin(lat);
    var sinAzNeg = Math.sin(az) < 0;
    if (cosAzPos && sinAzNeg) {
      az += twopi;
    }
    if (!cosAzPos) {
      az = Math.PI - az;
    }

    el = el / deg2rad;
    az = az / deg2rad;
    lat = lat / deg2rad;

    return [az, el];
  }


  var Sunlight = function(options) {
    _.extend(this, VIZI.Mediator);
    $('#date').val(new Date().toDateInputValue())
      .change(function(){
        console.log($(this).val());
        update();
      });
    $('#time').val('12:00')
      .change(function(){
        console.log($(this).val());
        update();
      });
  };
  var instance = new Sunlight();
  update();

  VIZI.Sunlight = instance;
}());