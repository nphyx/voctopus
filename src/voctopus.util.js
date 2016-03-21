"use strict";
/**
 * This module contains an assortment of functions used internally in Voctopus.
 * @module voctopus/util
 */

/**
 * Provide a 24 bit int implementation for DataViews. Note this
 * causes two reads/writes per call, meaning it's going to be
 * around half as fast as the native implementations.
 */
DataView.prototype.getUint24 = function(pos) {
	return (this.getUint16(pos) << 8) + this.getUint8(pos+2);
}

/**
 * Setter for Uint24.
 */
DataView.prototype.setUint24 = function(pos, val) {
	this.setUint16(pos, val >> 8);
	this.setUint8(pos+2, val & ~4294967040);
}

/**
 * Sum of powers of 8 up to n. Used in various calculations.
 * @param {int} n highest power of 8
 * @return {int}
 */
function sump8(n) {
	return ~~((Math.pow(8, n+1) -1) / 7);
}

/**
 * Figures out the maximum size of a voctopus octree.
 * @param {int} depth octree depth
 * @param {int} size size of a single octant in the tree
 * @return {int}
 */
function maxOctreeSize(depth, size) {
	return sump8(depth)*size;
}

/**
 * Find the nearest power of two greater than a number.
 * @param {int} n number to test against
 * @return {int}
 */
function npot(n) {
	var x = 64;
	while(x < n) x *= 2;
	return x;
}

/**
 * Used to loop through every voxel in an octree and run callbacks. Used for
 * Voctopus testing. Three nested loops of X, Y, and Z axis, supporting a callback
 * for each iteration of each loop as supplied in the cbs parameter.
 *
 * @param {int} size size of a volume
 * @param {Object} cbs callback object {x:f(vector),y:f(vector),z:f(vector)}
 * @return {undefined}
 */
function loop3D(size, cbs) {
	var cbx, cby, cbz, x, y, z;
	cbx = typeof(cbs.x) === "function"?cbs.x:function(){};
	cby = typeof(cbs.y) === "function"?cbs.y:function(){};
	cbz = typeof(cbs.z) === "function"?cbs.z:function(){};
	for(x = 0; x < size; ++x) {
		cbx([x,y,z]);
		for(y = 0; y < size; ++y) {
			cby([x,y,z]);
			for(z = 0; z < size; ++z) {
				cbz([x,y,z]);
			}
		}
	}
}

/**
 * Polyfill for ArrayBuffer.transfer. Uses DataView setter/getters to make transfers
 * as fast as possible. Still slow with large buffers, but less slow than copying
 * byte by byte. This has been working for me so far but I'm not 100% sure there
 * are no bugs or edge cases.
 *
 * @param {ArrayBuffer} buffer original arraybuffer
 * @return {undefined}
 */
if(typeof(ArrayBuffer.prototype.transfer) === "undefined") {
	ArrayBuffer.prototype.transfer = function transfer(buffer) {
		var dva, dvb, i, mod;
		dva = new DataView(this);
		dvb = new DataView(buffer);
		mod = this.byteLength%8;
		for(i = 0; i < buffer.byteLength-mod; i+=8) dvb.setFloat64(i, dva.getFloat64(i));
		mod = this.byteLength%4;
		for(; i < buffer.byteLength-mod; i+=4) {
			dvb.setUint32(i, dva.getUint32(i));
		}
		mod = this.byteLength%2;
		for(; i < buffer.byteLength-mod; i+=2) {
			dvb.setUint16(i, dva.getUint16(i));
		}
		for(; i < buffer.byteLength; ++i) {
			dvb.setUint8(i, dva.getUint8(i));
		}
	}
}

module.exports.sump8 = sump8;
module.exports.DataView = DataView;
module.exports.maxOctreeSize = maxOctreeSize;
module.exports.npot = npot;
module.exports.loop3D = loop3D;
