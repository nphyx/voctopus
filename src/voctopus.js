"use strict";
/* jshint unused:false */

/**
 * Returns length of side at depth d with maxdepth m:
 *
function resOf(m, d) {
	return 2*Math.pow(m-d);
}*/

/**
 * We do lots of undefined checks, let's make it easier to type
 */
function isUndef(val) {
 return typeof(val) === "undefined";
}

/**
 * Functions below are defined here and bound in the Voctopus
 * constructor. This way we get a single function definition
 * while granting access to private properties of Voctopus.
 * Quasi-namespaced to prevent conflicts in scripts that don't
 * use commonjs' require() to load voctopus. Documentation is
 * in the Voctopus object.
 */

/**
 * Index offset for depth d is sum of powers of 8 up to 8^d
 */
function voctopusBaseOffset(d) {
	return ~~((Math.pow(8, d) -1) / 7);
}

/**
 * Checks a vector is valid
 */
function checkVec(v) {
	if(isUndef(v) || isUndef(v.length) || v.length !== 3) throw new TypeError(v + " is not a vector");
}

/**
 * @see Voctopus#octId
 * Curried to Voctopus.octId(v, d).
 */
function voctopusOctId(_md, v, d) {
	return (((v[2] >>> _md-d) & 1) << 2 | 
					((v[1] >>> _md-d) & 1) << 1 |
					((v[0] >>> _md-d) & 1) 
				 );
}

/**
 * @see Voctopus#octKey
 * Curried to Voctopus.octKey(v)
 */
function voctopusOctKey(_md, v) {
	var bo, o, d;
	/* jshint validthis:true */
	if(arguments.length < 3) d = _md;
	else if(arguments[2] === 0) return 0; // anything at d=0 is always zero
	else d = arguments[2];
	bo = voctopusBaseOffset(d);
	o = bo+(Math.pow(8, d-1)*this.octId(v, d-1))+this.octId(v, d);
	return o;
}

/**
 * Find the depth of a given key in a tree of depth _md
 * Probably a faster way to do this
 */
function voctopusDepthOf(_md, key) {
	for(var i = 0; i <= _md; i++) if(key >= voctopusBaseOffset(i) && key < voctopusBaseOffset(i+1)) return i;
}

/**
 * Finds the nearest parent octet key for a child key
 */
function voctopusParentOfKey(_md, key) {
	var d = voctopusDepthOf(_md, key);
	return ~~((key-voctopusBaseOffset(d))/8)+voctopusBaseOffset(d-1);
}

/**
 * Turns an octet identity into a vector of range [0,0,0]-[1,1,1].
 * Inverse of voctopusIdOf().
 */
function voctopusVecOf(id) {
	var vec = [0,0,0];
	vec[0] = id & 1;
	vec[1] = id >>> 1 & 1;
	vec[2] = id >>> 2 & 1;
	return vec;
}

/**
 * Used internally to update a tree after updating a voxel. A better way to do this
 * would be to pass parent octets directly, then just sweep their children. Will
 * reimplement later.
 * Curried to updateTree() in the Voctopus constructor.
 */
function voctopusUpdateTree(_elements, _updateQueue, _md) {
	var i, n, d, queueKey, curKey, parentKey, octet, modeMap, modeMax, maxVal, modeLabel;
	while(_updateQueue.length) {
		queueKey = _updateQueue.pop(); // vec coord of voxel to update
		if(isUndef(queueKey)) continue; // sometimes we just undef them because it's cheaper than splicing
		// walk up the tree from coord, updating parents
		for(d = _md; d > 0; d--) {
			/* jshint validthis:true */
			// find the curKey of the parent octet
			parentKey = this.parentOfKey(queueKey);
			// each octet is contiguous so we can use a shortcut to sweep it
			// we just need the curKey of the 0th element of the octet, then sweep curKey+(0-7)
			curKey = queueKey-((queueKey-voctopusBaseOffset(d))%8);
			// grab the octet
			octet = _elements.slice(curKey, curKey+n);
			modeMap = {};
			modeMax = 0;
			maxVal = undefined;
			// figure out the mathematical mode
			for(n = 0; n < 8; n++) {
				modeLabel = isUndef(_elements[curKey+n])?"undefined":_elements[curKey+n].toString();
				modeMap[modeLabel] = isUndef(modeMap[modeLabel])?1:modeMap[modeLabel]+1;
				if(modeMap[modeLabel] > modeMax) {
					modeMax = modeMap[modeLabel];
					maxVal = _elements[curKey+n];
				}
			}
			// if the parent value didn't change skip update, otherwise set new val
			// and mark it for updating
			if(d > 0 && _elements[parentKey] !== maxVal) {
				_elements[parentKey] = maxVal;
				// only do this once per octet, no need to check other children
				if(parentKey > 0 && _updateQueue.indexOf(parentKey) === -1) _updateQueue.push(parentKey);
			}
			// now prune the children if the octet is uniform
			if(modeMax == 8) {
				for(n = 0; n < 8; n++) {
					_elements[curKey+n] = undefined;
					// dequeue any children we pruned since they can't be processed
					queueKey = _updateQueue.indexOf(curKey+n);
					if(queueKey !== -1) _updateQueue[queueKey] = undefined; 
				}
			}
		} // end depth loop
	} // end queue loop 	
}

/**
 * @see Voctopus#getVoxel
 * Curried to Voctopus.getVoxel(v)
 */
function voctopusGetVoxel(_elements, _md, v) {
	/* jshint validthis:true */
	var val;
	var d = 0;
	if(arguments.length === 4) d = arguments[3];
	// walk down the tree until we hit an undefined value
	if(d < _md) {
		val = this.getVoxel(v, d+1);
		if(!isUndef(val)) return val; 
	}
	return _elements[this.octKey(v, d)]; 
}

/**
 * @see Voctopus#setVoxel
 * @param _updateQueue {array} the current prune queue
 * @param _elements {array} the octree's element array
 * @param _md {int} the max depth of the octree
 * @param _prune {bool} whether to execute a prune op
 * @param v {vector} coordinate vector for the voxel to set
 * @param val {mixed} value to give the vector
 *
 * Curried to Voctopus.setVoxel(v, val). Also used directly by
 * voctopusSetVoxel.
 */
function voctopusSetVoxel(_updateQueue, _elements, _md, _prune, v, val) {
	/* jshint validthis:true */
	var id = this.octKey(v, _md);
	_elements[id] = val;
	_updateQueue.push(id);
  if(_prune) this.updateTree();
	return _elements[id];
}

/**
 * @see Voctopus#setVoxels
 * @param _updateQueue {array} the current prune queue
 * @param _elements {array} the octree's element array
 * @param _md {int} the max depth of the octree
 *
 * Sets multiple voxels at the same time, deferring the prune operation till the
 * updates are complete. Curried to Voctopus.setVoxels(voxelData)
 */
function voctopusSetVoxels(_updateQueue, _elements, _md, voxelData) {
	var i, key;
	/* jshint validthis:true */
	for(i = 0; i < voxelData.length; i++) {
		voctopusSetVoxel.apply(this, [_updateQueue, _elements, _md, false, voxelData[i][0], voxelData[i][1]]);
	}
	this.updateTree();
}

function Voctopus(depth) {
	/**
	 * @property _elements
	 * @private 
	 * Internal array storing the individual data for each octet. We use a
	 * standard JS Array here because they're sparse by nature, so having empty
	 * octets has a very small memory footprint even for very large sets.
	 */
	var _elements = [];
	/**
	 * @property _cleanupQueue
	 * @private 
	 *
	 * A queue of octets that need cleanup after a mutating operation. This
	 * may consist of removing or regenerating suboctets depending on whether
	 * the child octets are uniform.
	 */
	var _updateQueue = [];

	/**
	 * @property _md
	 * @private
	 * The maximum depth of the tree, in other words the depth at which a single
	 * node is 1 unit wide. Traversal stops at this depth. Also determines the
	 * maximum size of a fully dense Voctopus.
	 */
	var _md = depth; 
	/*
	this.updateTree = function() {
		console.log("Updating octree with queue length "+_updateQueue.length);
		var time = new Date().getTime();
		voctopusUpdateTree.call(this, _elements, _updateQueue, _md);
		console.log("Finished tree update, new queue length: "+_updateQueue.length);
		console.log("Update took "+(new Date().getTime() - time)+" milliseconds");
	}
	*/
	this.updateTree = voctopusUpdateTree.bind(this, _elements, _updateQueue, _md);

	/**
	 * The following methods are implemented inside Voctopus for access to private
	 * properties. This is faster than setting them on the prototype.
	 */

	/**
	 * Returns the identity (0-7) of the suboctet at depth d, coord.
	 * @param v {vector} global coordinate of voxel
	 * @param d {int} depth to check
	 *
	 */
	this.octId = voctopusOctId.bind(this, _md);

	/**
	 * Finds the key of an octet given coordinates and depth.
	 * @param v {vector} cordinate vector of the voxel at d = maxDepth
	 * @param d {int} tree depth (defaults to maxDepth)
	 */
	this.octKey = voctopusOctKey.bind(this, _md);

	/**
	 * Traverses the tree in a depth-first search until it reaches an empty
	 * octet at d+1, indicating that octet is uniform with the octet value at d
	 * @param v {vector} voxel coordinate
	 */
	this.getVoxel = voctopusGetVoxel.bind(this, _elements, _md);

	/**
	 * Sets the value of a voxel, then flags the node for pruning. If you're modifying
	 * a bunch of voxels in one operation, use Voctopus#setVoxels instead, so that
	 * pruning is deferred until after completing the updates.
	 */
	this.setVoxel = voctopusSetVoxel.bind(this, _updateQueue, _elements, _md, true);

	this.setVoxels = voctopusSetVoxels.bind(this, _updateQueue, _elements, _md);

	this.depthOf = voctopusDepthOf.bind(this, _md);
	this.vecOf = voctopusVecOf.bind(this);
	this.parentOfKey = voctopusParentOfKey.bind(this, _md);

	/**
	 * Expose the _elements array for testing. 
	 * DO NOT USE THIS IN PRODUCTION IT'S DANGEROUS AND POINTLESS SINCE YOU
	 * CAN'T MAKE CHANGES
	 */
	Object.defineProperty(this, "_elements", { 
		get:function() {return _elements.slice(0)},
		enumerable:false
	});
}

if(typeof(module) !== "undefined") module.exports = Voctopus;
