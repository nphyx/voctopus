"use strict";
/*jshint strict:false */
/*jshint globalstrict:true */
/*jshint latedef:nofunc */
const {VoctopusKernel, VK_FO} = require("./voctopus.kernel.asm.js");
const {sump8, octantOffset, npot, rayAABB} = require("../src/voctopus.util");
const MAX_BUFFER = 1024*1024*1024*512;
const create = Object.create;
const voxel = {
	r:0,
	g:0,
	b:0,
	a:0,
}

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
function Voctopus(depth) {
	if(!depth) throw new Error("Voctopus#constructor must be given a depth");
	var buffer, view, octantSize, octetSize, firstOffset, startSize, maxSize, dimensions, kernel;

	function octet() {
		return [
			create(voxel),
			create(voxel),
			create(voxel),
			create(voxel),
			create(voxel),
			create(voxel),
			create(voxel),
			create(voxel)
		];
	}

	/**
	* calculate the size of a single octant based on the sum of lengths of properties 
	* in the schema. the size of an octant is just the size of 8 octets
	*/
	octantSize = 8; // bytes for a single octet
	octetSize = octantSize * 8;
	firstOffset = VK_FO; 
	maxSize = npot(firstOffset+sump8(depth));
	dimensions = Math.pow(2, depth);

	// define public properties now
	Object.defineProperties(this, {
		"octetSize":{get: () => octetSize},
		"octantSize":{get: () => octantSize},
		"freedOctets":{value: [], enumerable: false},	
		"nextOffset":{get: () => kernel.getNextOffset(), set: (v) => kernel.setNextOffset(v), enumerable: false},
		"firstOffset":{get: () => firstOffset},
		"depth":{get: () => depth},
		"buffer":{get: () => buffer, set: (x) => buffer = x},
		"view":{get: () => view, set: (x) => view = x},
		"maxSize":{get: () => maxSize},
		"dimensions":{get: () => dimensions},
		"voxel":{get: () => voxel}
	});

	/**
	* Set up the ArrayBuffer as a power of two, so that it can be used as a WebGL
	* texture more efficiently. The minimum size should be keyed to the minimum octant
	* size times nine because that corresponds to a tree of depth 2, the minimum useful
	* tree. Optimistically assume that deeper trees will be mostly sparse, which should
	* be true for very large trees (and for small trees, expanding the buffer won't
	* be as expensive).
	*/
	startSize = npot(Math.max(0x10000, Math.min(maxSize/8, MAX_BUFFER)));
	try {
		// start with a 1mb buffer
		this.buffer = new ArrayBuffer(startSize);
		this.buffer.version = 0;
	}
	catch(e) {
		throw new Error("Tried to initialize a Voctopus buffer at depth "+this.depth+", but "+startSize+" bytes was too large");
	}

	// initialize the kernel
	buffer = new ArrayBuffer(startSize);
	view = new Uint8Array(buffer);
	kernel = new VoctopusKernel(buffer, depth-1);


	/**
	* Expands the internal storage buffer. This is a VERY EXPENSIVE OPERATION and
	* should be avoided until neccessary.
	* @return {bool} true if the voctopus was expanded, otherwise false
	*/
	this.expand = function() {
		var s, tmp, max;
		max = Math.min(MAX_BUFFER, this.maxSize);
		s = buffer.byteLength * 2;
		if(s > max) return false;
		tmp = new ArrayBuffer(s);
		tmp.transfer(buffer);
		kernel = new VoctopusKernel(tmp);
		buffer = tmp;
		view = new Uint8Array(buffer);
		return true;
	}

	/**
	* Gets the properties of an octant at the specified index. If the index is invalid
	* you'll get back garbage data, so use with care.
	* @param {int} index index to set
	* @param {voxel} out out param (defaults to instance of this.voxel)
	* @return {voxel}
	* @example
	* let voc = new Voctopus(5);
	* let index = voc.init([9,3,2]); // initializes the voxel at 9,3,2 and returns its index 
	* voc.get(index); // {r:0,g:0,b:0,m:0}
	*/
	this.get = function(p, out = create(voxel)) {
		var raw = kernel.getOctant(p);
		out.r = kernel.rFrom(raw);
		out.g = kernel.gFrom(raw);
		out.b = kernel.bFrom(raw);
		out.a = kernel.aFrom(raw);
		return out;
	}

	/**
	* Sets the properties of an octant at the specified index. Be careful with using it 
	* directly. If the index is off it will corrupt the octree.
	* @param {int} p index to write to
	* @param {int} r red channel 
	* @param {int} g green channel
	* @param {int} b blue channel
	* @param {int} a alpha channel
	* @return {undefined}
	* @example
	* let voc = new Voctopus(5);
	* let index = voc.init([9,3,2]); // initializes the voxel at 9,3,2 and returns its index 
	* voc.set(index, 232, 19, 224, 63); // r = 232, g = 19, b = 224, a = 64 
	*/
	this.set = function(p, r, g, b, a) {
		var rgba = kernel.valFromRGBA(r,g,b,a);
		kernel.setOctant(p, rgba);
		return p;
	}

	this.getPointer = function(index) {
		return kernel.getP(index);
	}

	this.setPointer = function(index, pointer) {
		kernel.setP(index, pointer);
	}


	this.allocateOctet = function() {
		return kernel.allocateOctet();
	}

	/**
	* Initializes a voxel at the supplied vector and branch depth, walking down the
	* tree and allocating voxels at each level until it hits the end.
	* @param {vector} v coordinate vector of the target voxel
	* @param {int} depth depth to initialize at (default max depth)
	* @return {int} index
	* @example
	* let voc = new Voctopus(5);
	* voc.init([9,3,2]); // 1536 (index)
	*/
	this.init = function(v, depth = this.depth) {
		kernel.prepareLookup(v[0], v[1], v[2], depth);
		return(kernel.initOctet());
	}

	/**
	* Walks the octree from the root to the supplied position vector, building an
	* array of indices of each octet as it goes, then returns the array. Optionally
	* initializes octets when init = true.
	* @param {vector} v coordinate vector of the target voxel
	* @param {int} depth number of depth levels to walk through (default this.depth)
	* @param {int} p start pointer (defaults to start of root octet)
	* @return {array} indexes of octant at each branch
	* @example
	* let voc = new Voctopus(5);
	*/
	this.walk = function(v, depth = this.depth, p = kernel.getFirstOffset()) {
		const {step} = kernel;
		let stack = [p], c = 0, push = stack.push.bind(stack); 
		kernel.prepareLookup(v[0], v[1], v[2], depth);
		for(let i = 0; i < depth; ++i) {
			c = step();
			if(c) {
				push(c);
				p = c;
			}
			else return stack;
		}
		return stack;
	}

	/**
	* Gets the properties of a voxel at a given coordinate and (optional) depth.
	* @param {vector} v [x,y,z] position
	* @param {voxel} out out param (defaults to instance of this.voxel)
	* @param {depth} d max depth to read from (default max depth)
	* @return {voxel}
	* @example
	* var voc = new Voctopus(5, schemas.RGBM);
	* voc.getVoxel([13,22,1], 4); // {r:0,g:0,b:0,m:0} (index)
	*/
	this.getVoxel = function(v, out = create(this.voxel), d = this.depth) {
		kernel.prepareLookup(v[0], v[1], v[2], d);
		return this.get(kernel.traverse());
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
	this.setVoxel = function(v, props, d = this.depth) {
		kernel.prepareLookup(v[0], v[1], v[2], d);
		return this.set(kernel.initOctet(), props.r, props.g, props.b, props.a);
	}


	/**
	* Steps through the tree until it finds the deepest voxel at the given coordinate,
	* up to the given depth.
	* @param {vector} v coordinate vector of the target voxel
	* @param {int} depth depth to initialize at (default this.depth - 1)
	* @return {int} index
	*/
	this.traverse = function(v, depth = this.depth) {
		kernel.prepareLookup(v[0], v[1], v[2], depth);
		return kernel.traverse();
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
	* let voc = new Voctopus(6);
	* let data = array[
	* 	 {}, // members may be empty, but must be present so the indexes are correct
	* 	 {r:210,g:12,b:14,a:15}, // can use all properties
	* 	 {a:7},   // or
	* 	 {g:82},  // any
	* 	 {b:36},  // combination
	* 	 {r:255}, // thereof
	* 	 {},
	* 	 {}
	* ];
	* // in this example, walk to the second-lowest depth to find the pointer
	* voc.set.octet([0,0,1], data); // and done!
	*/
	Voctopus.prototype.setOctet = function(v, data, d = this.depth) {
		let p = this.init(v, d);
		const set = this.set.bind(this);
		for(let i = 0; i < 8; ++i) {
			set(p+i, data[i].r, data[i].g, data[i].b, data[i].a);
		}
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
	Voctopus.prototype.getOctet = function(v, d = this.depth, out = octet()) {
		var p = this.traverse(v, d);
		const get = this.get.bind(this);
		for(let i = 0; i < 8; ++i) {
			get(p+i, out[i]);
		}
		return out;
	}

	return this;
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
* Cast a ray into the octree, computing intersections along the path.
* The accumulator function should be in the form `f(t, p) => bool`, where t is distance
* traveled in units, p is a pointer to the voxel hit, and the return value is a boolean
* indicating whether to halt traversal (true = halt, false = continue).
* along ray, an
* @param {vector} ro ray origin coordinates
* @param {vector} rd unit vector of ray direction
* @param {function} f accumulator callback
* @return {bool} true if at least one voxel was hit, otherwise false
* @example
* var voc = new Voctopus(5);
* voc.setVoxel([0,0,0], {r:232,g:0,b:232,m:0}, 0); // set the top,left,rear voxel
* var ro = [16,16,-32]; // start centered 32 units back on z axis 
* var rd = [-0.30151, 0.30148, 0.90454]; // 30 deg left, 30 deg up, forward 
* var dist = 0;
* var index = 0;
* var cb = function(t, p) {
	* 	dist = t;
	* 	index = p;
	* 	return 1; // halt after first hit (you could return 0 to keep )
	* }
	* voc.cast(ro, rd, cb); // 1, because at least one voxel was hit
	* p; // 40, pointer of the voxel at [0,0,0]
	* t; // 
	*/
	Voctopus.prototype.intersect = function(ro, rd, f) {
		// TODO: update these later on to support dynamic coordinates
		let end = this.dimensions - 1;
		let start = 0;
		// decompose vectors, saves time referencing
		let rdi = [1/rd[0], 1/rd[1], 1/rd[2]];

		// find out if ray intersects outer bounding box
		if(rayAABB([start,start,start],[end,end,end], ro, rdi)) {
			// find first octant of intersection
		}

		// descend
		// if hit found, call accumulator
		// if result is zero, repeat for neighbor
		// return pointer
	}

	if(typeof(module) !== "undefined") {
		module.exports.Voctopus = Voctopus;
	}
