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

function Voctopus(depth, schema = schemas.RGBM) {
	var buffer, view, octantSize, octetSize, nextOctet, startSize, maxSize;

	/**
	 * calculate the size of a single octant based on the sum of lengths of properties 
	 * in the schema. the size of an octant is just the size of 8 octets
	 */
	octantSize = schema.reduce((prev, cur) => prev += cur.length, 0);
	octetSize = octantSize * 8;
	maxSize = fullOctreeSize(octantSize, depth);

	// define public properties now
	Object.defineProperties(this, {
		"schema":{get: () => schema},
		"octetSize":{get: () => octetSize},
		"octantSize":{get: () => octantSize},
		"freedOctets":{value: [], enumerable: false},	
		"nextOctet":{get: () => nextOctet, set: (v) => nextOctet = v, enumerable: false},
		"depth":{get: () => depth,},
		"buffer":{get: () => buffer, set: (x) => buffer = x},
		"view":{get: () => view, set: (x) => view = x},
		"maxSize":{get: () => maxSize},
	});

	// we'll initialize the first octet below, so start at the next one
	nextOctet = octetSize+octantSize; 


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

	defineAccessors(this);

	// initialize the root node
	this.set.p(0, this.octantSize);
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
 * Traverses the octree from the root to the supplied position vector, returning
 * the buffer index of the leaf octant. Optionally initializes new octets when
 * init = true.
 */
Voctopus.prototype.traverse = function(v, init = false) {
	// we can skip the first octant since its children are at a known address
	var d = 1, nextOctet = 0, cursor = this.octantSize, bLength = this.buffer.byteLength; 
		// object property lookups can be really slow so predefine things here
	var pGet = this.get.p, 
		pSet = this.set.p,
		depth = this.depth,
		octantSize = this.octantSize, 
		getEmpty = this.getEmptyOctet.bind(this);

	// walk the tree til we reach the end of a branch
	do {
		if(cursor+octantSize < bLength) {
			nextOctet = pGet(cursor);
		}
		else nextOctet = 0;
		if(init && !nextOctet) {
			nextOctet = getEmpty();
			bLength = this.buffer.byteLength;
			pSet(cursor, nextOctet);
		}
		if(nextOctet) cursor = nextOctet+octantIdentity(v, depth - ++d)*octantSize;
	}
	while(nextOctet !== 0 && d < depth);
	return cursor;
}

/**
 * Walks the octree from the root to the supplied position vector, building an
 * array of indices of each octet as it goes, then returns the array. Optionally
 * initializes octets when init = true.
 * @param {vector} v coordinate vector of the target voxel
 * @param {bool} init if true, initializes new octants as it walks (default false)
 * @return {ArrayBuffer} indexes of octant at each branch
 */
Voctopus.prototype.walk = function(v, init = false) {
	// we can skip the first octant since its children are at a known address
	var d = 1, cursor = this.octantSize, bLength = this.buffer.byteLength;
		// object property lookups can be really slow so predefine things here
	var 
		pGet = this.get.p, 
		pSet = this.set.p, 
		depth = this.depth,
		octantSize = this.octantSize, 
		getEmpty = this.getEmptyOctet.bind(this), 
		stack = new Uint32Array(this.depth);
	stack[0] = cursor;
	// walk the tree til we reach the end of a branch
	do {
		if(cursor+octantSize < bLength) {
			stack[d] = pGet(cursor);
		}
		else stack[d] = 0;
		if(init && stack[d] === 0) {
			stack[d] = getEmpty();
			bLength = this.buffer.byteLength;
			pSet(cursor, stack[d]);
		}
		if(stack[d] !== 0) cursor = stack[d]+octantIdentity(v, depth - d+1)*octantSize;
		d++;
	}
	while(d < depth);
	return stack;
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
	for(let i = 0, l = this.fields.length; i < l; i++) {
		let label = this.fields[i];
		if(typeof(props[label]) !== "undefined") {
			this.set[label](index, props[label]);
		}
	}
}

/**
 * Gets the properties of an octant at a given coordinate vector.
 * @param {vector} v [x,y,z] position
 * @param {object} props a property object, members corresponding to the schema
 * @return {undefined}
 */
Voctopus.prototype.getVoxel = function(v) {
	// note we set this up to skip the root node since its index is predictable
	return this.get(this.traverse(v));
}

/**
 * Sets the properties of an octant at a given coordinate vector..
 * @param {vector} v [x,y,z] position 
 * @param {object} props a property object, members corresponding to the schema
 * @return {undefined}
 */
Voctopus.prototype.setVoxel = function(v, props) {
	return this.set(this.traverse(v, true), props);
}

/**
 * Returns the next available unused octet position, calling Voctopus#allocateOctet
 * if a previously freed octet is available, which may in turn trigger an expansion
 * via Voctopus#expand (side effect warning).
 */
Voctopus.prototype.getEmptyOctet = function() {
	if(this.freedOctets.length > 0) return this.freedOctets.pop();
	else return this.allocateOctet();
}

/**
 * Allocates an octet, returning its address and incrementing the nextOctet pointer.
 * @return {int} new octet beginning address
 */
Voctopus.prototype.allocateOctet = function() {
	var next = this.nextOctet, size = this.octetSize;
	if(next+size > this.buffer.byteLength) this.expand();
	var ret = next; 
	this.nextOctet += size;
	return ret;
}

/**
 * Prunes redundant octets (those which are empty or have identical values). Freed
 * octets are added to the freedOctets array.
 * @return {bool} true on success or nothing to be done, false on failure
 */
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
	max = Math.min(MAX_BUFFER, npot(this.maxSize));
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
