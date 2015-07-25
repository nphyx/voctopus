"use strict";
require("should");
var Voctopus = require("../src/voctopus");

describe("voctopus", function() {
	var d = 5;
	var voc = new Voctopus(d);
	function isUndef(val) {
		return (typeof(val) === "undefined");
	}
	it("should always return 0 at depth 0 for octId", function() {
		voc.octId([ 0, 0, 0], 0).should.equal(0);
		voc.octId([31, 0, 0], 0).should.equal(0);
		voc.octId([ 0,31, 0], 0).should.equal(0);
		voc.octId([31,31, 0], 0).should.equal(0);
		voc.octId([ 0, 0,31], 0).should.equal(0);
		voc.octId([31, 0,31], 0).should.equal(0);
		voc.octId([ 0,31,31], 0).should.equal(0);
		voc.octId([31,31,31], 0).should.equal(0);
	});
	it("should yield expected octet identities (range 0-7) for a coord", function() {
		var i;
		// These should have the same identity at any depth
		for(i = 1; i < d; i++) {
			voc.octId([ 0, 0, 0], i).should.equal(0);
			voc.octId([31, 0, 0], i).should.equal(1);
			voc.octId([ 0,31, 0], i).should.equal(2);
			voc.octId([31,31, 0], i).should.equal(3);
			voc.octId([ 0, 0,31], i).should.equal(4);
			voc.octId([31, 0,31], i).should.equal(5);
			voc.octId([ 0,31,31], i).should.equal(6);
			voc.octId([31,31,31], i).should.equal(7);
		}
		// for d == 2, coordinates corresponding to octet 8 at d == 1)
		for(i = 2; i < d; i++) {
			voc.octId([ 0, 0, 0], 2).should.equal(0);
			voc.octId([15, 0, 0], 2).should.equal(1);
			voc.octId([ 0,15, 0], 2).should.equal(2);
			voc.octId([15,15, 0], 2).should.equal(3);
			voc.octId([ 0, 0,15], 2).should.equal(4);
			voc.octId([15, 0,15], 2).should.equal(5);
			voc.octId([ 0,15,15], 2).should.equal(6);
			voc.octId([15,15,15], 2).should.equal(7);
		}
	});
	it("should yield expected octet keys with octKey", function () {
		// always 0 at depth 0 - everything is within the root (id == 0)
	 	voc.octKey([5,5,5], 0).should.equal(0);
		voc.octKey([5,5,5], 0).should.equal(0);
		voc.octKey([5,5,5], 0).should.equal(0);
		voc.octKey([5,5,5], 0).should.equal(0);

		// at depth 1, should get 1-8 for the following coordinates
		// corresponding to the first offset:
		voc.octKey([ 0, 0, 0], 1).should.equal(1);
		voc.octKey([31, 0, 0], 1).should.equal(2);
		voc.octKey([ 0,31, 0], 1).should.equal(3);
		voc.octKey([31,31, 0], 1).should.equal(4);
		voc.octKey([ 0, 0,31], 1).should.equal(5);
		voc.octKey([31, 0,31], 1).should.equal(6);
		voc.octKey([ 0,31,31], 1).should.equal(7);
		voc.octKey([31,31,31], 1).should.equal(8);

		// at depth 2, should get for the following coordinates
		voc.octKey([ 0, 0, 0], 2).should.equal(9);
		voc.octKey([ 8, 0, 0], 2).should.equal(10);
		voc.octKey([ 0, 8, 0], 2).should.equal(11);
		voc.octKey([ 8, 8, 0], 2).should.equal(12);
		voc.octKey([ 0, 0, 8], 2).should.equal(13);
		voc.octKey([ 8, 0, 8], 2).should.equal(14);
		voc.octKey([ 0, 8, 8], 2).should.equal(15);
		voc.octKey([ 8, 8, 8], 2).should.equal(16);
		voc.octKey([16, 0, 0], 2).should.equal(17);
		voc.octKey([ 0,16, 0], 2).should.equal(25);
		voc.octKey([16,16, 0], 2).should.equal(33);
		voc.octKey([ 0, 0,16], 2).should.equal(41);
		voc.octKey([16, 0,16], 2).should.equal(49);
		voc.octKey([ 0,16,16], 2).should.equal(57);
		voc.octKey([16,16,16], 2).should.equal(65);

		// At depth 3, we should get:
		voc.octKey([ 0, 0, 0], 3).should.equal(73);
		voc.octKey([ 4, 0, 0], 3).should.equal(74);
		voc.octKey([ 0, 4, 0], 3).should.equal(75);
		voc.octKey([ 8, 0, 0], 3).should.equal(137);
		voc.octKey([ 8, 4, 0], 3).should.equal(139);
		voc.octKey([ 0, 8, 0], 3).should.equal(201);
		voc.octKey([ 4, 8, 0], 3).should.equal(202);

		// At depth 4 we should get:
		voc.octKey([ 0, 0, 0], 4).should.equal(585);
		voc.octKey([ 2, 0, 0], 4).should.equal(586);

		// At depth 5 we should get:
		voc.octKey([ 0, 0, 0], 5).should.equal(4681);
		voc.octKey([ 1, 0, 0], 5).should.equal(4682);
		
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
	it("should set a voxel at the right key with setVoxel", function() {
		var voc = new Voctopus(2); // let's make a 8x8x8 tree
		voc.setVoxel([0,0,0], 1);
		voc._elements[9].should.equal(1);
		// voctopus trees are basic Arrays, so they should be heterogeneous
		voc.setVoxel([1,0,0], "hello");
		voc._elements[10].should.equal("hello");
		voc.setVoxel([2,0,0], "goodbye");
		voc._elements[17].should.equal("goodbye");
		voc.setVoxel([7,7,7], 42);
		voc._elements[72].should.equal(42);
	});
	it("should set multiple voxels at once using setVoxels", function() {
		var voc = new Voctopus(2); // let's make a 8x8x8 tree
		voc.setVoxels([
			[[0,0,0], 1],
			[[1,0,0], "hello"],
			[[2,0,0], "goodbye"],
			[[7,7,7], 42]
		]);
		voc._elements[9].should.equal(1);
		voc._elements[10].should.equal("hello");
		voc._elements[17].should.equal("goodbye");
		voc._elements[72].should.equal(42);
	});
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
	it("should retrieve a voxel using getVoxel after it has been set", function() {
		// check a bigger volume just for shits and giggles
		voc = new Voctopus(3);
		voc.setVoxel([0,8,23], 3);
		voc.getVoxel([0,8,23]).should.equal(3);
	});
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
		voc.getVoxel([0,0,0]).should.equal(1);
		voc.getVoxel([1,0,0]).should.equal(1);
		voc.getVoxel([0,1,0]).should.equal(1);
		voc.getVoxel([1,1,0]).should.equal(1);
		voc.getVoxel([0,0,1]).should.equal(1);
		voc.getVoxel([1,0,1]).should.equal(1);
		voc.getVoxel([0,1,1]).should.equal(1);
		voc.getVoxel([1,1,1]).should.equal(1);
	});
});
