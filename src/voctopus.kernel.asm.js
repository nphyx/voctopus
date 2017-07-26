"use strict";
/* jshint strict:false */
/* jshint unused:false */

// imul polyfill
Math.imul = Math.imul || function(a, b) {
  var ah = (a >>> 16) & 0xffff;
  var al = a & 0xffff;
  var bh = (b >>> 16) & 0xffff;
  var bl = b & 0xffff;
  // the shift by 0 fixes the sign on the high part
  // the final |0 converts the unsigned value into a signed value
  return ((al * bl) + (((ah * bl + al * bh) << 16) >>> 0)|0);
};

// Restricted lib for use in voctopus kernel
const kernelLib = {
	Math:Math,
	Int32Array: Int32Array,
	Uint32Array: Uint32Array,
	Float64Array:Float64Array,
	Uint8Array: Uint8Array
}


function VoctopusKernel32(stdlib, foreign, buffer) {
	"use asm";
	// aliases
	var min = stdlib.Math.min;
	var max = stdlib.Math.max;
	var imul = stdlib.Math.imul;

	// heap for reading full octants and color values
	var heap32 = new stdlib.Uint32Array(buffer);
	// pointers for fixed locations
  var D_MAX = 0,  // tree's preset maximum depth (set externally)
			P_FO = 4,   // offset of root octet in tree (set externally)
			P_NO = 8,   // next octet pointer
      P_CUR = 12, // current pointer during operations
      P_TMP = 16, // next pointer during traversals 
			D_CUR = 20, // current depth during operations
		  LOC_X = 24, // x destination for current op
			LOC_Y = 28, // y destination for current op
			LOC_Z = 32, // z destination for current op
			D_TGT = 36, // target depth
			D_INV = 40, // inverse of current depth
			V_TMP = 44, // tmp placeholder for a voxel
			STEPA = 48, // var used in stepIntoTree
			STEPB = 52, // var used in stepIntoTree 
			TRAVA = 56, // var used in traverse
			INITA = 60; // var used in initOctet
	// heap for reading 8-bit values from voxels
	var heap8 = new stdlib.Uint8Array(buffer);
	var PO_A = 0,
	    PO_B = 1,
	    PO_G = 2,
	    PO_R = 3;
	// heap for doing floating point calculations
	var heapd = new stdlib.Float64Array(buffer);
	// pointers for heapd
	var DBLA = 64,
	    DBLB = 72,
			DBLC = 80,
			DBLD = 88,
			DBLE = 96;
	var MASK_R = 0xff000000;
	var MASK_G = 0x00ff0000;
	var MASK_B = 0x0000ff00;
	var MASK_A = 0x000000f0;

	/**
	 * The last bit of a value is a flag for a pointer, so this shifts a
	 * number left and then sets the last bit to 1 to flag it as a pointer.
	 * It has to be decoded in reverse.
	 */
	function makeP(n) {
		n = n|0;
		return (n << 1 | 1)|0;
	}

	/**
	 * Sets maximum depth value. Maximum depth should not be modified during
	 * runtime due to side effects not being tested for. If you need a larger
	 * octree, copy the current tree into a larger one. Never, ever decrease
	 * an octree's depth.
	 * @param {int} n
	 */
	function setMaxDepth(n) {
		n = n|0;
		heap32[D_MAX>>2] = n;
	}

	/**
	 * Accessor for max depth value.
	 */
	function getMaxDepth() {
		return heap32[D_MAX>>2]|0;
	}

	/**
	 * Sets the current depth value.
	 */
	function setCurrentDepth(d) {
		d = d|0;
		heap32[D_CUR>>2] = d;
	}

	/**
	 * Accessor for current depth value.
	 */
	function getCurrentDepth() {
		return heap32[D_CUR>>2]|0;
	}

	/**
	 * Increments current depth value. Used during octree traversal.
	 */
	function incrementCurrentDepth() {
		setCurrentDepth((1|0) + (getCurrentDepth()|0)|0);
		calcDepthInverse();
	}

	/**
	 * Sets firstOffset value. This generally should not be changed during runtime.
	 */
	function setFirstOffset(n) {
		n = n|0;
		heap32[P_FO>>2] = n;
	}

	/**
	 * Gets firstOffset value.
	 */
	function getFirstOffset() {
		return heap32[P_FO>>2]|0;
	}

	/**
	 * Sets nextOffset value. This is generally handled through allocateOctet and
	 * shouldn't be set manually.
	 * @param {int} n
	 */
	function setNextOffset(n) {
		n = n|0;
		heap32[P_NO>>2] = n;
	}

	/**
	 * Gets nextOffset value. This value is managed by allocateOctet, so you shouldn't
	 * access it directly unless you need to read it without incrementing it.
	 * @return {int}
	 */
	function getNextOffset() {
		return heap32[P_NO>>2]|0;
	}

	/**
	 * Increments the next octet value, then returns the previous value. This is
	 * used to keep track of the next available octet memory space.
	 */
	function allocateOctet() {
		heap32[P_NO>>2] = (8|0) + (heap32[P_NO>>2]|0);
		return (-8 + (heap32[P_NO>>2]|0))|0;
	}

	/**
	 * Gets raw int value of octant at index i.
	 * @param {int} i 32-bit index
	 */
	function getOctant(i) {
		i = i|0;
		return (heap32[i<<2>>2])|0;
	}
	
	/**
	 * Sets octant at index i to value v.
	 * @param {int} i 32-bit index
	 * @param {int} v 32-bit value
	 */
	function setOctant(i, v) {
		i = i|0;
		v = v|0;
		heap32[i<<2>>2] = v;
	}

	/**
	 * For debugging purposes.
	 */
	function getTRAVA() {
		return heap32[TRAVA>>2]|0;
	}

	/**
	 * Decodes the red value from an rgba value.
	 * @param {int} n 32-bit rgba value
	 * @return {int} 8-bit color value
	 */
	function rFrom(n) {
		n = n|0;
		// have to be tricky here because js will assume a 32-bit int (not uint)
		return ((n >> 8) & MASK_G) >> 16;
		/*
		heap32[V_TMP>>2] = n;
		return heap8[V_TMP|0+PO_R|0]|0;
		*/
	}

	/**
	 * Decodes the green value from an rgba value.
	 * @param {int} n 32-bit rgba value
	 * @return {int} 8-bit color value
	 */
	function gFrom(n) {
		n = n|0;
		return (n & MASK_G) >> 16;
		/*
		heap32[V_TMP>>2] = n;
		return heap8[V_TMP|0+PO_G|0]|0;
		*/
	}

	/**
	 * Decodes the blue value from an rgba value.
	 * @param {int} n 32-bit rgba value
	 * @return {int} 8-bit color value
	 */
	function bFrom(n) {
		n = n|0;
		return (n & MASK_B) >> 8;
		/*
		heap32[V_TMP>>2] = n;
		return heap8[V_TMP|0+PO_B|0]|0;
		*/
	}

	/**
	 * Decodes the alpha value from an rgba value.
	 * @param {int} n 32-bit rgba value
	 * @return {int} 4-bit alpha value
	 */
	function aFrom(n) {
		n = n|0;
		return (n & MASK_A) >> 4;
		/*
		heap32[V_TMP>>2] = n;
		return (heap8[V_TMP|0+PO_A|0] >> 4)|0;
		*/
	}

	/**
	 * Determines whether a value is flagged as a pointer by checking the first bit.
	 */
	function isP(n) {
		n = n|0;
		return (n & 1)|0;
	}

	/**
	 * Decode a pointer from a stored value. Returns 0 if the value wasn't
	 * a pointer. Note this only works correctly if n is a value from the octree.
	 * @param n {octant} an octant value from the octree
	 * @return {int} a decoded pointer, or 0 if it wasn't a pointer
	 */
	function pFrom(n) {
		n = n|0;
		// this will return 0 if n is not an encoded pointer, without branching
		return ((~(0x7FFFFFFF+(n & 1)) & n) >> 1)|0;
	}

	/**
	 * Reads a value from the index with the assumption that it's a pointer.
	 * @param {int} i index to read from
	 * @return {int} value decoded as a pointer
	 */
	function getP(i) {
		i = i|0;
		return (pFrom(getOctant(i)|0)|0)|0;
	}

	/**
	 * Sets a value at the index as an encoded pointer.
	 * @param {int} i index to read from
	 * @param {int} n pointer to set
	 */
	function setP(i, p) {
		i = i|0;
		p = p|0;
		setOctant(i, makeP(p)|0);
	}

	/**
	 * Sets the current pointer value, used during traversal.
	 * Note that this value is *not* encoded as a pointer, because it's not
	 * in the octree and converting it back and forth is computationally wasteful.
	 * @param {int} p pointer to set
	 */
	function setCurrentPointer(p) {
		p = p|0;
		heap32[P_CUR>>2] = p;
	}

	function getCurrentPointer() {
		return heap32[P_CUR>>2]|0;
	}

	/**
	 * Translates a set of rgba values to an unsigned 32-bit int.
	 * @param {int} r
	 * @param {int} g
	 * @param {int} b
	 * @param {int} a
	 * @return int
	 */
	function valFromRGBA(r,g,b,a) {
		r = r|0;
		g = g|0;
		b = b|0;
		a = a|0;
		return (r << 24) + (g << 16) + (b << 8) + ((a & 63) << 4);
	}

	/**
	 * Calculates inverse of current depth. Used in octantIdentity calculation.
	 */
	function calcDepthInverse() {
		heap32[D_INV>>2] = (heap32[D_MAX>>2]|0) - (heap32[D_CUR>>2]|0);
	}

	/**
	 * Prepares internal variables for a voxel lookup. Called whenever these
	 * values need to be refreshed during a voxel lookup or related calculations.
	 * @param {int} x x-coordinate
	 * @param {int} y y-coordinate
	 * @param {int} z z-coordinate
	 * @param {int} d target depth
	 */
	function prepareLookup(x, y, z, d) {
		x = x|0;
		y = y|0;
		z = z|0;
		d = d|0;
		heap32[LOC_X>>2] = x;
		heap32[LOC_Y>>2] = y;
		heap32[LOC_Z>>2] = z;
		heap32[D_TGT>>2] = d;
		heap32[P_CUR>>2] = heap32[P_FO>>2]|0;
		setCurrentDepth(0);
	}

	/**
	 * Finds the identity of an octant for the prepared vector at the current
	 * depth.
	 * @return {int}
	 */
	function octantIdentity() {
		return (((heap32[LOC_Z>>2] >>> heap32[D_INV>>2]) & 1) << 2 | 
						((heap32[LOC_Y>>2] >>> heap32[D_INV>>2]) & 1) << 1 |
						((heap32[LOC_X>>2] >>> heap32[D_INV>>2]) & 1) 
					 );
	}

	/**
	 * Derives the pointer for the octant at the current depth and vector
	 * from the octet pointer.
	 * @return {int}
	 */
	function octantPointer() {
		return ((heap32[P_CUR>>2]|0) + (octantIdentity()|0))|0;
	}

	function traverse() {
		/* jshint -W041:false */
		heap32[TRAVA>>2] = 0|0;
		while((heap32[D_CUR>>2]|0) < min((heap32[D_TGT>>2]|0), (heap32[D_MAX>>2]|0))) {
			incrementCurrentDepth();
			heap32[TRAVA>>2] = getOctant(octantPointer()|0)|0;
			if(!(isP(heap32[TRAVA>>2]|0)|0)) return (heap32[TRAVA>>2])|0;
			heap32[P_CUR>>2] = pFrom(heap32[TRAVA>>2]|0)|0;
		}
		return (heap32[P_CUR>>2])|0;
	}

	/**
	 * Initializes an octet at the depth and vector set using prepareLookup
	 */
	function initOctet() {
		heap32[INITA>>2] = 0|0;
		while((heap32[D_CUR>>2]|0) < min((heap32[D_TGT>>2]|0), (heap32[D_MAX>>2]|0))) {
			incrementCurrentDepth();
			heap32[INITA>>2] = getOctant(octantPointer()|0)|0;
			if(!(isP(heap32[INITA>>2]|0)|0)) {
				heap32[INITA>>2] = makeP(allocateOctet()|0)|0;
				setOctant(octantPointer()|0, heap32[INITA>>2]|0);
			}
			heap32[P_CUR>>2] = pFrom(heap32[INITA>>2]|0)|0;
		}
		return heap32[P_CUR>>2]|0;
	}

	/**
	 * Single step in traversal. Used when walking the tree.
	 */
	function step() {
		incrementCurrentDepth();
		heap32[STEPA>>2] = getOctant(octantPointer()|0)|0;
		heap32[P_CUR>>2] = pFrom(heap32[STEPA>>2]|0)|0;
		return (octantPointer()|0)|0;
	}

	/**
	 * Check the ray - box intersection of a voxel (which is an axis-aligned bounding box)
	 * @param {double} bs[x,y,z] box start (top, left, back) 
	 * @param {double} be[x,y,z] box end (bottom, right, front)
	 * @param {double} ro[x,y,z] ray origin
	 * @param {double} rd[x,y,z] inverse of ray direction (inverse should be precalculated)
	 * @return {int} 1 if there was a hit, otherwise 0
	 */
	function rayAABB(bsx, bsy, bsz, bex, bey, bez, rox, roy, roz, rdx, rdy, rdz) {
		bsx = +bsx;
		bsy = +bsy;
		bsz = +bsz;
		bex = +bex;
		bey = +bey;
		bez = +bez;
		rox = +rox;
		roy = +roy;
		roz = +roz;
		rdx = +rdx;
		rdy = +rdy;
		rdz = +rdz;

		heapd[DBLA>>3] = (bsx - rox)*rdx;
		heapd[DBLB>>3] = (bex - rox)*rdx;
		heapd[DBLC>>3] = (bsy - roy)*rdy;
		heapd[DBLD>>3] = (bey - roy)*rdy;
		heapd[DBLE>>3] = (bsz - roz)*rdz;
		heapd[DBLD>>3] = (bez - roz)*rdz;

		return (
			+max(
				(+min(heapd[DBLA>>3], heapd[DBLB>>3])), 
				(+min(heapd[DBLC>>3], heapd[DBLD>>3])), 
				(+min(heapd[DBLD>>3], heapd[DBLE>>3]))
			) >=
			+min(
				(+max(heapd[DBLA>>3], heapd[DBLB>>3])), 
				(+max(heapd[DBLC>>3], heapd[DBLD>>3])), 
				(+max(heapd[DBLD>>3], heapd[DBLE>>3]))
			)
		)|0;
	}

	return {
		setMaxDepth:setMaxDepth,
		getMaxDepth:getMaxDepth,
		setFirstOffset:setFirstOffset,
		getFirstOffset:getFirstOffset,
		setNextOffset:setNextOffset,
		getNextOffset:getNextOffset,
		setCurrentDepth:setCurrentDepth,
		getCurrentDepth:getCurrentDepth,
		incrementCurrentDepth:incrementCurrentDepth,
		calcDepthInverse:calcDepthInverse,
		setCurrentPointer:setCurrentPointer,
		getCurrentPointer:getCurrentPointer,
		allocateOctet:allocateOctet,
		getTRAVA:getTRAVA,
		getOctant:getOctant,
		setOctant:setOctant,
		getP:getP,
		setP:setP,
		rFrom:rFrom,
		gFrom:gFrom,
		bFrom:bFrom,
		aFrom:aFrom,
		makeP:makeP,
		pFrom:pFrom,
		isP:isP,
		valFromRGBA:valFromRGBA,
		prepareLookup:prepareLookup,
		initOctet:initOctet,
		octantIdentity:octantIdentity,
		octantPointer:octantPointer,
		traverse:traverse,
		step:step,
		rayAABB:rayAABB
	};
}
export const VK_FO = 100; // first offset
export const VK_OS = 8; // octet size (in bytes)
export const VoctopusKernel = function(buffer, depth) {
	var vk = new VoctopusKernel32(kernelLib, null, buffer);
	vk.setMaxDepth(depth);
	vk.setFirstOffset(VK_FO);
	vk.setNextOffset(VK_FO+VK_OS);
	return vk;
}
