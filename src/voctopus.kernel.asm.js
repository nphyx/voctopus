"use strict";
/* jshint strict:false */
/* jshint unused:false */

// Restricted lib for use in voctopus kernel
const kernelLib = {
	abs: Math.abs,
	max: Math.max,
	min: Math.min,
	pow: Math.pow,
	Int32Array: Int32Array,
	Uint32Array: Uint32Array,
	Uint8Array: Uint8Array
}


function voctopusKernel32(stdlib, foreign, buffer) {
	"use asm";

	// heap for reading full octants and color values
	var heap32 = new stdlib.Uint32Array(buffer);
	// pointers for fixed locations
  var D_MAX = 0,  // tree's preset maximum depth (set externally)
			P_FO = 4,   // offset of root octet in tree (set externally)
      P_CUR = 8,  // current pointer during operations
      P_NXT = 12, // next pointer during operations
			D_CUR = 16, // current depth during operations
		  LOC_X = 20, // x destination for current op
			LOC_Y = 24, // y destination for current op
			LOC_Z = 28, // z destination for current op
			D_INV = 32, // inverse of D_CUR
			V_TMP = 36, // tmp placeholder for a voxel
			STEPA = 40, // var used in stepIntoTree
			STEPB = 44, // var used in stepIntoTree 
			TRAVA = 48; // var used in traverse
	// heap for reading 8-bit values
	var heap8 = new stdlib.Uint8Array(buffer);
	var PO_A = 0;
	var PO_G = 1;
	var PO_B = 2;
	var PO_R = 3;

	function init() {
	}

	function get() {
	}
	
	function set() {
	}

	function getOctet() {
	}

	function setOctet() {
	}

	function rFrom(n) {
		n = n|0;
		heap32[V_TMP>>2] = n;
		return heap8[V_TMP|0+PO_R|0]|0;
	}

	function gFrom(n) {
		n = n|0;
		heap32[V_TMP>>2] = n;
		return heap8[V_TMP|0+PO_G|0]|0;
	}

	function bFrom(n) {
		n = n|0;
		heap32[V_TMP>>2] = n;
		return heap8[V_TMP|0+PO_B|0]|0;
	}

	function aFrom(n) {
		n = n|0;
		heap32[V_TMP>>2] = n;
		return (heap8[V_TMP|0+PO_A|0] >> 4)|0;
	}

	/**
	 * The last bit of a value is a flag for a pointer, so this shifts a
	 * number left and then sets the last bit to 1 to flag it as a pointer.
	 * It has to be decoded in reverse.
	 */
	function makeP(n) {
		n = n|0;
		return (n << 1 | 1)|0;
	}

	function isP(n) {
		n = n|0;
		return (n & 1)|0;
	}

	/**
	 * Decode a pointer from a stored value. Returns 0 if the value wasn't
	 * a pointer. Note this only works correctly if n is taken from the 
	 * octree in the first place.
	 * @param n {octant} an octant value from the octree
	 * @return {int}
	 */
	function pFrom(n) {
		n = n|0;
		// this will return 0 if n is not an encoded pointer, without branching
		return ((~(0x7FFFFFFF+(n & 1)) & n) >> 1)|0;
	}

	function valFromRGBA(r,g,b,a) {
		r = r|0;
		g = g|0;
		b = b|0;
		a = a|0;
		heap8[V_TMP|0+PO_R] = r;
		heap8[V_TMP|0+PO_G] = g;
		heap8[V_TMP|0+PO_B] = b;
		heap8[V_TMP|0+PO_A] = (a & 63) << 4;
		return (heap32[V_TMP>>2])|0;
	}

	/**
	 * Prepares internal variables for a voxel lookup. Called whenever these
	 * values need to be refreshed.
	 */
	function prepare(x, y, z, d) {
		x = x|0;
		y = y|0;
		z = z|0;
		d = d|0;
		heap32[LOC_X>>2] = x|0;
		heap32[LOC_Y>>2] = y|0;
		heap32[LOC_Z>>2] = z|0;
		heap32[D_CUR>>2] = d|0;
	}

	function calcDepthInverse() {
		heap32[D_INV>>2] = (heap32[D_MAX<<2>>2]|0) - 1|0 - (heap32[D_CUR<<2>>2]|0);
	}

	function octantIdentity() {
		return (((heap32[LOC_Z>>2] >>> heap32[D_INV>>2]) & 1) << 2 | 
						((heap32[LOC_Y>>2] >>> heap32[D_INV>>2]) & 1) << 1 |
						((heap32[LOC_X>>2] >>> heap32[D_INV>>2]) & 1) 
					 );
	}

	function octantOffset() {
		return ((octantIdentity()|0)*8)|0;
	}

	/**
	 * A single step in a tree traversal.
	 */
	function stepIntoTree() {
		// increment depth
		heap32[D_CUR>>2] = heap32[D_CUR>>2]|0 + 1;
		// recalc inverse depth
		calcDepthInverse();
		// read pointer that current pointer points at
		heap32[STEPA>>2] = pFrom(heap32[P_CUR>>2]|0)|0;
		// find octantIdentity at current depth
		heap32[STEPB>>2] = (octantIdentity()|0)*8;
		// calculate next pointer
		return ((heap32[STEPA>>2]|0) + (heap32[STEPB>>2]|0))|0;
	}

	function traverse() {
		/* jshint -W041:false */
		if(heap32[D_CUR>>2]|0 < 1|0) return heap32[P_CUR>>2]|0; // shortcut
		heap32[P_CUR>>2] = P_FO;

		while((heap32[D_CUR>>2]|0) < (heap32[D_MAX>>2]|0)) {
			if(isP(heap32[P_CUR>>2]|0)|0) heap32[P_CUR>>2] = (stepIntoTree()|0)|0;
			else break;
		}
		return heap32[P_CUR>>2]|0;
	}

	return {
		init:init,
		get:get,
		set:set,
		getOctet:getOctet,
		setOctet:setOctet,
		rFrom:rFrom,
		gFrom:gFrom,
		bFrom:bFrom,
		aFrom:aFrom,
		makeP:makeP,
		pFrom:pFrom,
		isP:isP,
		valFromRGBA:valFromRGBA,
	};
}

export const voctopusKernel = voctopusKernel32.bind(null, kernelLib, null);
