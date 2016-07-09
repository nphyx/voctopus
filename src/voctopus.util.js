"use strict";
/**
 * This module contains an assortment of export functions used internally in Voctopus, as well
 * as some export functions for analyzing octree properties for experimental purposes (they
 * help find "sweet spots" for initial octree memory allocations)
 * @module voctopus/util
 */

/**
 * Provide a 24 bit int implementation for DataViews. Note this
 * causes two reads/writes per call, meaning it's going to be
 * around half as fast as the native implementations.
 */
DataView.prototype.getUint24 =  function(pos) {
	return (this.getUint16(pos) << 8) + this.getUint8(pos+2);
}

/**
 * Setter for Uint24.
 */
DataView.prototype.setUint24 =  function(pos, val) {
	this.setUint16(pos, val >> 8);
	this.setUint8(pos+2, val & ~4294967040);
}

/**
 * Sum of powers of 8 up to n. Used in various calculations.
 * @param {int} n highest power of 8, up to 24 (after which precision errors become a problem)
 * @return {Float64}
 */
export function sump8(n) {
	return (Math.pow(8, n+1) -1) / 7;
}

/**
 * Find the cardinal identity (0-7) of an octant. Octets contain 8 octants, so in 
 * x,y,z order they live at identities 0-7.
 * @param {vector} vector representing the absolute coordinate of a voxel at max depth 
 * @param {int} dc current depth (zero-indexed)
 * @param {int} dm maximum depth
 * @return {int} identity
 */
export function octantIdentity(v, dc, dm) {
	let d = dm - 1 - dc;
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
export function fullOctreeSize(octantSize, depth) {
	return sump8(depth)*octantSize;
}

/**
 * Discover the maximum addressable depth for an octree schema at 100% density. Note 
 * that this is not very useful on its own because ArrayBuffers have a hard limit of 
 * 2gb, and this can produce buffers sized in EXABYTES if used naively!
 * @param {int} octantSize (in bytes)
 * @return {int} depth
 */
export function maxAddressableOctreeDepth(octantSize) {
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
export function maxOctreeDensityFactor(octantSize, depth, limit) {
	return ~~(fullOctreeSize(octantSize, depth)/limit+1);
}

/**
 * Find the nearest power of two greater than a number.
 * @param {int} n number to test against
 * @return {int}
 */
export function npot(n) {
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
export function loop3D(size, cbs) {
	var cbx, cby, cbz, v = Uint32Array.of(0,0,0);
	cbx = typeof(cbs.x) === "function"?cbs.x:function(){};
	cby = typeof(cbs.y) === "function"?cbs.y:function(){};
	cbz = typeof(cbs.z) === "function"?cbs.z:function(){};
	for(v[0] = 0; v[0] < size; ++v[0]) {
		v[1] = 0;
		v[2] = 0;
		cbx(v);
		for(v[1] = 0; v[1] < size; ++v[1]) {
			v[2] = 0;
			cby(v);
			for(v[2] = 0; v[2] < size; ++v[2]) {
				cbz(v);
			}
		}
	}
}

/**
 * Find the coordinate space (size of a single octree axis) for a given depth.
 * @param {int} depth octree depth
 */
export function coordinateSpace(depth) {
	return Math.pow(2, depth);
}

/**
 * Check the ray - box intersection of a voxel (which is an axis-aligned bounding box)
 * @param {vector} bs box start (top, left, back) 
 * @param {vector} be box end (bottom, right, front)
 * @param {vector} ro ray origin
 * @param {vector} rd inverse of ray direction (inverse should be precalculated)
 * @return bool true if there was a hit, otherwise false
 */
export function rayAABB(bs, be, ro, rd) {
	let min = Math.min, max = Math.max;
	// decompose vectors, saves time referencing
	// ray origin
	let ox = ro[0], oy = ro[1], oz = ro[2];
	// ray direction
	let dx = rd[0], dy = rd[1], dz = rd[2];

  let tx0 = (bs[0] - ox)*dx;
  let tx1 = (be[0] - ox)*dx;
  let ty0 = (bs[1] - oy)*dy;
  let ty1 = (be[1] - oy)*dy;
  let tz0 = (bs[2] - oz)*dz;
  let tz1 = (be[2] - oz)*dz;

  let tmin = max(min(tx0, tx1), min(ty0, ty1), min(tz0, tz1));
  let tmax = min(max(tx0, tx1), max(ty0, ty1), max(tz0, tz1));

  return tmax >= tmin;
}

/**
 * Polyfill for ArrayBuffer.transfer. Uses DataView setter/getters to make transfers
 * as fast as possible. Still slow with large buffers, but less slow than copying
 * byte by byte. This has been working for me so far but I'm not 100% sure there
 *
 * are no bugs or edge cases.
 *
 * @param {ArrayBuffer} buffer original arraybuffer
 * @return {undefined}
 */
if(typeof(ArrayBuffer.prototype.transfer) === "undefined") {
	ArrayBuffer.prototype.transfer =  function transfer(old) {
		var dva, dvb, i, mod;
		dva = new DataView(this);
		dvb = new DataView(old);
		mod = this.byteLength%8+1;
		for(i = 0; i <= old.byteLength-mod; i+=8) dva.setFloat64(i, dvb.getFloat64(i));
		mod = this.byteLength%4+1;
		if(i < old.byteLength-mod) {
			dva.setUint32(i, dvb.getUint32(i));
			i += 4;
		}
		mod = this.byteLength%2+1;
		if(i < old.byteLength-mod) {
			dva.setUint16(i, dvb.getUint16(i));
			i += 2;
		}
		if(i < old.byteLength) dva.setUint8(i, dvb.getUint8(i));
	}
}

// memory mapping utility for debugging
export function mmap(start, end, v) {
	const pad = (n) => "0".repeat(4).slice(0, 4-n.toString().length)+n;
	for(let i = start; i < end; i+=8) {
		console.log([i, i+1, i+2, i+3, i+4, i+5, i+6, i+7].map(pad).join(" "));
		console.log([v[i], v[i+1], v[i+2], v[i+3], v[i+4], v[i+5], v[i+6], v[i+7]].map(pad).join(" "));
		console.log("");
	}
}

