"use strict";
/* jshint unused:false */

/**
 * Returns length of side at depth d with maxdepth m:
 */
function resOf(m, d) {
	return 2*Math.pow(m-d);
}

/**
 * Index offset for depth d is sum of powers of 8 up to 8^d
 */
function baseOffset(d) {
	return ~~((Math.pow(8, d) -1) / 7);
}

function Voctopus(depth) {
	var _elements = [];
	var _depth = depth; 
	function octCoord(coord, d) {
		return (((coord[2] >>> _depth-d) & 1) << 2 | 
						((coord[1] >>> _depth-d) & 1) << 1 |
						((coord[0] >>> _depth-d) & 1) 
					 );
	}
}

Voctopus.prototype.octAt = function(coord) {
	var depth, index;
	if(arguments.length === 2) depth = arguments[1];
	else depth = 0;
}

Voctopus.prototype.octId = function(coord, d) {
	var i;
	var o = 0;
	for(i = _depth-d; i < _depth; i++) {
		o += octCoord(coord, i) + baseOffset(d);	
	}
}


if(typeof(module) !== "undefined") module.exports = Voctopus;
