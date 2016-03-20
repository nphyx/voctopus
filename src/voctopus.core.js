"use strict";
const schemas = require("./voctopus.schemas");
/**
 * Voctopus Core
 * =============
 *
 * This contains the core Voctopus object.
 *
 * @module voctopus.core
 */

/**
 * @private
 * Provide a 24 bit int implementation for DataViews. Note this
 * causes two reads/writes per call, meaning it's going to be
 * around half as fast as the native implementations.
 */
DataView.prototype.getUint24 = function(pos) {
	return (this.getUint16(pos) << 8) + this.getUint8(pos+2);
}

/**
 * @private
 * Setter for Uint24.
 */
DataView.prototype.setUint24 = function(pos, val) {
	this.setUint16(pos, val >> 8);
	this.setUint8(pos+2, val & ~4294967040);
}

/**
 * @private
 * Sum of powers of 8 up to n. Used in various calculations.
 */
function sump8(n) {
	return ~~((Math.pow(8, n+1) -1) / 7);
}

/**
 * Quick definition of terms:
 * 1 octant = one voxel at a given depth
 * 1 octet = 8 octants, or one tree node
 *
 * TODO: Deal with endianness in buffer
 */
function Voctopus(depth, schema = schemas.RGBM) {
	var buffer, view, octantSize, octetSize, nextOctet, startSize, maxP;

	// calculate the size of a single octant based on the sum of lengths of properties in the schema
	octantSize = schema.reduce((prev, cur) => prev += cur.length, 0);
	// the size of an octant is just the size of 8 octets
	octetSize = octantSize * 8;

	// define public properties now
	Object.defineProperties(this, {
		"schema":{get: () => schema},
		"octetSize":{get: () => octetSize},
		"octantSize":{get: () => octantSize},
		"freedOctets":{value: [], enumerable: false},	
		"nextOctet":{get: () => nextOctet, set: (v) => nextOctet = v, enumerable: false},
		"depth":{get: () => depth,},
		"buffer":{get: () => buffer, set: (x) => buffer = x},
		"view":{get: () => view, set: (x) => view = x}
	});

	// we'll initialize the first octet below, so start at the next one
	nextOctet = octetSize+octantSize; 

	// figure out the maximum number of bytes to allocate initially -
	// it must be at most the maximum length, and at least 146 or maximum length/4,
	// whichever is higher, times the size of an Octant
	startSize = Math.max((9*this.octantSize), (this.maxSize()/4));

	// check to make sure the requested Voctopus size is sane
	maxP = Math.pow(2, schema.find((prop) => prop.label === "pointer").length*8);
	if(this.maxSize() > maxP) throw new Error("Voctant#constructor: requested a depth of "+depth+" but that would exceed the schema's pointer limitations of "+maxP);

	/**
	 * The formula for the total size of a fully dense octree is the sum of 
	 * powers of 8 up to 8^depth * (octantSize) bytes. We optimistically assume that the 
	 * octree is only about 1/8th dense, and expand it if we have to. This is 
	 * based on the assumpton that the top half of a tree is probably sky, and the 
	 * bottom half is probably fairly sparse.
	 */
	try {
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
		if(nextOctet) cursor = nextOctet+this.octantOffset(v, ++d);
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
		if(stack[d] !== 0) cursor = stack[d]+this.octantOffset(v, d+1);
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

Voctopus.prototype.maxSize = function() {
	return sump8(this.depth)*this.octantSize;
}

/**
 * Expands the internal storage buffer. This is a VERY EXPENSIVE OPERATION and
 * should be avoided until neccessary. Could result in out of memory errors.
 * TODO: verify data integrity in test 
 *
 * @param this.depth {int} max depth of tree
 * @return true if the voctopus was expanded, otherwise false
 */
Voctopus.prototype.expand = function() {
	var maxSize, s, tmp, tmpdv, dv, mod, len, i;
	maxSize = this.maxSize();
	dv = this.view;
	len = this.buffer.byteLength;
	// derive last sparse factor from current this.buffer length, then decrement it
	s = ~~(maxSize/len)-1;
	// don't divide by zero, that would be bad
	if(s < 1) return false; //throw new Error("tried to expand a voctopus, but it's already at maximum size - this means something has gone horribly wrong!");
	tmp = new ArrayBuffer(~~(maxSize/s));
	tmpdv = new DataView(tmp);
	mod = len%8;
	// we can't rely on ArrayBuffer.transfer yet, but we can at least read 64 bits at a time
	for(i = 0; i < len-mod; i+=8) tmpdv.setFloat64(i, dv.getFloat64(i));
	// get any leftovers
	for(i = (mod-len)*-1; i < len; i++) tmpdv.setUint8(i, dv.getUint8(i));
	tmp.nextIndex = parseInt(this.buffer.nextIndex);
	tmp.version = this.buffer.version+1;
	this.buffer = tmp;
	this.view = tmpdv;
	return true;
}

/**
 * Initializes the values of an entire octet to 0.
 * @param o {int} byteOffset for start of octet
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
 * Returns the identity (0-7) of the suboctant at depth d, position v
 * @param v global coordinate of voxel 
 * @param d depth to check
 */
Voctopus.prototype.octantOffset = function(v, d) {
	d = this.depth - d;
	return (((v[2] >>> d) & 1) << 2 | 
					((v[1] >>> d) & 1) << 1 |
					((v[0] >>> d) & 1) 
				 )*this.octantSize;
}

/**
 * Support commonjs modules for Nodejs/backend
 */
if(typeof(module) !== "undefined") {
	module.exports.Voctopus = Voctopus;
	// expose the extended DataView for testing
	module.exports.ExtDV = DataView;
}
