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
	octantSize = schema.reduce((prev, cur) => prev += cur.type.length, 0);
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

	this.getters = new Array(this.schema.length);
	this.setters = new Array(this.schema.length);
	this.labels  = new Array(this.schema.length);
	this.offsets = new Array(this.schema.length);
	defineAccessors(this);

	// set up the voxel class - this will help js engines optimize 
	this.voxel = {}; 

	// initialize the root node
	this.set.p(0, this.octetSize);

	return this;
}

/**
 * Walks the octree from the root to the supplied position vector, building an
 * array of indices of each octet as it goes, then returns the array. Optionally
 * initializes octets when init = true.
 * @param {vector} v coordinate vector of the target voxel
 * @param {int} depth number of depth levels to walk through (default this.depth)
 * @param {int} c start pointer (defaults to start of root octet)
 * @return {array} indexes of octant at each branch
 * @example
 * let voc = new Voctopus(5);
 */
Voctopus.prototype.walk = function(v, depth = this.depth - 1, c = undefined) {
	// object property lookups can be really slow so predefine things here
	let	dc = 0, dm = this.depth, pGet = this.get.p, os = this.octantSize, stack = [];
	if(c === undefined) c = this.firstOffset + octantOffset(v, 0, dm, os);
	stack.push(c);

	// walk the tree til we reach the end of a branch
	while ((c = pGet(c)) !== 0 && ++dc <= depth) {
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
 * @example
 * let voc = new Voctopus(5);
 * voc.init([9,3,2]); // 1536 (index)
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
 * Gets the properties of an octant at the specified index. If the index is invalid
 * you'll get back garbage data, so use with care.
 * @param {int} index index to set
 * @return {voxel}
 * @example
 * let voc = new Voctopus(5);
 * let index = voc.init([9,3,2]); // initializes the voxel at 9,3,2 and returns its index 
 * voc.get(index); // {r:0,g:0,b:0,m:0}
 */
Voctopus.prototype.get = function(index) {
	let voxel = Object.create(this.voxel);
	let {getters, labels, offsets, view} = this;
	for(let i = 1, len = labels.length; i < len; ++i) {
		voxel[labels[i]] = getters[i].call(view, index+offsets[i]);
	}
	return voxel;
}

/**
 * Sets the properties of an octant at the specified index. Be careful with using it 
 * directly. If the index is off it will corrupt the octree.
 * @param {int} index index to write to
 * @param {object} voxel voxel data to write (may be partial)
 * @return {undefined}
 * @example
 * let voc = new Voctopus(5);
 * let index = voc.init([9,3,2]); // initializes the voxel at 9,3,2 and returns its index 
 * voc.set(index, {r:232,g:19,b:22,m:4}); // you can supply all properties
 * voc.set(index, {r:232,m:13}); // or just some of them 
 */
Voctopus.prototype.set = function(index, voxel) {
	let {setters, labels, offsets, view} = this, prop;
	for(let i = 1, len = labels.length; i < len; ++i) {
		prop = voxel[labels[i]];
		if(prop !== undefined) {
			setters[i].call(view, index+offsets[i], prop);
		}
	}
}

/**
 * Gets the properties of a voxel at a given coordinate and (optional) depth.
 * @param {vector} v [x,y,z] position
 * @param {depth} d max depth to read from (default max depth)
 * @return {voxel}
 * @example
 * var voc = new Voctopus(5, schemas.RGBM);
 * voc.getVoxel([13,22,1], 4); // {r:0,g:0,b:0,m:0} (index)
 */
Voctopus.prototype.getVoxel = function(v, d = this.depth) {
	let indices = this.walk(v, d);
	let props = this.get(indices[indices.length - 1]);
	return props;
}

/**
 * Sets the properties of an octant at a given coordinate and (optional) depth.
 * @param {vector} v [x,y,z] position 
 * @param {object} props a property object, members corresponding to the schema
 * @param {depth} d depth to write at (default max depth)
 * @return {index} pointer to the voxel that was set
 * @example
 * var voc = new Voctopus(5, schemas.RGBM);
 * voc.setVoxel([13,22,1], {r:122,g:187,b:1234,m:7}, 4); // 1536 (index)
 */
Voctopus.prototype.setVoxel = function(v, props, d = this.depth - 1) {
	let ptr = this.init(v, d);
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
 * Gets an array of each voxel in an octet. Pointers are managed automatically.
 * This can be a big performance boost when you have multiple voxels to write to the
 * same octet, since it avoids redundant traversal. Octet location is automatically
 * derived from the given vector so it doesn't have to point at the first voxel in
 * the octet. If the octet doesn't currently exist in the tree it will be initialized.
 *
 * @param {vector} v coordinates of voxel
 * @param {depth} d depth to write at (default max depth)
 * @return {array} array of 8 voxels ordered by identity (@see voctopus/util#octetIdentity)
 * @example
 * let voc = new Voctopus(5, schemas.I8M16P);
 * voc.getOctet([0,0,0], 3)
 * 	.map((voxel) => console.log(voxel)); // {m:0} (x8)
 */
Voctopus.prototype.getOctet = function(v, depth = this.depth - 1) {
	let ptr = this.init(v, depth), os = this.octetSize, vs = this.octantSize;
	let {getters, labels, offsets, view} = this;
	let i, n, len = labels.length;
	let get, offset, label, pb;
	ptr = ptr - ptr % os;
	var octetArray = [{},{},{},{},{},{},{},{}];
	for(n = 1; n < len; ++n) {
		get = getters[n];
		offset = offsets[n];
		label = labels[n];
		pb = ptr;
		for(i = 0; i < 8; ++i) {
			octetArray[i][label] = get.call(view, pb+offset);
			pb += vs;
		}
	}
	return octetArray;
}

/**
 * Sets the data for each element in an octet. Pointers are managed automatically.
 * This can be a big performance boost when you have multiple voxels to write to the
 * same octet, since it avoids redundant traversal. Octet location is automatically
 * derived from the given vector so it doesn't have to point at the first voxel in
 * the octet. If the octet doesn't currently exist in the tree it will be initialized.
 *
 * @param {vector} v position vector for target octet 
 * @param {array} data data to write, as an array of 8 objects (see example)
 * @param {depth} d depth to write at (default max depth)
 * @return {undefined}
 * @example
 * let voc = new Voctopus(6, schemas.RGBM);
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
 * voc.set.octet([0,0,1], data); // and done!
 */
Voctopus.prototype.setOctet = function(v, data, depth = this.depth - 1) {
	let ptr = this.init(v, depth), os = this.octetSize, vs = this.octantSize, prop;
	let {setters, labels, offsets, view} = this;
	let i, n, len = labels.length;
	let set, offset, label, pb;
	ptr = ptr - ptr % os;
	for(n = 1; n < len; ++n) {
		set = setters[n];
		offset = offsets[n];
		label = labels[n];
		pb = ptr;
		for(i = 0; i < 8; ++i) {
			prop = data[i][label];
			if(prop !== undefined) {
				set.call(view, pb+offset, prop);
			}
			pb += vs;
		}
	}
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
 * @private
 * Defines accessors for a voctopus object. Called during initialization and any time
 * the buffer is expanded (since the view will need to be re-bound).
 */
function defineAccessors(voc) {
	var offset = 0, i, len;
	for(i = 0, len = voc.schema.length; i < len; ++i) {
		let {label, type} = voc.schema[i];
		let get = getterFactory(type.get, voc.view, offset);
		let set = setterFactory(type.set, voc.view, offset);
		voc.get[label] = get;
		voc.getters[i] = type.get;
		voc.set[label] = set;
		voc.setters[i] = type.set;
		voc.labels[i] = label;
		voc.offsets[i] = offset;
		offset += type.length;
	}
}

if(typeof(module) !== "undefined") {
	module.exports.Voctopus = Voctopus;
}
