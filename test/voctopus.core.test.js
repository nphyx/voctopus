"use strict";
require("should");
const Voctopus = require("../src/voctopus.core").Voctopus;
const schemas = require("../src/voctopus.schemas.js");
const util = require("../src/voctopus.util.js");
const {loop3D, npot} = util;

describe("Voctopus", function() {
	var d, voc;
	beforeEach("set up a clean voctopus instance", function() {
		d = 5;
		voc = new Voctopus(d, schemas.RGBM);
	});
	it("should expose expected interfaces", function() {
		voc.should.have.property("freedOctets");
		voc.should.have.property("nextOctet");
		voc.should.have.property("buffer");
		voc.should.have.property("depth");
		voc.should.have.property("maxSize");
		(typeof(voc.getVoxel)).should.equal("function", "method getVoxel implemented");
		(typeof(voc.setVoxel)).should.equal("function", "method setVoxel implemented");
		(typeof(voc.allocateOctet)).should.equal("function", "method allocateOctet implemented");
		(typeof(voc.traverse)).should.equal("function", "method allocateOctet implemented");
		(typeof(voc.walk)).should.equal("function", "method allocateOctet implemented");
		(typeof(voc.expand)).should.equal("function", "method expand implemented");
	});
	it("should implement octant schemas", function() {
		var prop;
		// default schema: RGBM
		for(prop of voc.schema) {
			prop.should.have.property("label");
			prop.should.have.property("offset");
			prop.should.have.property("length");
		}
		(voc.schema.find((el) => el.label === "pointer") === "undefined").should.be.false();
		voc.octantSize.should.equal(8);
		voc.octetSize.should.equal(64);
		voc.nextOctet.should.equal(72);
		// now check I8M schema
		voc = new Voctopus(5, schemas.I8M);
		for(prop of voc.schema) {
			prop.should.have.property("label");
			prop.should.have.property("offset");
			prop.should.have.property("length");
		}
		(voc.schema.find((el) => el.label === "pointer") === "undefined").should.be.false();
		voc.octantSize.should.equal(4);
		voc.octetSize.should.equal(32);
		voc.nextOctet.should.equal(36);
	});
	it("should correctly calculate the maximum size for a Voctopus", function() {
		var voxSize = voc.octantSize;
		voc = new Voctopus(1);
		voc.maxSize.should.eql(9*voxSize);
		voc = new Voctopus(2);
		voc.maxSize.should.eql(73*voxSize);
		voc = new Voctopus(3);
		voc.maxSize.should.eql(585*voxSize);
		voc = new Voctopus(4);
		voc.maxSize.should.eql(4681*voxSize);
		voc = new Voctopus(5);
		voc.maxSize.should.eql(37449*voxSize);
		voc = new Voctopus(6);
		voc.maxSize.should.eql(299593*voxSize);
		voc = new Voctopus(7);
		voc.maxSize.should.eql(2396745*voxSize);
		voc = new Voctopus(8);
		voc.maxSize.should.eql(19173961*voxSize);
	});
	it("should initialize the root pointer to the correct offset", function() {
		var dv = voc.view;
		dv.getUint32(4).should.eql(8, "root octant's pointer is pointing at the right offset");
	});
	it("should correctly implement pointer getters and setters", function() {
		// implemented?
		voc.get.r.should.be.type("function");
		voc.get.g.should.be.type("function");
		voc.get.b.should.be.type("function");
		voc.get.material.should.be.type("function");
		voc.get.pointer.should.be.type("function");
		voc.set.r.should.be.type("function");
		voc.set.g.should.be.type("function");
		voc.set.b.should.be.type("function");
		voc.set.material.should.be.type("function");
		voc.set.pointer.should.be.type("function");

		voc.get.pointer(0).should.eql(8);
		voc.set.pointer(8, 72);
		voc.get.pointer(8).should.eql(72);
	});
	it("should generate a buffer of the correct length", function() {
		// should make a buffer of max size if the max size is less than 73*octantSize
		let voc = new Voctopus(1);
		voc.buffer.byteLength.should.equal(128);
		// anything larger than this should start out at a quarter of the max size
		for(var i = 2; i < 10; i++) {
			voc = new Voctopus(i);
			voc.buffer.byteLength.should.eql(npot(voc.maxSize/8), "buffer is nearest power of two to one eighth of max length "+voc.maxSize);
		}
	});
	it("should expand the buffer using expand", function() {
		var i, voc, ms;
		for(i = 3; i < 8; i++) {
			voc = null;
			voc = new Voctopus(i);
			ms = voc.maxSize;
			voc.buffer.byteLength.should.equal(npot(~~(ms/8)));
			voc.expand();
			voc.buffer.byteLength.should.equal(npot(~~(ms/4)));
			voc.expand();
			voc.buffer.byteLength.should.equal(npot(~~(ms/2)));
			voc.expand();
			voc.buffer.byteLength.should.equal(npot(ms));
			voc.expand().should.be.false();
		}
	});
	it("should traverse the octree using traverse, optionally initializing octets as it goes", function() {
		voc.traverse([0,0,0]).should.equal(8);
		voc.traverse([0,0,0], true).should.equal(264);
		voc.traverse([0,0,0]).should.equal(264);
	});
	it("should set voxel data at the right position with setVoxel", function() {
		var dv = voc.view;
		// this should make a tree going down to 0,0
		voc.setVoxel([0,0,0], {r:31,g:63,b:255,material:1});
		// look at the raw data, since we haven't yet tested getVoxel
		dv.getUint32(12).should.eql(72, "octant's pointer at depth 1 is pointing at the right offset");
		dv.getUint32(76).should.eql(136, "octant's pointer at depth 2 is pointing at the right offset");
		dv.getUint32(140).should.eql(200, "octant's pointer at depth 3 is pointing at the right offset");
		dv.getUint32(204).should.eql(264, "octant's pointer at depth 4 is pointing at the right offset");
		dv.getUint8(264).should.eql(31, "voxel's r value is correct");
		dv.getUint8(265).should.eql(63, "voxel's g value is correct");
		dv.getUint8(266).should.eql(255, "voxel's b value is correct");
		dv.getUint8(267).should.eql(1, "voxel's material value is correct");
		dv.getUint32(268).should.eql(0, "voxel's pointer value is correct");
	});
	it("should maintain integrity of the buffer during an expansion", function() {
		this.timeout(10000);
		var i, voc, size, index, count = 0, a, b, da, db;
		voc = new Voctopus(6, schemas.RGBM);
		loop3D(size, {
			y:() => i = 0, 
			z:(pos) => {
				index = voc.setVoxel(pos, {r:i,g:i+1,b:i+2,material:i+3});
				i++;
				count++; 
			}
		});
		a = voc.buffer;
		voc.expand();
		b = voc.buffer;
		da = new DataView(a);
		db = new DataView(b);
		let end = Math.pow(size+1, 3)*voc.octantSize;
		for(i = 0; i < end; i++) {
			da.getUint8(i).should.eql(db.getUint8(i));
		}
	});
	it("should walk the octree using walk, returning an array of pointers", function() {
		voc.walk([0,0,0]).should.eql(new Uint32Array([8,0,0,0,0]));
		voc.walk([0,0,0], true).should.eql(new Uint32Array([8, 72, 136, 200, 264]));
	});
	it("should get voxel data after setting it using getVoxel in RGBM schema", function() {
		this.timeout(10000);
		var size, i, index, time, count = 0;
		voc = new Voctopus(6, schemas.RGBM);
		size = Math.pow(2, voc.depth - 1);
		time = new Date().getTime();
		loop3D(size, {
			y:() => i = 0, 
			z:(pos) => {
				index = voc.setVoxel(pos, {r:i,g:i+1,b:i+2,material:i+3});
				i++;
				count++; 
			}
		});
		time = new Date().getTime() - time;
		console.log("Time to populate RGBM:",time/1000+"s"," total voxels:",count);
		time = new Date().getTime();
		loop3D(size, {
			y:() => i = 0, 
			z:(pos) => {
				voc.getVoxel(pos).should.eql({r:i, g:i+1, b:i+2, material:i+3});
				i++;
			}
		});
		time = new Date().getTime() - time;
		console.log("Time to check:",time/1000+"s");
	});
	it("should get voxel data after setting it using getVoxel in I8M schema", function() {
		this.timeout(10000);
		var size, i, index, time, count = 0;
		voc = new Voctopus(6, schemas.I8M);
		size = Math.pow(2, voc.depth - 1);
		time = new Date().getTime();
		loop3D(size, {
			y:() => i = 0, 
			z:(pos) => {
				index = voc.setVoxel(pos, {material:i});
				i++;
				count++; 
			}
		});
		time = new Date().getTime() - time;
		console.log("Time to populate I8M:",time/1000+"s"," total voxels:",count);
		time = new Date().getTime();
		loop3D(size, {
			y:() => i = 0,
			z:(pos) => {
				voc.getVoxel(pos).material.should.eql(i);
				i++;
			}
		});
		time = new Date().getTime() - time;
		console.log("Time to check:",time/1000+"s");
	});
	it("should initialize an octet's data to zero using initializeOctet", function() {
		var index;
		// set the voxel first so we're grabbing the right data with getVoxel
		index = voc.setVoxel([0,0,0], {r:31,g:63,b:127,material:12});
		// the tree was empty so the start of the leaf octet should be 264 for a tree of depth 5 (calculated externally) 
		voc.initializeOctet(index); // initialize the octet beginning at offset 1, which is the second down from root octant
		voc.get(index).should.eql({r:0,g:0,b:0,material:0});
	});
	xit("should prune redundant branches using prune", function() {
		var i = 0;
		loop3D(16, {y:() => i++, z:(pos)=> voc.setVoxel(pos, {r:i,g:i,b:i,material:i})});
	});
});
