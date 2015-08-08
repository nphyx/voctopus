"use strict";
require("should");
var Voctopus = require("../src/voctopus").Voctopus;
var Voctant = require("../src/voctopus").Voctant;

describe("voctant", function() {
	var buf = new ArrayBuffer(64); // use a small buffer for testing
	it("should support all its interfaces", function() {
		var vt = new Voctant(buf, 0);
		vt.hasOwnProperty("color").should.be.true();
		vt.hasOwnProperty("material").should.be.true();
		vt.hasOwnProperty("pointer").should.be.true();
		vt.hasOwnProperty("sum").should.be.true();
		(typeof(vt.getUint8)).should.equal("function");
		(typeof(vt.setUint8)).should.equal("function");
		// if it supports those it's probably supporting all the DV interfaces
	});
	it("should properly set and get colors", function() {
		var vt = new Voctant(buf, 0);
		vt.color = [255,128,64];
		vt.color.should.eql(new Uint8Array([255,128,64]));
		vt.r.should.equal(255);
		vt.g.should.equal(128);
		vt.b.should.equal(64);
		// what if we try another view
		var vt2 = new Voctant(buf, 0);
		vt2.color.should.eql(new Uint8Array([255,128,64]));
	});
	it("should properly set and get materials", function() {
		var vt = new Voctant(buf, 0);
		vt.material = 13;
		vt.material.should.equal(13);
	});
	it("should properly set and get child pointers", function() {
		var vt = new Voctant(buf, 0);
		vt.pointer = 1234567890;
		vt.pointer.should.equal(1234567890);
	});
	it("should properly find a sum", function() {
		var vt = new Voctant(buf, 0);
		vt.sum.should.equal(255+128+64+13);
	});

});

describe("voctopus", function() {
	var d = 5;
	var voc = new Voctopus(d);
	function isUndef(val) {
		return (typeof(val) === "undefined");
	}
	it("should expose expected interfaces", function() {
		(typeof(voc.prune)).should.equal("function");
		(typeof(voc.voctantId)).should.equal("function");
		(typeof(voc.voctantKey)).should.equal("function");
		(typeof(voc.getValue)).should.equal("function");
		(typeof(voc.depthOf)).should.equal("function");
		(typeof(voc.vecOf)).should.equal("function");
		(typeof(voc.parentOfKey)).should.equal("function");
		(typeof(voc.allocate)).should.equal("function");
		(typeof(voc.deallocate)).should.equal("function");
		(typeof(voc.voctants)).should.equal("object");
	});
	it("should always return 0 at depth 0 for voctantId", function() {
		voc.voctantId([ 0, 0, 0], 0).should.equal(0);
		voc.voctantId([31, 0, 0], 0).should.equal(0);
		voc.voctantId([ 0,31, 0], 0).should.equal(0);
		voc.voctantId([31,31, 0], 0).should.equal(0);
		voc.voctantId([ 0, 0,31], 0).should.equal(0);
		voc.voctantId([31, 0,31], 0).should.equal(0);
		voc.voctantId([ 0,31,31], 0).should.equal(0);
		voc.voctantId([31,31,31], 0).should.equal(0);
	});
	it("should yield expected octet identities (range 0-7) for a position vector", function() {
		var i;
		// These should have the same identity at any depth
		for(i = 1; i < d; i++) {
			voc.voctantId([ 0, 0, 0], i).should.equal(0);
			voc.voctantId([31, 0, 0], i).should.equal(1);
			voc.voctantId([ 0,31, 0], i).should.equal(2);
			voc.voctantId([31,31, 0], i).should.equal(3);
			voc.voctantId([ 0, 0,31], i).should.equal(4);
			voc.voctantId([31, 0,31], i).should.equal(5);
			voc.voctantId([ 0,31,31], i).should.equal(6);
			voc.voctantId([31,31,31], i).should.equal(7);
		}
		// for d == 2, coordinates corresponding to octet 8 at d == 1)
		for(i = 2; i < d; i++) {
			voc.voctantId([ 0, 0, 0], 2).should.equal(0);
			voc.voctantId([15, 0, 0], 2).should.equal(1);
			voc.voctantId([ 0,15, 0], 2).should.equal(2);
			voc.voctantId([15,15, 0], 2).should.equal(3);
			voc.voctantId([ 0, 0,15], 2).should.equal(4);
			voc.voctantId([15, 0,15], 2).should.equal(5);
			voc.voctantId([ 0,15,15], 2).should.equal(6);
			voc.voctantId([15,15,15], 2).should.equal(7);
		}
	});
	it("should yield expected octet keys with voctantKey", function () {
		// always 0 at depth 0 - everything is within the root (id == 0)
	 	voc.voctantKey([5,5,5], 0).should.equal(0);
		voc.voctantKey([5,5,5], 0).should.equal(0);
		voc.voctantKey([5,5,5], 0).should.equal(0);
		voc.voctantKey([5,5,5], 0).should.equal(0);

		// at depth 1, should get 1-8 for the following coordinates
		// corresponding to the first offset:
		voc.voctantKey([ 0, 0, 0], 1).should.equal(1);
		voc.voctantKey([31, 0, 0], 1).should.equal(2);
		voc.voctantKey([ 0,31, 0], 1).should.equal(3);
		voc.voctantKey([31,31, 0], 1).should.equal(4);
		voc.voctantKey([ 0, 0,31], 1).should.equal(5);
		voc.voctantKey([31, 0,31], 1).should.equal(6);
		voc.voctantKey([ 0,31,31], 1).should.equal(7);
		voc.voctantKey([31,31,31], 1).should.equal(8);

		// at depth 2, should get for the following coordinates
		voc.voctantKey([ 0, 0, 0], 2).should.equal(9);
		voc.voctantKey([ 8, 0, 0], 2).should.equal(10);
		voc.voctantKey([ 0, 8, 0], 2).should.equal(11);
		voc.voctantKey([ 8, 8, 0], 2).should.equal(12);
		voc.voctantKey([ 0, 0, 8], 2).should.equal(13);
		voc.voctantKey([ 8, 0, 8], 2).should.equal(14);
		voc.voctantKey([ 0, 8, 8], 2).should.equal(15);
		voc.voctantKey([ 8, 8, 8], 2).should.equal(16);
		voc.voctantKey([16, 0, 0], 2).should.equal(17);
		voc.voctantKey([ 0,16, 0], 2).should.equal(25);
		voc.voctantKey([16,16, 0], 2).should.equal(33);
		voc.voctantKey([ 0, 0,16], 2).should.equal(41);
		voc.voctantKey([16, 0,16], 2).should.equal(49);
		voc.voctantKey([ 0,16,16], 2).should.equal(57);
		voc.voctantKey([16,16,16], 2).should.equal(65);

		// At depth 3, we should get:
		voc.voctantKey([ 0, 0, 0], 3).should.equal(73);
		voc.voctantKey([ 4, 0, 0], 3).should.equal(74);
		voc.voctantKey([ 0, 4, 0], 3).should.equal(75);
		voc.voctantKey([ 8, 0, 0], 3).should.equal(137);
		voc.voctantKey([ 8, 4, 0], 3).should.equal(139);
		voc.voctantKey([ 0, 8, 0], 3).should.equal(201);
		voc.voctantKey([ 4, 8, 0], 3).should.equal(202);

		// At depth 4 we should get:
		voc.voctantKey([ 0, 0, 0], 4).should.equal(585);
		voc.voctantKey([ 2, 0, 0], 4).should.equal(586);

		// At depth 5 we should get:
		voc.voctantKey([ 0, 0, 0], 5).should.equal(4681);
		voc.voctantKey([ 1, 0, 0], 5).should.equal(4682);
		voc.voctantKey([ 0, 1, 0], 5).should.equal(4683);
		voc.voctantKey([ 1, 1, 0], 5).should.equal(4684);
		voc.voctantKey([ 0, 0, 1], 5).should.equal(4685);
		voc.voctantKey([ 1, 0, 1], 5).should.equal(4686);
		voc.voctantKey([ 0, 1, 1], 5).should.equal(4687);
		voc.voctantKey([ 1, 1, 1], 5).should.equal(4688);
		
		// pretty sure if all those are coming up correct we probably have the right
		// algorithm! It gets to deep to reason out on paper beyond this
	});
	it("should find the tree depth of a key with depthOf", function() {
		// first offsets of each depth
		voc.depthOf(0).should.equal(0);
		voc.depthOf(1).should.equal(1);
		voc.depthOf(9).should.equal(2);
		voc.depthOf(73).should.equal(3);
		voc.depthOf(585).should.equal(4);
		voc.depthOf(4681).should.equal(5);
		// sample other keys
		voc.depthOf(6).should.equal(1);
		voc.depthOf(10).should.equal(2);
		voc.depthOf(282).should.equal(3);
		voc.depthOf(584).should.equal(3);
		voc.depthOf(7000).should.equal(5);
	});
	it("should find a vector for an octet identity with vecOf", function() {
		voc.vecOf(0).should.eql([0,0,0]);
		voc.vecOf(1).should.eql([1,0,0]);
		voc.vecOf(2).should.eql([0,1,0]);
		voc.vecOf(3).should.eql([1,1,0]);
		voc.vecOf(4).should.eql([0,0,1]);
		voc.vecOf(5).should.eql([1,0,1]);
		voc.vecOf(6).should.eql([0,1,1]);
		voc.vecOf(7).should.eql([1,1,1]);
	});
	it("should find the parent octet key of an octet key with parentOfKey", function() {
		voc.parentOfKey(1).should.equal(0);
		voc.parentOfKey(3).should.equal(0);
		voc.parentOfKey(8).should.equal(0);
		voc.parentOfKey(9).should.equal(1);
		voc.parentOfKey(13).should.equal(1);
		voc.parentOfKey(17).should.equal(2);
		voc.parentOfKey(48).should.equal(5);
		voc.parentOfKey(585).should.equal(73);
		voc.parentOfKey(593).should.equal(74);
		voc.parentOfKey(4681).should.equal(585);
	});
	it("should generate a buffer of the correct length", function() {
		var voc = new Voctopus(3); // Voctopus of depth 3 should be 73 octants long, or 146 bytes 
		voc.buffer.byteLength.should.equal(146);
		var voc = new Voctopus(2); // Minimum length of a buffer is 146 even when not required (trees of depth < 3 aren't very useful in the real world, and there's no point in making a buffer much smaller than that)
		voc.buffer.byteLength.should.equal(146);
		var voc = new Voctopus(8); // A fully dense octree of depth 8 would be 4793490 bytes, but it should cap out at a quarter of that
		voc.buffer.byteLength.should.equal(599186);
	});
	it("should allocate and return a voctant when allocate is called for the first time", function() {
		var vox = voc.allocate([0,0,0]);
		(vox instanceof DataView).should.be.true();
		vox.color.should.eql(new Uint8Array([0,0,0]));
		vox.material.should.equal(0);
		vox.pointer.should.equal(0);
		vox.sum.should.equal(0);
	});
	it("should create parent octets during initialization of a voctant", function() {
		// voc was empty before we looked up [0,0,0], which means it should have one octet per each depth plus one for the zeroth offset (8*5+1) = 41
		Object.keys(voc.voctants).should.have.length(41);
		// let's look up a voxel in an adjacent octet, which should add 8 new elements
		voc.allocate([0,0,2]);
		Object.keys(voc.voctants).should.have.length(49);
	});
	it("should set child keys on parents when initializing a voctant", function() {
		var voc = new Voctopus(3);
		var vox = voc.allocate([0,0,0]);
	});
	it("should expand the buffer when neccessary", function() {
		var x, y, z;
		var voc = new Voctopus(4);
		voc.buffer.byteLength.should.equal(146);
		// let's fill in the entire tree
		for(x = 0; x < 15; x++) {
			for(y = 0; y < 15; y++) {
				for(z = 0; z < 15; z++) {
					voc.allocate([x,y,z]);
				}
			}
		}
		voc.buffer.byteLength.should.equal(1170);
	});
	it("should update a voctant's values correctly", function() {
		var byteOffset;
		var vox = voc.allocate([0,0,0]);
		vox.material = 3;
		vox.color = [128,128,64];
		vox.pointer = 124; // hah, that would be a terrible thing to do!
		byteOffset = vox.byteOffset;
		// grab it again
		vox = voc.allocate([0,0,0]);
		vox.material.should.equal(3);
		vox.color.should.eql(new Uint8Array([128,128,64]));
		vox.r.should.equal(128);
		vox.g.should.equal(128);
		vox.b.should.equal(64);
		vox.pointer.should.equal(124);
		vox.sum.should.equal(128+128+64+3);
		vox.byteOffset.should.equal(byteOffset);
		// okay but what about other voxels
		vox = voc.allocate([28,15,82]);
		vox.material = 3;
		vox = voc.allocate([28,15,82]);
		vox.material.should.equal(3);
	});
	it("should correctly initialize an octet", function() {
		var vt, vox;
		// lets reinitialize the first octet and see what happens
		voc.initializeOctet(0);
		vt = voc.getValue([0,0,0]);
		vt.color.should.eql(new Uint8Array([0,0,0]));
		vt.material.should.equal(0);
		vt.pointer.should.equal(0);
		// now check using allocate, which should be the same
		vox = voc.allocate([0,0,0]);
		vox.material.should.equal(0);
		// check that it wiped the entire octet
		vox = voc.allocate([1,0,0]);
		vox.material.should.equal(0);
		vox = voc.allocate([0,1,0]);
		vox.material.should.equal(0);
		vox = voc.allocate([1,1,0]);
		vox.material.should.equal(0);
		vox = voc.allocate([0,0,1]);
		vox.material.should.equal(0);
		vox = voc.allocate([1,0,1]);
		vox.material.should.equal(0);
		vox = voc.allocate([1,1,1]);
		vox.material.should.equal(0);
	});
	/*
	it("should update the tree after setting a voxel", function() {
		var i;
		var voc = new Voctopus(2); // let's make a 8x8x8 tree
		voc.setVoxels([
			[[0,0,0], 1],
			[[1,0,0], 1],
			[[0,1,0], 1],
			[[1,1,0], 1],
			[[0,0,1], 1],
			[[1,0,1], 1],
			[[0,1,1], 1],
			[[1,1,1], 1]
		]);
		// should have pruned the tree
		for(i = 0; i < 8; i++) isUndef(voc._elements[9+i]).should.be.true();

		// parents should be set
		isUndef(voc._elements[1]).should.be.false();
		voc._elements[1].should.equal(1);
	});
	*/
	/*
	it("should retrieve a voxel using allocate after it has been set", function() {
		// check a bigger volume just for shits and giggles
		voc = new Voctopus(3);
		voc.setVoxel([0,8,23], 3);
		voc.allocate([0,8,23]).should.equal(3);
	});
	*/
	/*
	it("should retrieve the correct value for a voxel in a branch that has been pruned", function() {
		voc = new Voctopus(3);
		voc.setVoxels([
			[[0,0,0], 1],
			[[1,0,0], 1],
			[[0,1,0], 1],
			[[1,1,0], 1],
			[[0,0,1], 1],
			[[1,0,1], 1],
			[[0,1,1], 1],
			[[1,1,1], 1]
		]);
		voc.allocate([0,0,0]).should.equal(1);
		voc.allocate([1,0,0]).should.equal(1);
		voc.allocate([0,1,0]).should.equal(1);
		voc.allocate([1,1,0]).should.equal(1);
		voc.allocate([0,0,1]).should.equal(1);
		voc.allocate([1,0,1]).should.equal(1);
		voc.allocate([0,1,1]).should.equal(1);
		voc.allocate([1,1,1]).should.equal(1);
	});
	*/
});
