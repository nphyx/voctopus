"use strict";
const schemas = require("./voctopus.schemas");
const {fullOctreeSize, octantIdentity, npot} = require("../src/voctopus.util.js");
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
 *
 * TODO: Deal with endianness in buffer
 */
function Voctopus(depth, schema = schemas.RGBM) {
	var buffer, view, octantSize, octetSize, nextOctet, startSize, maxP, maxSize, updated, detached;

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
		"maxSize":{get: () => maxSize}
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
	startSize = npot(Math.max((9*this.octantSize), Math.min(maxSize/8, 1024*1024*1024*512)));
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
	// initialize the root node
	this.setOctant(0, {pointer:this.octantSize}); 
	return this;
}

Voctopus.prototype.getVoxel = function(v) {
	// note we set this up to skip the root node since its index is predictable
	return this.getOctant(this.traverse(v));
}

Voctopus.prototype.setVoxel = function(v, props) {
	// note we set this up to skip the root node since its index is predictable
	return this.setOctant(this.traverse(v, true), props);
}

/**
 * Traverses the octree from the root to the supplied position vector, returning
 * the buffer index of the leaf octant. Optionally initializes new octets when
 * init = true.
 */
Voctopus.prototype.traverse = function(v, init = false) {
	var d = 1, cursor = this.octantSize, nextOctet = 0, pointer = this.schema.find((el) => el.label === "pointer");
	// walk the tree til we reach the end of a branch
	do {
		nextOctet = this.getProperty(cursor, pointer);
		if(init && !nextOctet) {
			nextOctet = this.getEmptyOctet();
			this.setProperty(cursor, pointer, nextOctet);
		}
		if(nextOctet) cursor = nextOctet+octantIdentity(v, this.depth - ++d)*this.octantSize;
	}
	while(nextOctet !== 0 && d < this.depth);
	return cursor;
}

/**
 * Walks the octree from the root to the supplied position vector, building an
 * array of indices of each octet as it goes, then returns the array. Optionally
 * initializes octets when init = true.
 * 
 */
Voctopus.prototype.walk = function(v, init = false) {
	var d = 1, cursor = this.octantSize, pointer = this.schema.find((el) => el.label === "pointer"), stack = new Uint32Array(this.depth);
	stack[0] = cursor;
	// walk the tree til we reach the end of a branch
	do {
		stack[d] = this.getProperty(cursor, pointer);
		if(init && stack[d] === 0) {
			stack[d] = this.getEmptyOctet();
			this.setProperty(cursor, pointer, stack[d]);
		}
		if(stack[d] !== 0) cursor = stack[d]+octantIdentity(v, this.depth - d+1)*this.octantSize;
		d++;
	}
	while(d < this.depth);
	return stack;
}

Voctopus.prototype.getProperty = function(index, prop) {
	var pos;
	pos = index+prop.offset;
	try {
		switch(prop.length) {
			case 1: return this.view.getUint8(pos);
			case 2: return this.view.getUint16(pos);
			case 3: return this.view.getUint24(pos);
			case 4: return this.view.getUint32(pos);
			//default: throw new Error("Invalid property length for property "+prop.label)
		}
	}
	catch(e) {
		throw new Error("Tried to get property "+prop.label+" at "+(index+prop.offset)+" but got error "+e+", buffer length:"+this.buffer.byteLength);
	}
}

Voctopus.prototype.setProperty = function(index, prop, value) {
	var pos;
	pos = index+prop.offset;
	try {
		switch(prop.length) {
			case 1: this.view.setUint8(pos, value); break;
			case 2: this.view.setUint16(pos, value); break;
			case 3: this.view.setUint24(pos, value); break;
			case 4: this.view.setUint32(pos, value); break;
			//default: throw new Error("Invalid property length for property "+label)
		}
	}
	catch(e) {
		throw new Error("Tried to set property "+prop.label+" at "+(index+prop.offset)+" to "+value+" but got error "+e+", buffer length:"+this.buffer.byteLength);
	}

}

Voctopus.prototype.getOctant = function(index) {
	var prop, i = 0, l = this.schema.length, voxel = new Array(l);
	for(;i < l; i++) {
		prop = this.schema[i];
		voxel[i] = this.getProperty(index, prop);
	}
	return voxel;
}

Voctopus.prototype.setOctant = function(index, props) {
	var prop, i = 0, l = this.schema.length;
	for(;i < l; i++) {
		prop = this.schema[i];
		if(typeof(props[prop.label]) !== "undefined") {
			this.setProperty(index, prop, props[prop.label]);
		}
	}
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
 */
Voctopus.prototype.allocateOctet = function() {
	if(this.nextOctet+this.octetSize > this.buffer.length) this.expand();
	var ret = this.nextOctet;
	this.nextOctet += this.octetSize;
	return ret;
}

/**
 * Prunes redundant octets (those which are empty or have identical values). Freed
 * octets are added to the freedOctets array.
 */
Voctopus.prototype.prune = function() {
	var d = 0, cursor = this.octantSize, nextOctet = 0, pointer = this.schema.find((el) => el.label === "pointer");
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
	s = buffer.byteLength * 2;
	max = Math.min(MAX_BUFFER, npot(this.maxSize));
	if(s > max) return false;
	tmp = new ArrayBuffer(s);
	tmp.transfer(buffer);
	this.buffer = tmp;
	this.view = new DataView(this.buffer);
	return true;
}

/**
 * Initializes the values of an entire octet to 0.
 * @param {int} o byteOffset for start of octet
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
