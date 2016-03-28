"use strict";
/*jshint strict:false */
/*jshint globalstrict:true */
/*jshint latedef:nofunc */
const schemas = require("./voctopus.schemas");
const {fullOctreeSize, octantOffset, npot, getterFactory, setterFactory} = require("../src/voctopus.util.js");
const MAX_BUFFER = 1024*1024*1024*512;

/**
 * Voctopus Core
 * =============
 *
 * This contains the core Voctopus object.
 *
 * Quick definition of terms:
 *
 * * 1 octant = one voxel at a given depth
 * * 1 octet = 8 octants, or one tree node
 *
 * @module voctopus.core
 */

/**
 * The Voctopus constructor. Accepts a maximum depth value and a schema (see the schemas
 * module for more info).
 * @param {int} depth maximum depth of tree
 * @param {Array} schema data
 * @return {Voctopus}
 */
function Voctopus(depth, schema = schemas.RGBM) {
	if(!depth) throw new Error("Voctopus#constructor must be given a depth");
	var buffer, view, octantSize, octetSize, firstOffset, nextOctet, startSize, maxSize, dimensions;

	/**
	 * calculate the size of a single octant based on the sum of lengths of properties 
	 * in the schema. the size of an octant is just the size of 8 octets
	 */
	octantSize = schema.reduce((prev, cur) => prev += cur.length, 0);
	octetSize = octantSize * 8;
	maxSize = npot(fullOctreeSize(octantSize, depth));
	dimensions = Math.pow(2, depth);

	// define public properties now
	Object.defineProperties(this, {
		"schema":{get: () => schema},
		"octetSize":{get: () => octetSize},
		"octantSize":{get: () => octantSize},
		"freedOctets":{value: [], enumerable: false},	
		"nextOctet":{get: () => nextOctet, set: (v) => nextOctet = v, enumerable: false},
		"firstOffset":{get: () => firstOffset},
		"depth":{get: () => depth},
		"buffer":{get: () => buffer, set: (x) => buffer = x},
		"view":{get: () => view, set: (x) => view = x},
		"maxSize":{get: () => maxSize},
		"dimensions":{get: () => dimensions},
	});


	/**
	 * Set up the ArrayBuffer as a power of two, so that it can be used as a WebGL
	 * texture more efficiently. The minimum size should be keyed to the minimum octant
	 * size times nine because that corresponds to a tree of depth 2, the minimum useful
	 * tree. Optimistically assume that deeper trees will be mostly sparse, which should
	 * be true for very large trees (and for small trees, expanding the buffer won't
	 * be as expensive).
	 */
	startSize = npot(Math.max((9*this.octantSize), Math.min(maxSize/8, MAX_BUFFER)));
	try {
		// start with a 1mb buffer
		this.buffer = new ArrayBuffer(startSize);
		this.buffer.version = 0;
	}
	catch(e) {
		throw new Error("Tried to initialize a Voctopus buffer at depth "+this.depth+", but "+startSize+" bytes was too large");
	}

	// initialize the DataView
	this.view = new DataView(this.buffer);

	// we'll initialize the first octet below, so start at the next one
	firstOffset = octetSize;
	nextOctet = firstOffset+octetSize;

	defineAccessors(this);

	// initialize the root node
	this.set.p(0, this.octetSize);

	// set up the voxel class - this will help js engines optimize 
	this.voxel = {}; 
	this.fields = [];
	this.setters = {};
	this.getters = {};
	for(let i = 0, l = this.schema.length; i < l; ++i) {
		let label = this.schema[i].label;
		if(label !== "p") {
			this.fields.push(label);
			this.getters[label] = getterFor(this.schema[i].length);
			this.setters[label] = setterFor(this.schema[i].length);
			this.voxel[label] = 0;
		}
	}
	return this;
}

function setterFor(len) {
	switch(len) {
		case 1: return DataView.prototype.setUint8;
		case 2: return DataView.prototype.setUint16;
		case 3: return DataView.prototype.setUint32;
		case 4: return DataView.prototype.setFloat64;
	}
}

function getterFor(len) {
	switch(len) {
		case 1: return DataView.prototype.getUint8;
		case 2: return DataView.prototype.getUint16;
		case 3: return DataView.prototype.getUint32;
		case 4: return DataView.prototype.getFloat64;
	}
}

/**
 * Walks the octree from the root to the supplied position vector, building an
 * array of indices of each octet as it goes, then returns the array. Optionally
 * initializes octets when init = true.
 * @param {vector} v coordinate vector of the target voxel
 * @param {int} depth number of depth levels to walk through (default this.depth)
 * @param {int} c start pointer (defaults to start of root octet)
 * @return {array} indexes of octant at each branch
 */
Voctopus.prototype.walk = function(v, depth = this.depth, c = undefined) {
	// object property lookups can be really slow so predefine things here
	let	dc = 0, dm = this.depth, pGet = this.get.p, os = this.octantSize, stack = [];
	if(c === undefined) c = this.firstOffset + octantOffset(v, 0, dm, os);
	stack.push(c);

	// walk the tree til we reach the end of a branch
	while ((c = pGet(c)) !== 0 && ++dc < depth) {
		c += octantOffset(v,dc,dm,os);
		stack.push(c);
	}
	return stack;
}

/**
 * Initializes a voxel at the supplied vector and branch depth, walking down the
 * tree and allocating voxels at each level until it hits the end.
 * @param {vector} v coordinate vector of the target voxel
 * @param {int} depth depth to initialize at (default this.depth)
 * @param {bool} init if true, initializes new octants as it walks (default false)
 * @return {int} index
 */
Voctopus.prototype.init = function(v, depth = this.depth - 1) {
	let dm = this.depth, os = this.octantSize,
	    c = this.firstOffset + octantOffset(v, 0, dm, os);
	if(depth === 0) return c; // shortcut

	let next = 0, dc = 0, pGet = this.get.p, p = c;
	while((c = pGet(p)) !== 0 && dc < depth) p = c + octantOffset(v, ++dc, dm, os);

	let rem = depth - dc;
	if(rem > 0) {
		let pointers = this.allocateOctets(rem);
		let setP = this.set.p.bind(this);
		for(let n = 0, len = pointers.length; n < len; ++n) {
			next = pointers[n];
			setP(p, next);
			p = next+octantOffset(v, ++dc, dm, os);
		}
	}
	return p;
}

/**
 * Gets the properties of an octant at the specified index.
 * @param {int} index
 * @return {voxel}
 */
Voctopus.prototype.get = function(index) {
	var voxel = Object.create(this.voxel);
	for(let i = 0, l = this.fields.length; i < l; i++) {
		let label = this.fields[i];
		voxel[label] = this.get[label](index);
	}
	return voxel;
}

/**
 * Sets the properties of an octant at the specified index.
 * @param {int} index
 * @param {object} props a property object, members corresponding to the schema
 * @return {undefined}
 */
Voctopus.prototype.set = function(index, props) {
	for(let i = 0, l = this.fields.length; i < l; i++) {
		let label = this.fields[i];
		let prop = props[label];
		if(prop !== undefined) this.set[label](index, prop);
	}
}

/**
 * Gets the properties of a voxel at a given coordinate vector.
 * @param {vector} v [x,y,z] position
 * @return {voxel}
 */
Voctopus.prototype.getVoxel = function(v) {
	let ptr = this.walk(v)[this.depth-1];
	let props = this.get(ptr);
	return props;
}

/**
 * Sets the properties of an octant at a given coordinate vector..
 * @param {vector} v [x,y,z] position 
 * @param {object} props a property object, members corresponding to the schema
 * @return {index} pointer to the voxel that was set
 */
Voctopus.prototype.setVoxel = function(v, props) {
	let ptr = this.init(v);
	this.set(ptr, props);
	return ptr;
}

/**
 * Returns the next available unused octet position, calling Voctopus#expand
 * if it needs to create more space.
 * @param {int} count number of octets to allocate (default 1)
 * @return {array} array of new pointers
 */
Voctopus.prototype.allocateOctets = function(count = 1) {
	if(this.freedOctets.length > 0) return this.freedOctets.splice(0, count);
	let pointers = new Array(count), i = 0; 
	let next = this.nextOctet, size = this.octetSize;
	if(next+size*count > this.buffer.byteLength) this.expand();
	for(; i < count; ++i) {
		pointers[i] = next+size*i;
	}
	this.nextOctet = pointers[count-1]+size;
	return pointers;
}

/**
 * Expands the internal storage buffer. This is a VERY EXPENSIVE OPERATION and
 * should be avoided until neccessary.
 * @return {bool} true if the voctopus was expanded, otherwise false
 */
Voctopus.prototype.expand = function() {
	var buffer = this.buffer, s, tmp, max;
	max = Math.min(MAX_BUFFER, this.maxSize);
	s = buffer.byteLength * 2;
	if(s > max) return false;
	tmp = new ArrayBuffer(s);
	tmp.transfer(buffer);
	this.buffer = tmp;
	this.view = new DataView(this.buffer);
	defineAccessors(this);
	return true;
}

/**
 * Cast a ray into the octree, computing intersections along the path.
 * @param {vector} vo ray origin coordinates
 * @param {vector} vd unit vector of ray direction
 * @return {array} array of voxel addresses
 *
Voctopus.prototype.traverse = function(vo, vd) {
	let a = 0;
	let ox = vo[0], oy = vo[1], oz = vo[2], dx = vd[0], dy = vd[1], dz = vd[2];
	let s = this.dimensions, max = Math.max, min = Math.min, stack = [];
	// deal with negative values, and find the plane of intersection
	if(dx < 0.0) {ox = s-ox; dx = -dx; a |= 4;}
	if(dy < 0.0) {oy = s-oy; dy = -dy; a |= 2;}
	if(dz < 0.0) {oz = s-oz; dz = -dz; a |= 1;}
	// intersect
	let tx0 = -ox/dx, tx1 = (s - ox)/dx, 
	    ty0 = -oy/dy, ty1 = (s - oy)/dy,
	    tz0 = -oz/dz, tz1 = (s - oz)/dz;
	if(max(tx0,ty0,tz0) < min(tx1,ty1,tz1)) recurseSubtree(a, stack, tx0,ty0,tz0, tx1,ty1,tz1, this.firstOffset);
}

 * @private
 * Recursive portion of the traversal algorithm
 *
function recurseSubtree(a, stack, tx0,ty0,tz0, tx1,ty1,tz1, voc, ptr) {
	let depth = voc.depth, getP = voc.getP.bind(voc);
	if(tx1 < 0.0 || ty1 < 0.0 || tz1 < 0.0) return;
	if (getP(ptr) === 0) {
		stack.push(ptr);
		return;
	}
	let txm = 0.5*(tx0+tx1), tym = 0.5*(ty0+ty1), tzm = 0.5*(tz0+tz1);
	let curId = octantIdentity([txm,tym,tzm]);
	do {
		switch(curId) {
			case(0):
				recurseSubtree(a, stack, tx0,ty0,tz0, txm,tym,tzm, voc, ptr);
		}
	}
	while (curId < depth);
}
*/

/**
 * Gets an array of each voxel in an octet.
 * @param {vector} v coordinates of voxel
 * @return {array} array of 8 voxels ordered by identity (@see voctopus/util#octetIdentity)
 */
Voctopus.prototype.getOctet = function(v) {
	let ptr = this.init(v), os = this.octetSize, vs = this.octantSize;
	let get = this.get.bind(this);
	let voxels = [];
	ptr = ptr - ptr % os;
	for(var i = 0; i < 8; ++i) {
		voxels.push(get(ptr+i*vs));
	}
	return voxels;
}

/**
 * Sets the data for each element in an octet. Pointers are managed automatically.
 * This can be a big performance boost when you have multiple voxels to write to the
 * same octet, since it avoids redundant traversal.
 *
 * @param {int} index
 * @param {array} data 8-element array of objects containing voxel properties
 * @example
 * let voc = new Voctopus(6);
 * let data = array[
 * 	 {}, // members may be empty, but must be present so the indexes are correct
 * 	 {r:210,g:12,b:14,m:2}, // can use all properties
 * 	 {r:7},   // or
 * 	 {g:82},  // any
 * 	 {b:36},  // combination
 * 	 {r:255}, // thereof
 * 	 {},
 * 	 {}
 * ];
 * // in this example, walk to the second-lowest depth to find the pointer
 * voc.init([0,0,1]);
 * let index = voc.walk([0,0,1]).p;
 * voc.set.octet(index, data); // and done!
 * @return {undefined}
 */
Voctopus.prototype.setOctet = function(vec, data) {
	let ptr = this.init(vec), os = this.octetSize, vs = this.octantSize;
	let set = this.set.bind(this);
	ptr = ptr - ptr % os;
	for(var i = 0; i < 8; ++i) {
		set(ptr+i*vs, data[i]);
	}
}

/**
 * @private
 * Defines accessors for a voctopus object. Called during initialization and any time
 * the buffer is updated.
 */
function defineAccessors(voc) {
	var i, len;
	for(i = 0, len = voc.schema.length; i < len; ++i) {
		let {label, offset, length} = voc.schema[i];
		voc.get[label] = getterFactory(length, offset, voc.view);
		voc.set[label] = setterFactory(length, offset, voc.view);
	}
}

if(typeof(module) !== "undefined") {
	module.exports.Voctopus = Voctopus;
}

