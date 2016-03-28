"use strict";
require("should");
const {sump8, fullOctreeSize, maxAddressableOctreeDepth, 
       maxOctreeDensityFactor, coordinateSpace, npot,
			 octantIdentity, loop3D
			} = require("../src/voctopus.util.js");

describe("The extended DataView", function() {
	it("should implement Uint24 accessors", function() {
		this.timeout(10000);
		var i, n, buf, dv;
		buf = new ArrayBuffer(3);
		dv = new DataView(buf);
		n = Math.pow(2, 24);
		// this should give us decent coverage without trying every single number
		for(i = 1; i < n; i += 1111) {
			dv.setUint24(0, i);
			dv.getUint24(0).should.equal(i);
		}
	});
});

describe("The extended ArrayBuffer", function() {
	it("should implement transfer", function() {
		ArrayBuffer.prototype.transfer.should.be.type("function");
	});
	it("should transfer data correctly", function() {
		var buf, buf2, dv, dv2, i;
		buf = new ArrayBuffer(127); // 64+32+16+8+7 - should test each part of the copy
		dv = new DataView(buf);
		for(i = 0; i < 127; i++) {
			dv.setUint8(i, i);
		}
		buf2 = new ArrayBuffer(127);
		dv2 = new DataView(buf2);
		buf2.transfer(buf);
		for(i = 0; i < 127; i++) {
			dv2.getUint8(i).should.eql(i);
		}
	});
});

describe("util functions", function() {
	it("should find the next highest power of two with npot", function() {
		// test a number very slightly higher than each i+1, should be the next power of 2
		for(let i = 1, n = Math.pow(2, 31); i < n; i *=2) {
			npot((i+1)*1.0001).should.eql(i*2);
		}
	});
	it("should find the sum of powers of 8 up to 8^n with sump8", function() {
		var i, n, sum;
		// use a naive implementation to check the math
		// stop at 8^24 because precision limits make the result useless at that point
		for(i = 0; i < 24; ++i) {
			sum = 0;
			for(n = 0; n <= i; ++n) {
				sum += Math.pow(8, n);
			}
			sump8(i).should.eql(sum);
		}
	});
	it("should find the maximum (fully dense) size of an octree with fullOctreeSize", function() {
		var i, n, sum;
		for(i = 0; i < 22; ++i) {
			for(n = 1; n <= 64; ++n) {
				sum = sump8(i)*n;
				fullOctreeSize(n, i).should.eql(sump8(i)*n);
			}
		}
	});
	it("should find the coordinate space of an octree with a given depth", function() {
		// this test is kind of spurious because this function is just a quick shortcut
		// for Math.pow, but it's here for coverage
		for(let i = 0; i < 16; i++) {
			coordinateSpace(i).should.eql(Math.pow(2, i));
		}
	});
	it("should find the maximum addressable depth of an octree with maxAddressableOctreeDepth", function() {
		// these are precalculated values based on other tests
		maxAddressableOctreeDepth(4).should.eql(17);
		maxAddressableOctreeDepth(29).should.eql(16);
		maxAddressableOctreeDepth(225).should.eql(15);
	});
	it("should find the maximum density factor for an octree", function() {
		var limit = 512*1024*1024; // 512mb limit
		maxOctreeDensityFactor(4, 9, limit).should.eql(2);
		maxOctreeDensityFactor(4, 10, limit).should.eql(10);
		maxOctreeDensityFactor(4, 13, limit).should.eql(4682);
		maxOctreeDensityFactor(8, 9, limit).should.eql(3);
		maxOctreeDensityFactor(8, 10, limit).should.eql(19);
		maxOctreeDensityFactor(8, 13, limit).should.eql(9363);
	});
	it("should calculate interesting information about an octree", function() {
	});
	it("should loop through all the coordinates in a space with loop3D", function() {
		let x = -1, y = -1, z = -1;
		loop3D(16, {
			x:(pos) => {
				y = 0; z = 0;
				x++;
				pos.should.eql(Uint32Array.of(x,y,z));
				y = -1; z = -1;
			},
			y:(pos) => {
				z = 0;
				y++;
				pos.should.eql(Uint32Array.of(x,y,z));
				z = -1;
			},
			z:(pos) => {
				z++;
				pos.should.eql(Uint32Array.of(x,y,z));
			}
		});
	});
	it("should yield expected octant offsets (range 0-7 * octantSize) for a position vector", function() {
		var d = 5;
		var i;
		// These should have the same identity at any depth
		for(i = 0; i < d; ++i) {
			octantIdentity([ 0, 0, 0], i, d).should.equal(0);
			octantIdentity([31, 0, 0], i, d).should.equal(1);
			octantIdentity([ 0,31, 0], i, d).should.equal(2);
			octantIdentity([31,31, 0], i, d).should.equal(3);
			octantIdentity([ 0, 0,31], i, d).should.equal(4);
			octantIdentity([31, 0,31], i, d).should.equal(5);
			octantIdentity([ 0,31,31], i, d).should.equal(6);
			octantIdentity([31,31,31], i, d).should.equal(7);
		}
		for(i = 1; i < d; ++i) {
			octantIdentity([ 0, 0, 0], i, d).should.equal(0);
			octantIdentity([15, 0, 0], i, d).should.equal(1);
			octantIdentity([ 0,15, 0], i, d).should.equal(2);
			octantIdentity([15,15, 0], i, d).should.equal(3);
			octantIdentity([ 0, 0,15], i, d).should.equal(4);
			octantIdentity([15, 0,15], i, d).should.equal(5);
			octantIdentity([ 0,15,15], i, d).should.equal(6);
			octantIdentity([15,15,15], i, d).should.equal(7);
		}
		for(i = 2; i < d; ++i) {
			octantIdentity([ 0, 0, 0], i, d).should.equal(0);
			octantIdentity([ 7, 0, 0], i, d).should.equal(1);
			octantIdentity([ 0, 7, 0], i, d).should.equal(2);
			octantIdentity([ 7, 7, 0], i, d).should.equal(3);
			octantIdentity([ 0, 0, 7], i, d).should.equal(4);
			octantIdentity([ 7, 0, 7], i, d).should.equal(5);
			octantIdentity([ 0, 7, 7], i, d).should.equal(6);
			octantIdentity([ 7, 7, 7], i, d).should.equal(7);
		}
		for(i = 3; i < d; ++i) {
			octantIdentity([ 0, 0, 0], i, d).should.equal(0);
			octantIdentity([ 3, 0, 0], i, d).should.equal(1);
			octantIdentity([ 0, 3, 0], i, d).should.equal(2);
			octantIdentity([ 3, 3, 0], i, d).should.equal(3);
			octantIdentity([ 0, 0, 3], i, d).should.equal(4);
			octantIdentity([ 3, 0, 3], i, d).should.equal(5);
			octantIdentity([ 0, 3, 3], i, d).should.equal(6);
			octantIdentity([ 3, 3, 3], i, d).should.equal(7);
		}
		octantIdentity([ 0, 0, 0], 4, d).should.equal(0);
		octantIdentity([ 1, 0, 0], 4, d).should.equal(1);
		octantIdentity([ 0, 1, 0], 4, d).should.equal(2);
		octantIdentity([ 1, 1, 0], 4, d).should.equal(3);
		octantIdentity([ 0, 0, 1], 4, d).should.equal(4);
		octantIdentity([ 1, 0, 1], 4, d).should.equal(5);
		octantIdentity([ 0, 1, 1], 4, d).should.equal(6);
		octantIdentity([ 1, 1, 1], 4, d).should.equal(7);
	});
});
