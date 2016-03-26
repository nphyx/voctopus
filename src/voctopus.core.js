"use strict";
const schemas = require("./voctopus.schemas");
const {fullOctreeSize, octantIdentity, npot, getterFactory, setterFactory} = require("../src/voctopus.util.js");
const MAX_BUFFER = 1024*1024*1024*512;

/**
 * Voctopus Core
 * =============
 *
 * This contains the core Voctopus object.
 *
 * Quick definition of terms:
 * 1 octant = one voxel at a given depth
 * 1 octet = 8 octants, or one tree node
 *
 * @module voctopus.core
 */

/**
 * Sets the data for each element in an octet. Pointers are managed automatically.
 * This can be a big performance boost when you have multiple voxels to write to the
 * same octet, since it avoids redundant traversal.
 * @example
 * ```javascript
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
 * ```
 * @param {int} index
 * @param {array} data 8-element array of objects containing voxel properties
 * @return {undefined}
 */
function setOctet(voc, index, data) {
	for(var i = 0; i < 8; ++i) {
		voc.set(index+i*voc.octantSize, data[i]);	
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
	voc.set.octet = setOctet.bind(null, voc);
}

function Voctopus(depth, schema = schemas.RGBM) {
	if(!depth) throw new Error("Voctopus#constructor must be given a depth");
	var buffer, view, octantSize, octetSize, firstOffset, nextOctet, startSize, maxSize, dimensions, walkStack;

	/**
	 * calculate the size of a single octant based on the sum of lengths of properties 
	 * in the schema. the size of an octant is just the size of 8 octets
	 */
	octantSize = schema.reduce((prev, cur) => prev += cur.length, 0);
	octetSize = octantSize * 8;
	maxSize = npot(fullOctreeSize(octantSize, depth));
	dimensions = Math.pow(2, depth);
	walkStack = [];

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
		"walkStack":{get: ()=> walkStack, set:(x) => walkStack = x}
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
	for(let i = 0, l = this.schema.length; i < l; ++i) {
		let label = this.schema[i].label;
		if(label !== "p") {
			this.fields.push(label);
			this.voxel[label] = 0;
		}
	}
	return this;
}

/**
 * Walks the octree from the root to the supplied position vector, building an
 * array of indices of each octet as it goes, then returns the array. Optionally
 * initializes octets when init = true.
 * @param {vector} v coordinate vector of the target voxel
 * @param {int} depth maximum depth to walk to (default this.depth)
 * @param {int} startPointer start pointer (defaults to start of root octet)
 * @return {ArrayBuffer} indexes of octant at each branch
 */
Voctopus.prototype.walk = function(v, depth = this.depth, cursor = this.firstOffset) {
	// object property lookups can be really slow so predefine things here
	var 
	  i = 0, 
		md = this.depth,
		pGet = this.get.p, 
		octantSize = this.octantSize, 
		stack = [];

	// walk the tree til we reach the end of a branch
	for(i = 0; i < depth; i++) {
		cursor += octantIdentity(v, md - (i+1))*octantSize;
		stack.push(cursor);
		cursor = pGet(cursor);
		if(cursor === 0) break;
	}
	return stack;
}

/**
 * Initializes a voxel at the supplied vector and branch depth, walking down the
 * tree and allocating voxels at each level until it hits the end.
 * @param {vector} v coordinate vector of the target voxel
 * @param {int} depth depth to walk to (default this.depth)
 * @param {bool} init if true, initializes new octants as it walks (default false)
 * @return {int} index
 */
Voctopus.prototype.init = function(v, depth = this.depth) {
	let p = 0, next = 0;
	let stack = this.walk(v, depth);
	let len = stack.length;
	p = stack[len-1];
	if(len < depth) {
		let pointers = this.allocateOctets(depth - len);
		let setP = this.set.p.bind(this);
		for(let n = 0, len = pointers.length; n < len; ++n) {
			next = pointers[n];
			setP(p, next);
			p = next;
		}
	}
	return p;
}


/**
 * Gets the properties of an octant at the specified index.
 * @param {int} index
 * @return {undefined}
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
	var keys = Object.keys(props);
	for(let i = 0, l = keys.length; i < l; ++i) {
		let label = keys[i];
		this.set[label](index, props[label]);
	}
	/*
	for(let i = 0, l = this.fields.length; i < l; i++) {
		let label = this.fields[i];
		if(typeof(props[label]) !== "undefined") {
			this.set[label](index, props[label]);
		}
	}
	*/
}

/**
 * Gets the properties of an octant at a given coordinate vector.
 * @param {vector} v [x,y,z] position
 * @return {undefined}
 */
Voctopus.prototype.getVoxel = function(v) {
	// note we set this up to skip the root node since its index is predictable
	let stack = this.walk(v);
	let val = this.get(stack[this.depth-1]);
	return val;
}

/**
 * Sets the properties of an octant at a given coordinate vector..
 * @param {vector} v [x,y,z] position 
 * @param {object} props a property object, members corresponding to the schema
 * @return {undefined}
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
 * Prunes redundant octets (those which are empty or have identical values). Freed
 * octets are added to the freedOctets array.
 * @return {bool} true on success or nothing to be done, false on failure
 *
Voctopus.prototype.prune = function() {
	var d = 0, cursor = this.octantSize, nextOctet = 0, pointer = this.schema.find((el) => el.label === "p");
	function checkOctet() {
			
	}
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
 * Initializes the values of an entire octet to 0.
 * @param {int} o byteOffset for start of octet
 * @return {undefined}
 *
 */
Voctopus.prototype.initializeOctet = function(o) {
	var i, s, v;
	i = 0;
	s = this.octetSize;
	v = new DataView(this.buffer, o);
	for(i = 0; i < s; i++) {
		v.setUint8(i, 0); 
	}
}


/**
 * Support commonjs modules for Nodejs/backend
 */
if(typeof(module) !== "undefined") {
	module.exports.Voctopus = Voctopus;
}
