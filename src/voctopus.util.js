"use strict";
/**
 * This module contains an assortment of functions used internally in Voctopus, as well
 * as some functions for analyzing octree properties for experimental purposes (they
 * help find "sweet spots" for initial octree memory allocations)
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
 * @param {int} n highest power of 8, up to 24 (after which precision errors become a problem)
 * @return {Float64}
 */
function sump8(n) {
	return (Math.pow(8, n+1) -1) / 7;
}

/**
 * Find the cardinal identity (0-7) of an octant. Octets contain 8 octants, so in 
 * x,y,z order they live at identities 0-7.
 * @param {vector} vector representing the absolute coordinate of a voxel at max depth 
 * @param {int} d depth offset (max depth - current depth)
 * @return {int} identity
 */
function octantIdentity(v, d) {
	return (((v[2] >>> d) & 1) << 2 | 
					((v[1] >>> d) & 1) << 1 |
					((v[0] >>> d) & 1) 
				 );
}

/**
 * Figures out the maximum size of a voctopus octree, assuming it's 100% dense (e.g. filled with random noise).
 * @param {int} octantSize size of a single octant in the tree
 * @param {int} depth octree depth
 * @return {int}
 */
function fullOctreeSize(octantSize, depth) {
	return sump8(depth)*octantSize;
}

/**
 * Discover the maximum addressable depth for an octree schema at 100% density. Note 
 * that this is not very useful on its own because ArrayBuffers have a hard limit of 
 * 2gb, and this can produce buffers sized in EXABYTES if used naively!
 * @param {int} octantSize (in bytes)
 * @return {int} depth
 */
function maxAddressableOctreeDepth(octantSize) {
	var sum = 0, depth = 1;
	while(((sum+1)-(sum) === 1)) {
		++depth;
		sum = sump8(depth)*octantSize;
	}
	return depth;
}

/**
 * Find the maximum density factor of an octree given an octantSize, depth, and memory limit. Voctopus figures out how much memory to allocate based on its octant size, depth and density factor.
 * @param {int} octantSize size of a single octant in bytes
 * @param {int} depth octree depth
 * @param {int} limit memory limit in bytes
 */
function maxOctreeDensityFactor(octantSize, depth, limit) {
	return ~~(fullOctreeSize(octantSize, depth)/limit+1);
}

/**
 * Find the nearest power of two greater than a number.
 * @param {int} n number to test against
 * @return {int}
 */
function npot(n) {
	n--;
	n |= n >> 1;
	n |= n >> 2;
	n |= n >> 4;
	n |= n >> 8;
	n |= n >> 16;
	n++;
	return n;
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
	var cbx, cby, cbz, vec = new Float32Array(3);
	cbx = typeof(cbs.x) === "function"?cbs.x:function(){};
	cby = typeof(cbs.y) === "function"?cbs.y:function(){};
	cbz = typeof(cbs.z) === "function"?cbs.z:function(){};
	for(vec[0] = 0; vec[0] < size; ++vec[0]) {
		cbx(vec);
		for(vec[1] = 0; vec[1] < size; ++vec[1]) {
			cby(vec);
			for(vec[2] = 0; vec[2] < size; ++vec[2]) {
				cbz(vec);
			}
		}
	}
}

/**
 * Find the coordinate space (size of a single octree axis) for a given depth.
 * @param {int} depth octree depth
 */
function coordinateSpace(depth) {
	return Math.pow(2, depth);
}

function getterFactory(size, offset, view) {
	var f;
	switch(size) {
		case 1:
			f = DataView.prototype.getUint8;
		break;
		case 2:
			f = DataView.prototype.getUint16;
		break;
		case 3:
			f = DataView.prototype.getUint24;
		break;
		case 4:
			f = DataView.prototype.getUint32;
		break;
		case 8: 
			f = DataView.prototype.getFloat64;
		break;
		default:
			throw new Error("invalid property size "+size);
	}
	return function(pointer) {
		return f.call(view, pointer+offset);
	}
}

function setterFactory(size, offset, view) {
	var f;
	switch(size) {
		case 1:
			f = DataView.prototype.setUint8;
		break;
		case 2:
			f = DataView.prototype.setUint16;
		break;
		case 3:
			f = DataView.prototype.setUint24;
		break;
		case 4:
			f = DataView.prototype.setUint32;
		break;
		case 8: 
			f = DataView.prototype.setFloat64;
		break;
		default:
			throw new Error("invalid property size "+size);
	}
	return function(pointer, value) {
		return f.call(view, pointer+offset, value);
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
		for(i = 0; i < buffer.byteLength-mod; i+=8) dva.setFloat64(i, dvb.getFloat64(i));
		mod = this.byteLength%4;
		for(; i < buffer.byteLength-mod; i+=4) {
			dva.setUint32(i, dvb.getUint32(i));
		}
		mod = this.byteLength%2;
		for(; i < buffer.byteLength-mod; i+=2) {
			dva.setUint16(i, dvb.getUint16(i));
		}
		for(; i < buffer.byteLength; ++i) {
			dva.setUint8(i, dvb.getUint8(i));
		}
	}
}

module.exports.sump8 = sump8;
module.exports.DataView = DataView;
module.exports.fullOctreeSize = fullOctreeSize;
module.exports.maxAddressableOctreeDepth = maxAddressableOctreeDepth;
module.exports.coordinateSpace = coordinateSpace;
module.exports.maxOctreeDensityFactor = maxOctreeDensityFactor;
module.exports.octantIdentity = octantIdentity;
module.exports.npot = npot;
module.exports.loop3D = loop3D;
module.exports.getterFactory = getterFactory;
module.exports.setterFactory = setterFactory;
