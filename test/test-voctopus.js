"use strict";
require("should");
var Voctopus = require("../src/voctopus").Voctopus;
var Voctant = require("../src/voctopus").Voctant;
var voctopusCursorFactory = require("../src/voctopus").voctopusCursorFactory;

describe("voctant", function() {
	var buf = new ArrayBuffer(64); // use a small buffer for testing
	it("should support all its interfaces", function() {
		var vt = new Voctant(buf, 0);
		vt.hasOwnProperty("writable").should.be.true("property writable");
		vt.writable.should.be.false();
		vt.hasOwnProperty("color").should.be.true("property color");
		vt.hasOwnProperty("material").should.be.true("property material");
		vt.hasOwnProperty("pointer").should.be.true("property pointer");
		// if it supports these it's probably supporting all the DV interfaces
		(typeof(vt.getUint8)).should.equal("function", "method getUint8");
		(typeof(vt.setUint8)).should.equal("function", "method setUint8");
		var vt = new Voctant(buf, 0, true);
		vt.writable.should.be.true();
	});
	it("should properly set and get colors", function() {
		var vt = new Voctant(buf, 0, true);
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
		var vt = new Voctant(buf, 0, true);
		vt.material = 13;
		vt.material.should.equal(13);
	});
	it("should properly set and get child pointers", function() {
		var vt = new Voctant(buf, 0, true);
		vt.pointer = 1234567890;
		vt.pointer.should.equal(1234567890);
	});
});
describe("voctopus", function() {
	var d = 5;
	var voc = new Voctopus(d);
	/*
	function isUndef(val) {
		return (typeof(val) === "undefined");
	}
	*/
	it("should expose expected interfaces", function() {
		voc.should.have.property("freedOctets");
		voc.should.have.property("nextOctet");
		voc.should.have.property("buffer");
		voc.should.have.property("depth");
		(typeof(voc.octantIdentity)).should.equal("function", "method octantIdentity");
		(typeof(voc.getVoxel)).should.equal("function", "method getVoxel");
		(typeof(voc.setVoxel)).should.equal("function", "method setVoxel");
		//(typeof(voc.vecOf)).should.equal("function", "method vecOf");
		//(typeof(voc.parentOfKey)).should.equal("function", "method parentOfKey");
		(typeof(voc.allocateOctet)).should.equal("function", "method allocateOctet");
		//(typeof(voc.deallocate)).should.equal("function");
		//(typeof(voc.voctants)).should.equal("object", "method voctants");
	});
	it("should always return 0 at depth 0 for octantIdentity", function() {
		voc.octantIdentity([ 0, 0, 0], 0).should.equal(0);
		voc.octantIdentity([31, 0, 0], 0).should.equal(0);
		voc.octantIdentity([ 0,31, 0], 0).should.equal(0);
		voc.octantIdentity([31,31, 0], 0).should.equal(0);
		voc.octantIdentity([ 0, 0,31], 0).should.equal(0);
		voc.octantIdentity([31, 0,31], 0).should.equal(0);
		voc.octantIdentity([ 0,31,31], 0).should.equal(0);
		voc.octantIdentity([31,31,31], 0).should.equal(0);
	});
	it("should yield expected octet identities (range 0-7) for a position vector", function() {
		var i;
		// These should have the same identity at any depth
		for(i = 1; i < d; i++) {
			voc.octantIdentity([ 0, 0, 0], i).should.equal(0);
			voc.octantIdentity([31, 0, 0], i).should.equal(1);
			voc.octantIdentity([ 0,31, 0], i).should.equal(2);
			voc.octantIdentity([31,31, 0], i).should.equal(3);
			voc.octantIdentity([ 0, 0,31], i).should.equal(4);
			voc.octantIdentity([31, 0,31], i).should.equal(5);
			voc.octantIdentity([ 0,31,31], i).should.equal(6);
			voc.octantIdentity([31,31,31], i).should.equal(7);
		}
		// for d == 2, coordinates corresponding to octet 8 at d == 1)
		for(i = 2; i < d; i++) {
			voc.octantIdentity([ 0, 0, 0], 2).should.equal(0);
			voc.octantIdentity([15, 0, 0], 2).should.equal(1);
			voc.octantIdentity([ 0,15, 0], 2).should.equal(2);
			voc.octantIdentity([15,15, 0], 2).should.equal(3);
			voc.octantIdentity([ 0, 0,15], 2).should.equal(4);
			voc.octantIdentity([15, 0,15], 2).should.equal(5);
			voc.octantIdentity([ 0,15,15], 2).should.equal(6);
			voc.octantIdentity([15,15,15], 2).should.equal(7);
		}
	});
	it("should generate a buffer of the correct length", function() {
		voc = new Voctopus(3); // Voctopus of depth 3 should be 73 octants long, or 146 bytes 
		voc.buffer.byteLength.should.equal(146);
		voc = new Voctopus(2); // Minimum length of a buffer is 146 even when not required (trees of depth < 3 aren't very useful in the real world, and there's no point in making a buffer much smaller than that)
		voc.buffer.byteLength.should.equal(146);
		voc = new Voctopus(8); // A fully dense octree of depth 8 would be 4793490 bytes, but it should cap out at a quarter of that
		voc.buffer.byteLength.should.equal(599186);
	});
	it("should expand the buffer using expand", function() {
		var x, y, z;
		var voc = new Voctopus(4);
		voc.buffer.byteLength.should.equal(146);
		voc.expand();
		voc.buffer.byteLength.should.equal(167);
		voc.expand();
		voc.buffer.byteLength.should.equal(195);
		voc.expand();
		voc.buffer.byteLength.should.equal(234);
		voc.expand();
		voc.buffer.byteLength.should.equal(292);
		voc.expand();
		voc.buffer.byteLength.should.equal(390);
	});
	it("should traverse the octree", function() {
		var i = 0;
		var v = [0,0,0];
		voc.cursor = 0;
		// this should make a tree going down to 0,0
		voc.setVoxel(v, {r:32,g:64,b:255,m:1});
	});
});
