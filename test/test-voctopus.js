"use strict";
require("should");
var Voctopus = require("../src/voctopus").Voctopus;
var Voctant = require("../src/voctopus").Voctant;

describe("voctant", function() {
	var buf;
	beforeEach("set up a clean buffer", function() {
		buf = new ArrayBuffer(64); // use a small buffer for testing
	});
	it("should support all its interfaces", function() {
		var vt = new Voctant(buf, 0);
		vt.hasOwnProperty("writable").should.be.true("property writable");
		vt.writable.should.be.false();
		vt.hasOwnProperty("color").should.be.true("property color");
		vt.hasOwnProperty("material").should.be.true("property material");
		vt.hasOwnProperty("pointer").should.be.true("property pointer");
		(typeof(vt.setProps)).should.equal("function", "method setProps");
		// if it supports these it's probably supporting all the DV interfaces
		(typeof(vt.getUint8)).should.equal("function", "method getUint8");
		(typeof(vt.setUint8)).should.equal("function", "method setUint8");
		vt = new Voctant(buf, 0, true);
		vt.writable.should.be.true();
	});
	it("should properly set and get colors", function() {
		var vt = new Voctant(buf, 0, true);
		vt.r = 1;
		vt.g = 2;
		vt.b = 3;
		vt.r.should.eql(1);
		vt.g.should.eql(2);
		vt.b.should.eql(3);
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
	it("should support setProps with any combination of properties", function() {
		var vt = new Voctant(buf, 0, true);
		vt.setProps({r:1});
		vt.setProps({g:2});
		vt.setProps({b:3});
		vt.setProps({r:6, b:7});
		vt.setProps({material:4});
		vt.setProps({pointer:5});
		vt.setProps({material:8, g:9});
		vt.r.should.eql(6);
		vt.g.should.eql(9);
		vt.b.should.eql(7);
		vt.material.should.eql(8);
		vt.pointer.should.eql(5);
	});
	it("should prevent writing to a voxel if the voxel is not writable", function() {
		var vt = new Voctant(buf, 0, false);
		vt.setProps({r:1,g:2,b:3,material:4,pointer:5});
		vt.r.should.eql(0);
		vt.g.should.eql(0);
		vt.b.should.eql(0);
		vt.material.should.eql(0);
		vt.pointer.should.eql(0);
		vt.color = [1,2,3];
		vt.color.should.eql(new Uint8Array([0,0,0]));
	});

});
describe("voctopus", function() {
	var d, voc;
	beforeEach("set up a clean voctopus instance", function() {
		d = 5;
		voc = new Voctopus(d);
	});
	it("should expose expected interfaces", function() {
		voc.should.have.property("freedOctets");
		voc.should.have.property("nextOctet");
		voc.should.have.property("buffer");
		voc.should.have.property("depth");
		(typeof(voc.octantOffset)).should.equal("function", "method octantOffset");
		(typeof(voc.getVoxel)).should.equal("function", "method getVoxel");
		(typeof(voc.setVoxel)).should.equal("function", "method setVoxel");
		//(typeof(voc.vecOf)).should.equal("function", "method vecOf");
		//(typeof(voc.parentOfKey)).should.equal("function", "method parentOfKey");
		(typeof(voc.allocateOctet)).should.equal("function", "method allocateOctet");
		//(typeof(voc.deallocate)).should.equal("function");
		//(typeof(voc.voctants)).should.equal("object", "method voctants");
	});
	it("should always return 0 at depth 0 for octantOffset", function() {
		voc.octantOffset([ 0, 0, 0], 0).should.equal(0);
		voc.octantOffset([31, 0, 0], 0).should.equal(0);
		voc.octantOffset([ 0,31, 0], 0).should.equal(0);
		voc.octantOffset([31,31, 0], 0).should.equal(0);
		voc.octantOffset([ 0, 0,31], 0).should.equal(0);
		voc.octantOffset([31, 0,31], 0).should.equal(0);
		voc.octantOffset([ 0,31,31], 0).should.equal(0);
		voc.octantOffset([31,31,31], 0).should.equal(0);
	});
	it("should yield expected octant offsets (range 0-7) for a position vector", function() {
		var i;
		// These should have the same identity at any depth
		for(i = 1; i < d; i++) {
			voc.octantOffset([ 0, 0, 0], i).should.equal(0);
			voc.octantOffset([31, 0, 0], i).should.equal(1);
			voc.octantOffset([ 0,31, 0], i).should.equal(2);
			voc.octantOffset([31,31, 0], i).should.equal(3);
			voc.octantOffset([ 0, 0,31], i).should.equal(4);
			voc.octantOffset([31, 0,31], i).should.equal(5);
			voc.octantOffset([ 0,31,31], i).should.equal(6);
			voc.octantOffset([31,31,31], i).should.equal(7);
		}
		// for d == 2, coordinates corresponding to octet 8 at d == 1)
		for(i = 2; i < d; i++) {
			voc.octantOffset([ 0, 0, 0], 2).should.equal(0);
			voc.octantOffset([15, 0, 0], 2).should.equal(1);
			voc.octantOffset([ 0,15, 0], 2).should.equal(2);
			voc.octantOffset([15,15, 0], 2).should.equal(3);
			voc.octantOffset([ 0, 0,15], 2).should.equal(4);
			voc.octantOffset([15, 0,15], 2).should.equal(5);
			voc.octantOffset([ 0,15,15], 2).should.equal(6);
			voc.octantOffset([15,15,15], 2).should.equal(7);
		}
	});
	it("should generate a buffer of the correct length", function() {
		voc = new Voctopus(3); // Voctopus of depth 3 should be 73 octants long, or 146 bytes 
		voc.buffer.byteLength.should.equal(584);
		voc = new Voctopus(4); // Maximum length of an unexpanded buffer is 146
		voc.buffer.byteLength.should.equal(1170);
		voc = new Voctopus(8); // A fully dense octree of depth 8 would be 19173960 bytes, but it should cap out at a quarter of that
		voc.buffer.byteLength.should.equal(4793490);
	});
	it("should expand the buffer using expand", function() {
		var voc = new Voctopus(4);
		voc.buffer.byteLength.should.equal(1170);
		voc.expand();
		voc.buffer.byteLength.should.equal(1560);
		voc.expand();
		voc.buffer.byteLength.should.equal(2340);
		voc.expand();
		voc.buffer.byteLength.should.equal(4680);
		(function() {voc.expand()}).should.throwError();
	});
	it("should set voxel data at the right position", function() {
		var voc = new Voctopus(2);
		var v = [0,0,0];
		voc.cursor = 0;
		// this should make a tree going down to 0,0
		voc.setVoxel(v, {r:31,g:63,b:255,material:1});
		// look at the raw data, since we haven't yet tested getVoxel
		let dv = new DataView(voc.buffer);
		dv.getUint32(4).should.eql(8, "root octant's pointer is pointing at the right offset");
		dv.getUint8(8).should.eql(31, "voxel's r value is correct");
		dv.getUint8(9).should.eql(63, "voxel's b value is correct");
		dv.getUint8(10).should.eql(255, "voxel's g value is correct");
		dv.getUint8(11).should.eql(1, "voxel's material value is correct");
		dv.getUint32(12).should.eql(0, "voxel's pointer value is correct");
	});
	it("should get voxel data after setting it", function() {
		var v = [0,0,0];
		voc.setVoxel(v, {r:31,g:63,b:255,material:1});
		let vox = voc.getVoxel(v);
		vox.should.have.property("r", 31);
		vox.should.have.property("g", 63);
		vox.should.have.property("b", 255);
		vox.should.have.property("material", 1);
	});
	it("should initialize an octet to zero", function() {
		var voc = new Voctopus(2);
		let vox = voc.getVoxel([0,0,0]);
		voc.setVoxel([0,0,0], {r:31,g:63,b:127,material:12});
		// offsets 0-7 are the root octet, so start at 8 and wipe 64 (the length of an octet)
		voc.initializeOctet(8); // initialize the octet beginning at offset 1, which is the second down from root octant
		vox.should.have.property("r", 0);
		vox.should.have.property("g", 0);
		vox.should.have.property("b", 0);
		vox.should.have.property("material", 0);
	});
});
