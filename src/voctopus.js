"use strict";

/**
 * Sum of powers of 8 up to n. Used in various calculations.
 */
function sump8(n) {
	return ~~((Math.pow(8, n+1) -1) / 7);
}
/**
 * New approach to octants: a schema description instead of a DataView.
 * This should improve performance.
 */
var VoctantRGBM = [
	{label:"r",offset:0,length:1},
	{label:"g",offset:1,length:1},
	{label:"b",offset:2,length:1},
	{label:"material",offset:3,length:1},
	{label:"pointer",offset:4,length:4}
];

/**
 * Quick definition of terms:
 * 1 octant = one voxel at a given depth
 * 1 octant = 8 octants, or one tree node
 *
 * TODO: Deal with endianness in buffer
 */
function Voctopus(depth, schema = VoctantRGBM) {
	var buffer, octantSize, octetSize, nextOctet, startSize;
	// figure out the maximum number of bytes to allocate initially -
	// it must be at most the maximum length, and at least 146 or maximum length/4,
	// whichever is higher, times 8 (because each Octant is 8 bytes long)
	octantSize = schema.reduce((prev, cur) => prev += cur.length, 0);
	octetSize = octantSize * 8;
	nextOctet = octetSize+octantSize; // we'll initialize the first octet below, so start at the next one
	Object.defineProperty(this, "schema", {
		get: () => schema
	});
	Object.defineProperty(this, "octetSize", {
		get: () => octetSize
	});
	Object.defineProperty(this, "octantSize", {
		get: () => octantSize
	});
	Object.defineProperty(this, "freedOctets", {
		value: [],
		enumerable: false
	});
	Object.defineProperty(this, "nextOctet", {
		get: () => nextOctet,
		set: (v) => nextOctet = v,
		enumerable: false
	});

	/**
	 * @property buffer
	 * Store the raw data in an ArrayBuffer. Octants are 8 bytes - 1 byte each 
	 * for rgb + 1 byte for material index (stores additional material info) 
	 * + 4 bytes for a 32 bit float pointer. A full octant is thus 16 bytes. 
	 * An octet contains 8 octants. Each octet is stored sequentially, with 
	 * the pointer of each octant indicating the index of its child octet. 
	 *
	 * The formula for the total size of a fully dense octree is the sum of 
	 * powers of 8 up to 8^depth * 2 bytes. We optimistically assume that the 
	 * octree is only about 1/8th dense, and expand it if we have to. This is 
	 * based on the fact that the top half of a tree is probably sky, and the 
	 * bottom half is probably fairly sparse.
	 */
	Object.defineProperty(this, "buffer", {
		get: () => buffer,
		set: (x) => buffer = x 
	});
	this.depth = depth;
	startSize = Math.max((9*this.octantSize), (this.maxSize()/4));
	try {
		this.buffer = new ArrayBuffer(startSize);
		this.buffer.version = 0;
	}
	catch(e) {
		throw new Error("Tried to initialize a Voctopus buffer at depth "+this.depth+", but "+startSize+" bytes was too large");
	}
	this.view = new DataView(this.buffer);
	this.set(0, {pointer:this.octantSize}); // initialize the root node

	return this;
}

Voctopus.prototype.getVoxel = function(v) {
	// note we set this up to skip the root node since its index is predictable
	let d = 1, cursor = this.octantSize, index = 0, pOff = this.schema.find((el) => el.label === "pointer").offset;
	// walk the tree til we reach the end of a branch
	do {
		index = this.view.getUint32(cursor+pOff);
		d++; // we're starting at the first octet so increment depth first
		cursor = index+this.octantOffset(v, d);
	}
	while(index !== 0 && d < this.depth);
	return this.get(cursor);
}

Voctopus.prototype.setVoxel = function(v, props) {
	// note we set this up to skip the root node since its index is predictable
	var d = 1, cursor = 0, index = this.octantSize, pOff = this.schema.find((el) => el.label === "pointer").offset;
	// walk the tree til we reach the end of a branch to full depth
	while(d < this.depth) {
		cursor = index+this.octantOffset(v, d);
		index = this.view.getUint32(cursor+pOff);
		// find the child index, create new octet if necessary
		if(index === 0) {
			index = this.getEmptyOctet();
			this.view.setUint32(cursor+pOff, index)
		}
		d++;
	}
	cursor = index+this.octantOffset(v, d); 
	this.set(cursor, props);
	return cursor;
}

Voctopus.prototype.get = function(index) {
	var prop, pos, i = 0, l = this.schema.length, dv = this.view, 
	voxel = new Array(l);
	for(;i < l; i++) {
		prop = this.schema[i];
		pos = index+prop.offset;
		switch(prop.length) {
			case 1: voxel[i] = dv.getUint8(pos); break;
			case 2: voxel[i] = dv.getUint16(pos); break;
			case 4: voxel[i] = dv.getUint32(pos); break;
			//default: throw new Error("Invalid property length for property "+prop.label)
		}
	}
	return voxel;
}

Voctopus.prototype.set = function(index, props) {
	var prop, pos, i = 0, dv = this.view, l = this.schema.length;
	for(;i < l; i++) {
		prop = this.schema[i];
		if(typeof(props[prop.label]) !== "undefined") {
			pos = index+prop.offset;
			switch(prop.length) {
				case 1: dv.setUint8(pos, props[prop.label]); break;
				case 2: dv.setUint16(pos, props[prop.label]); break;
				case 4: dv.setUint32(pos, props[prop.label]); break;
				//default: throw new Error("Invalid property length for property "+label)
			}
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

Voctopus.prototype.allocateOctet = function() {
	if(this.nextOctet+this.octetSize > this.buffer.length) this.expand();
	var ret = this.nextOctet;
	this.nextOctet += this.octetSize;
	return ret;
}

Voctopus.prototype.prune = function() {
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
 */
Voctopus.prototype.expand = function() {
	var maxSize, s, tmp, tmpdv, dv, mod, len, i;
	maxSize = this.maxSize();
	dv = this.view;
	len = this.buffer.byteLength;
	// derive last sparse factor from current this.buffer length, then decrement it
	s = ~~(maxSize/len)-1;
	// don't divide by zero, that would be bad
	if(s < 1) throw new Error("tried to expand a voctopus, but it's already at maximum size - this means something has gone horribly wrong!");
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
	return this;
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
}
