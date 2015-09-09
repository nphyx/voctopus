"use strict";
/**
 * We do lots of undefined checks, let's make it easier to type
 */
function isUndef(val) {
 return typeof(val) === "undefined";
}

/**
 * Sum of powers of 8 up to n. Used in various calculations.
 */
function sump8(n) {
	return ~~((Math.pow(8, n) -1) / 7);
}

/**
 * DataView for a Voctant with 1-byte r,g,b and m values and a 4-byte pointer.
 * @param buffer {ArrayBuffer} the buffer to operate on (should be a Voctopus' buffer)
 * @param offset {int} offset from beginning of buffer for the Octant
 * @param writable {bool} if true, values can be changed; if false, view only
 */
function Voctant(buffer, offset, writable = false) {
	var dv = new DataView(buffer, offset, 16);
	Object.defineProperty(dv, "writable", {
		value:writable,
		writable:false
	});
	Object.defineProperty(dv, "color", {
		get: function() {
			var rgb = new Uint8Array(3);
			rgb[0] = this.getUint8(0);
			rgb[1] = this.getUint8(1);
			rgb[2] = this.getUint8(2);
			return rgb;
		},
		set:function(rgb) {
			if(this.writable) {
				this.setInt8(0, rgb[0]);
				this.setInt8(1, rgb[1]);
				this.setInt8(2, rgb[2]);
			}
		}
	});
	Object.defineProperty(dv, "r", {
		get:function() {return this.getUint8(0);},
		set:function(r) {if(this.writable) this.setInt8(0, r);}
	});
	Object.defineProperty(dv, "g", {
		get:function() {return this.getUint8(1);},
		set:function(g) {if(this.writable) this.setInt8(1, g);}
	});
	Object.defineProperty(dv, "b", {
		get:function() {return this.getUint8(2);},
		set:function(b) {if(this.writable) this.setInt8(2, b);}
	});
	Object.defineProperty(dv, "material", {
		get:function() {return this.getUint8(3);},
		set:function(i) {if(this.writable) this.setInt8(3, i);}
	});
	Object.defineProperty(dv, "pointer", {
		get:function() {return this.getUint32(4);},
		set:function(p) {if(this.writable) this.setUint32(4, p);}
	});
	/**
	 * Convenience function for setting multiple properties at once by passing
	 * an object.
	 */
	dv.setProps = function(p) {
		if(!isUndef(p.r)) this.r = p.r;
		if(!isUndef(p.g)) this.g = p.g;
		if(!isUndef(p.b)) this.b = p.b;
		if(!isUndef(p.material)) this.material = p.material;
		if(!isUndef(p.pointer)) this.pointer = p.pointer;
	}
	return dv;
}
// total size of a single octant in bytes
Voctant.prototype.octantSize = 8;

/**
 * Quick definition of terms:
 * 1 octant = one voxel at a given depth
 * 1 octant = 8 octants, or one tree node
 *
 * TODO: Deal with endianness in buffer
 */
function Voctopus(depth) {
	// figure out the maximum number of bytes to allocate initially -
	// it must be at most the maximum length, and at least 146 or maximum length/4,
	// whichever is higher, times 8 (because each Octant is 8 bytes long)
	var buffer = new ArrayBuffer(Math.min(sump8(depth), Math.max(146, sump8(depth)/4))*8);
	var cursor = 0;
	var nextOctet = Voctant.prototype.octantSize;
	this.octetSize = Voctant.prototype.octantSize*8; // later on we'll allow different octant formats by passing a constructor as an option 
 
	/* jshint unused:false */
	Object.defineProperty(this, "freedOctets", {
		value: [],
		enumerable: false
	});
	Object.defineProperty(this, "nextOctet", {
		get: () => nextOctet,
		set: (v) => nextOctet = v,
		enumerable: false
	});
	this.depth = depth;

	/**
	 * @property this.buffer
	 * @private 
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
	this.buffer.nextIndex = 0;
	this.buffer.version = 0;

	Object.defineProperty(this, "cursor", {
		get: () => cursor,
		set: (c) => cursor = c
	});

	return this;
}

Voctopus.prototype.getVoxel = function(v) {
	let d = 0;
	this.cursor = 0; // reset cursor to root node 
	// walk the tree til we reach the end of a branch, and return a view
	let vox = new Voctant(this.buffer, this.cursor);
	while(vox.pointer !== 0) {
		// move to the correct octant
		this.cursor += this.octantOffset(v, d);
		// find the child pointer
		vox = new Voctant(this.buffer, this.cursor);
		this.cursor = vox.pointer;
		d++;
	}
	return vox;
}

Voctopus.prototype.setVoxel = function(v, p) {
	let d = 0, o = 0;
	this.cursor = 0; // reset cursor to root node 
	// walk the tree til we reach the end of a branch, and return a view
	while(d < this.depth) {
		let vox = new Voctant(this.buffer, this.cursor, true);
		// move to the correct octant
		o = this.octantOffset(v, d);
		this.cursor += this.octantOffset(v, d);
		// find the child pointer
		if(this.cursor === 0 && d < this.depth) {
			this.cursor = this.getEmptyOctet();
			vox.pointer = this.cursor;
		}
		d++;
	}
	var vox = new Voctant(this.buffer, this.cursor+this.octantOffset(v, d), true);
	vox.setProps(p);
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
	if(this.nextOctet > this.buffer.length) this.expand();
	var ret = this.nextOctet;
	this.nextOctet = this.nextOctet + this.octetSize;
	return ret;
}

Voctopus.prototype.prune = function() {
}

/**
 * Expands the internal storage buffer. This is a VERY EXPENSIVE OPERATION and
 * should be avoided until neccessary. Could result in out of memory errors.
 * TODO: examine the possibility of using a DataView to transfer the data as one
 * big blob
 *
 * @param this.depth {int} max depth of tree
 */
Voctopus.prototype.expand = function() {
	var sumx8 = sump8(this.depth)*8;
	// derive last sparse factor from current this.buffer length, then decrement it
	var s = ~~(sumx8/this.buffer.byteLength)-1;
	// don't divide by zero, that would be bad
	if(s < 1) throw new Error("tried to expand a voctopus, but it's already at maximum size - this means something has gone horribly wrong!");
	var tmp = new ArrayBuffer(sumx8/s);
	// we can't rely on ArrayBuffer.transfer yet so let's do this the crappy way
	for(var i = 0; i < this.buffer.byteLength; i++) tmp[i] = this.buffer[i];
	tmp.nextIndex = parseInt(this.buffer.nextIndex);
	tmp.version = this.buffer.version+1;
	this.buffer = tmp;
	//this.cursor = voctopusCursorFactory(this.buffer);
	return this;
}

/**
 * Initializes the values of an entire octet to 0.
 * @param o {int} byteOffset for start of octet
 *
 */
Voctopus.prototype.initializeOctet = function(o) {
	var i = 0;
	var s = this.octetSize;
	var v = new DataView(this.buffer, o);
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
				 );
}

/**
 * Support commonjs modules for Nodejs/backend
 */
if(typeof(module) !== "undefined") {
	module.exports.Voctant = Voctant;
	module.exports.Voctopus = Voctopus;
}
