"use strict";
/* jshint unused:false */

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
 * Checks a vector is valid
 */
function checkVec(v) {
	if(isUndef(v) || isUndef(v.length) || v.length !== 3) throw new TypeError(v + " is not a vector");
}

/**
 * DataView for a Voctant.
 */
function Voctant(buffer, offset) {
	var dv = new DataView(buffer, offset, 16);
	Object.defineProperty(dv, "color", {
		get:function() {
			var rgb = new Uint8Array(3);
			rgb[0] = this.getUint8(0);
			rgb[1] = this.getUint8(1);
			rgb[2] = this.getUint8(2);
			return rgb;
		},
		set:function(rgb) {
			this.setInt8(0, rgb[0]);
			this.setInt8(1, rgb[1]);
			this.setInt8(2, rgb[2]);
			return this;
		}
	});
	Object.defineProperty(dv, "r", {
		get:function() {return this.getUint8(0);},
		set:function(r) {this.setInt8(0, r); return this;}
	});
	Object.defineProperty(dv, "g", {
		get:function() {return this.getUint8(1);},
		set:function(g) {this.setInt8(1, g); return this;}
	});
	Object.defineProperty(dv, "b", {
		get:function() {return this.getUint8(2);},
		set:function(b) {this.setInt8(2, b); return this;}
	});
	Object.defineProperty(dv, "material", {
		get:function() {return this.getUint8(3);},
		set:function(i) {this.setInt8(3, i); return this;}
	});
	Object.defineProperty(dv, "pointer", {
		get:function() {return this.getUint32(4);},
		set:function(p) {this.setUint32(4, p); return this;}
	});
	Object.defineProperty(dv, "sum", {
		get:function() {var color = this.color; return color[0]+color[1]+color[2]+this.material;}
	});
	return dv;
}

/**
 * Using a factory here because inheriting from a DataView is a pain in the ass.
 */
function voctopusCursorFactory(buffer) {
	var dv = new DataView(buffer, 0, buffer.byteLength);
	/**
	 * @property position {int internal position variable. Transparently multiplied an divided by 16 in accessor methods
	 */
	var position = 0;
	Object.defineProperty(dv, "position", {
		set:function(p) {position = p << 4;},
		get:function() {return position >>> 4;},
		enumerable:false
	});
	Object.defineProperty(dv, "color", {
		get:function() {
			var rgb = new Uint8Array(3);
			rgb[0] = this.getUint8(position+0);
			rgb[1] = this.getUint8(position+1);
			rgb[2] = this.getUint8(position+2);
			return rgb;
		},
		set:function(rgb) {
			this.setInt8(position+0, rgb[0]);
			this.setInt8(position+1, rgb[1]);
			this.setInt8(position+2, rgb[2]);
			return this;
		}
	});
	Object.defineProperty(dv, "r", {
		get:function() {return this.getUint8(position+0);},
		set:function(r) {this.setInt8(position+0, r); return this;}
	});
	Object.defineProperty(dv, "g", {
		get:function() {return this.getUint8(position+1);},
		set:function(g) {this.setInt8(position+1, g); return this;}
	});
	Object.defineProperty(dv, "b", {
		get:function() {return this.getUint8(position+2);},
		set:function(b) {this.setInt8(position+2, b); return this;}
	});
	Object.defineProperty(dv, "material", {
		get:function() {return this.getUint8(position+3);},
		set:function(i) {this.setInt8(position+3, i); return this;}
	});
	Object.defineProperty(dv, "pointer", {
		get:function() {return this.getUint32(position+4);},
		set:function(p) {this.setUint32(position+4, p); return this;}
	});
	Object.defineProperty(dv, "sum", {
		get:function() {var color = this.color; return color[0]+color[1]+color[2]+this.material;}
	});
	dv.next = function() {
		this.position += 1;
		return this;
	}
	return dv;
}

/**
 * Quick definition of terms:
 * 1 octant = one voxel at a given depth
 * 1 octant = 8 octants, or one tree node
 *
 * TODO: Deal with endianness in buffer
 */
function Voctopus(depth) {
	if(depth > 12) throw new Error("Temporary dev limit: depth must be less than 12");

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
	this.buffer = new ArrayBuffer(Math.max(146, sump8(depth)/4));
	this.buffer.nextIndex = 0;
	this.buffer.version = 0;

	/**
	 * @property this.voctants
	 * @private
	 * Data view cache for each octant. Because why garbage collect when we
	 * can waste a tiny bit of memory instead. These are indexed using the
	 * voctopus#voctantKey for quick direct access in JS. Trees can be
	 * traversed either by their coordinate's voctantKey or by walking the
	 * tree using the voctant child pointer.
	 */
	this.voctants = [];

	/**
	 * @property _cleanupQueue
	 * @private 
	 *
	 * A queue of octants that need cleanup after a mutating operation. This
	 * may consist of removing or regenerating suboctants depending on whether
	 * the child octants are uniform.
	 */
	this.updateQueue = [];

	/**
	 * Stack of octet addresses that have been deallocated and are available for
	 * storage. Used during allocation in FIFO order.
	 */
	this.freed = [];

	/**
	 * @property this.depth
	 * @private
	 * The maximum depth of the tree, in other words the depth at which a single
	 * node is 1 unit wide. Traversal stops at this depth. Also determines the
	 * maximum size of a fully dense Voctopus.
	 */
	this.depth = depth; 

	/**
	 * DataView spanning the entire buffer, for quick initialization of octets.
	 */
	//this.dv = new DataView(this.buffer, 0, this.buffer.length);
	this.cursor = voctopusCursorFactory(this.buffer);
}

/**
 * Used internally to update a tree after updating a voxel. A better way to do this
 * would be to pass parent octants directly, then just sweep their children. Will
 * reimplement later.
 * Curried to pruneTree() in the Voctopus constructor.
 */
Voctopus.prototype.prune = function() {
	var i, n, d, queueKey, curKey, parentKey, octant, modeMap, modeMax, maxVal, modeLabel;
	while(this.updateQueue.length) {
		queueKey = this.updateQueue.pop(); // vec coord of voxel to update
		if(isUndef(queueKey)) continue; // sometimes we just undef them because it's cheaper than splicing
		// walk up the tree from coord, updating parents
		for(d = this.depth; d > 0; d--) {
			/* jshint validthis:true */
			// find the curKey of the parent octant
			parentKey = this.parentOfKey(queueKey);
			// each octant is contiguous so we can use a shortcut to sweep it
			// we just need the curKey of the 0th element of the octant, then sweep curKey+(0-7)
			curKey = queueKey-((queueKey-sump8(d))%8);
			// grab the octant
			octant = this.voctants.slice(curKey, curKey+n);
			modeMap = {};
			modeMax = 0;
			maxVal = undefined;
			// figure out the mathematical mode
			for(n = 0; n < 8; n++) {
				modeLabel = isUndef(this.voctants[curKey+n])?"undefined":this.voctants[curKey+n].toString();
				modeMap[modeLabel] = isUndef(modeMap[modeLabel])?1:modeMap[modeLabel]+1;
				if(modeMap[modeLabel] > modeMax) {
					modeMax = modeMap[modeLabel];
					maxVal = this.voctants[curKey+n].sum;
				}
			}
			// if the parent value didn't change skip update, otherwise set new val
			// and mark it for updating
			if(d > 0 && this.voctants[parentKey] !== maxVal) {
				this.voctants[parentKey] = maxVal;
				// only do this once per octant, no need to check other children
				if(parentKey > 0 && this.updateQueue.indexOf(parentKey) === -1) this.updateQueue.push(parentKey);
			}
			// now prune the children if the octant is uniform
			if(modeMax == 8) {
				for(n = 0; n < 8; n++) {
					this.voctants[curKey+n] = undefined;
					// dequeue any children we pruned since they can't be processed
					queueKey = this.updateQueue.indexOf(curKey+n);
					if(queueKey !== -1) this.updateQueue[queueKey] = undefined; 
				}
			}
		} // end depth loop
	} // end queue loop 	
}

/**
 * Allocates and initializes a new voctet and its individual voctants.
 */
Voctopus.prototype.allocate = function(v, d) {
	var i, id, key, vox, newIndex, keyOfFirst, oldLength;
	if(isUndef(d)) d = this.depth;
	/*
	key = this.voctantKey(v, d);
	vox = this.voctants[key];
	*/
	// if the voctant is already allocated just return it
	// this lets us use allocate naively
	//if(!isUndef(vox)) return vox;
	newIndex = 0;
	if(this.freed.length) newIndex = this.freed.shift(); // take from top of stack
	else newIndex = this.buffer.nextIndex;
	oldLength = this.buffer.byteLength;
	while(newIndex+129 > oldLength) { // we need to expand the whole array
		this.expand();
		oldLength = this.buffer.byteLength;
	}
	// initialize a new voctet
	this.initializeOctet(newIndex);

	keyOfFirst = key - this.voctantId(v, d);
	// now set up each of the 8 new octants
	for(i = 0; i < 8; i++) {
		try {
		if(isUndef(this.voctants[keyOfFirst+i])) this.voctants[keyOfFirst+i] = new Voctant(this.buffer, ((i*2)+newIndex));
		}
		catch(e) {
			console.log("Tried to create a voctet, but caught an error:");
			console.log(e);
			console.log("buffer length of "+this.buffer.byteLength+" next index "+this.buffer.nextIndex+" at offset "+((i*2)+newIndex)+" with key "+(keyOfFirst+i));
		}
	}
	// now walk up the tree recursively, allocating any missing parents
	// and updating pointers
	if(d > 0) {
		var parentVoc = this.allocate(v, d-1);
		parentVoc.pointer = newIndex;
	}
	this.buffer.nextIndex = newIndex+128;
	vox = this.voctants[key];
	// this may overflow but it'll be caught during next allocation
	return vox;
}

/**
 * Expands the internal storage buffer. This is a VERY EXPENSIVE OPERATION and
 * should be avoided until neccessary. Could result in out of memory errors.
 *
 * @param this.depth {int} max depth of tree
 */
Voctopus.prototype.expand = function() {
	var sumx2 = sump8(this.depth)*2;
	// derive last sparse factor from current this.buffer length, then decrement it
	var s = ~~(sumx2/this.buffer.byteLength)-1;
	// don't divide by zero, that would be bad
	if(s < 1) throw new Error("tried to expand a voctopus, but it's already at maximum size - this means something has gone horribly wrong!");
	var tmp = new ArrayBuffer(sumx2/s);
	// we can't rely on ArrayBuffer.transfer yet so let's do this the crappy way
	for(var i = 0; i < this.buffer.byteLength; i++) tmp[i] = this.buffer[i];
	tmp.nextIndex = parseInt(this.buffer.nextIndex);
	tmp.version = this.buffer.version+1;
	this.buffer = tmp;
	this.cursor = voctopusCursorFactory(this.buffer);
	return this;
}

Voctopus.prototype.deallocate = function(d, v) {
	/* jshint validthis:true */
	var id = this.octKey(v, d);
	return this.voctants[id];
}

/**
 * Traverses the tree in a depth-first search until it reaches an empty
 * octant at d+1, indicating that voctant is uniform with the voctant value at d,
 * and returns that voctant. Can be used to get values, but should not be used
 * to modify them (since you don't know what depth you're operating at).
 *
 * @param v {vector} voxel coordinate
 * @param d {int} starting depth
 */
Voctopus.prototype.getValue = function(v, d) {
	var val;
	if(isUndef(d)) d = 0;
	// walk down the tree until we hit an undefined value
	if(d < this.depth) {
		val = this.getValue(v, d+1);
		if(!isUndef(val)) return val; 
	}
	return this.voctants[this.voctantKey(v, d)]; 
}

/**
 * Traverses the octree to position vector v and depth d.
 * @param v {vector} vector
 * @param d {int} depth to traverse to (should be between 0 and tree depth)
 * @param p {int} starting cursor position (should be the first offset of an octet)
 */
Voctopus.prototype.traverse = function(v, d, p) {
	var val, newVal;
	if(isUndef(p)) p =  0;
	// sanity checks
	if(isUndef(d)) d = this.depth;
	this.cursor.position = p;
	if(this.cursor.pointer === 0) return this.cursor;
	p = this.cursor.pointer + this.voctantId(v, d);
	console.log(this.cursor.pointer);
	newVal = this.traverse(v, d-1, p);
	return this.cursor;
}

/**
 * Returns the identity (0-7) of the suboctant at depth d, position v
 * @param v global coordinate of voxel 
 * @param d depth to check
 */
Voctopus.prototype.voctantId  = function (v, d) {
	return (((v[2] >>> this.depth-d) & 1) << 2 | 
					((v[1] >>> this.depth-d) & 1) << 1 |
					((v[0] >>> this.depth-d) & 1) 
				 );
}

/**
 * Finds the key of an octant given coordinates and depth.
 * @param v {vector} position vector of the voxel at d = maxDepth
 * @param d {int} tree depth (defaults to maxDepth)
 */
Voctopus.prototype.voctantKey = function(v, d) {
	var bo, o;
	if(isUndef(d)) d = this.depth;
	else if(d === 0) return 0; // anything at depth 0 is always 0
	bo = sump8(d);
	o = bo+(Math.pow(8, d-1)*this.voctantId(v, d-1))+this.voctantId(v, d);
	return o;
}

/**
 * Find the depth of a given key in a tree of depth this.depth
 * Probably a faster way to do this
 */
Voctopus.prototype.depthOf = function(key) {
	for(var i = 0; i <= this.depth; i++) if(key >= sump8(i) && key < sump8(i+1)) return i;
}

/**
 * Turns an octant identity into a vector of range [0,0,0]-[1,1,1].
 * Inverse of voctantId().
 */
Voctopus.prototype.vecOf = function(id) {
	var vec = [0,0,0];
	vec[0] = id & 1;
	vec[1] = id >>> 1 & 1;
	vec[2] = id >>> 2 & 1;
	return vec;
}

/**
 * Finds the nearest parent octant key for a child key
 */
Voctopus.prototype.parentOfKey = function(key) {
	var d = this.depthOf(this.depth, key);
	return ~~((key-sump8(d))/8)+sump8(d-1);
}

/**
 * Initializes the values of an entire octet to 0.
 * @param o {int} byteOffset for start of octet
 *
 */
Voctopus.prototype.initializeOctet = function(o) {
	var i = 0;
	var s = 128;
	for(i = 0; i < s; i++) this.cursor.setUint8(o+i, 0);
}

if(typeof(module) !== "undefined") {
	module.exports.Voctant = Voctant;
	module.exports.Voctopus = Voctopus;
	module.exports.voctopusCursorFactory = voctopusCursorFactory;
}
