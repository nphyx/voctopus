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
		(typeof(voc.octantOffset)).should.equal("function", "method octantOffset not implemented");
		(typeof(voc.getVoxel)).should.equal("function", "method getVoxel not implemented");
		(typeof(voc.setVoxel)).should.equal("function", "method setVoxel not implemented");
		(typeof(voc.getOctant)).should.equal("function", "method getOctant not implemented");
		(typeof(voc.setOctant)).should.equal("function", "method setOctant not implemented");
		(typeof(voc.getProperty)).should.equal("function", "method getProperty not implemented");
		(typeof(voc.setProperty)).should.equal("function", "method setProperty not implemented");
		(typeof(voc.allocateOctet)).should.equal("function", "method allocateOctet not implemented");
		(typeof(voc.expand)).should.equal("function", "method expand not implemented");
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
	it("should refuse to create an octree larger than the schema's pointer can handle", function() {
		var schema;
		// make a contrived schema with a tiny pointer
		schema = [{label:"value",length:1,offset:0},{label:"pointer",length:1,offset:1}];
		// try to make a Voctopus bigger than 256 elements (this would be 
		(function() {new Voctopus(3, schema)}).should.throwError();
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
	it("should yield expected octant offsets (range 0-7 * octantSize) for a position vector", function() {
		var i;
		// These should have the same identity at any depth
		for(i = 1; i < d; i++) {
			voc.octantOffset([ 0, 0, 0], i).should.equal(0*voc.octantSize);
			voc.octantOffset([31, 0, 0], i).should.equal(1*voc.octantSize);
			voc.octantOffset([ 0,31, 0], i).should.equal(2*voc.octantSize);
			voc.octantOffset([31,31, 0], i).should.equal(3*voc.octantSize);
			voc.octantOffset([ 0, 0,31], i).should.equal(4*voc.octantSize);
			voc.octantOffset([31, 0,31], i).should.equal(5*voc.octantSize);
			voc.octantOffset([ 0,31,31], i).should.equal(6*voc.octantSize);
			voc.octantOffset([31,31,31], i).should.equal(7*voc.octantSize);
		}
		// for d == 2, coordinates corresponding to octet voc.octantSize at d == 1)
		for(i = 2; i < d; i++) {
			voc.octantOffset([ 0, 0, 0], 2).should.equal(0*voc.octantSize);
			voc.octantOffset([15, 0, 0], 2).should.equal(1*voc.octantSize);
			voc.octantOffset([ 0,15, 0], 2).should.equal(2*voc.octantSize);
			voc.octantOffset([15,15, 0], 2).should.equal(3*voc.octantSize);
			voc.octantOffset([ 0, 0,15], 2).should.equal(4*voc.octantSize);
			voc.octantOffset([15, 0,15], 2).should.equal(5*voc.octantSize);
			voc.octantOffset([ 0,15,15], 2).should.equal(6*voc.octantSize);
			voc.octantOffset([15,15,15], 2).should.equal(7*voc.octantSize);
		}
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
		// until we implement nested octrees 9 will be the max size for the RGBMP Voctant
		var fun = () => new Voctopus(i);
		for(i = 10; i < 16; i++) {
			(fun).should.throwError();
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
	it("should maintain integrity of the buffer during an expansion", function() {
		this.timeout(10000);
		var i, voc, size, index, count = 0, a, b, da, db;
		voc = new Voctopus(6, schemas.RGBM);
		size = 16; // lets only do part of it
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
	it("should set voxel data at the right position with setVoxel", function() {
		var dv;
		// this should make a tree going down to 0,0
		voc.setVoxel([0,0,0], {r:31,g:63,b:255,material:1});
		dv = voc.view;
		// look at the raw data, since we haven't yet tested getVoxel
		dv.getUint32(4).should.eql(8, "root octant's pointer is pointing at the right offset");
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
	it("should traverse the octree using traverse, optionally initializing octets as it goes", function() {
		voc.traverse([0,0,0]).should.equal(8);
		voc.traverse([0,0,0], true).should.equal(264);
		voc.traverse([0,0,0]).should.equal(264);
	});
	it("should walk the octree using walk, returning an array of pointers", function() {
		voc.walk([0,0,0]).should.eql(new Uint32Array([8,0,0,0,0]));
		voc.walk([0,0,0], true).should.eql(new Uint32Array([8, 72, 136, 200, 264]));
	});
	it("should get voxel data after setting it using getVoxel in RGBM schema", function() {
		this.timeout(10000);
		var size, x, y, z, i, index, vox, time, count = 0;
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
				vox = voc.getVoxel(pos);
				vox[0].should.equal(i, "octant at x:"+x+" y:"+y+" z:"+z+" has value "+i);
				vox[1].should.equal(i+1, "octant at x:"+x+" y:"+y+" z:"+z+" has value "+i);
				vox[2].should.equal(i+2, "octant at x:"+x+" y:"+y+" z:"+z+" has value "+i);
				vox[3].should.equal(i+3, "octant at x:"+x+" y:"+y+" z:"+z+" has value "+i);
				i++;
			}
		});
		time = new Date().getTime() - time;
		console.log("Time to check:",time/1000+"s");
	});
	it("should get voxel data after setting it using getVoxel in I8M schema", function() {
		this.timeout(10000);
		var size, i, index, vox, time, count = 0;
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
				vox = voc.getVoxel(pos);
				vox[0].should.equal(i, "octant at x:"+pos[0]+" y:"+pos[1]+" z:"+pos[2]+" has value "+i);
				i++;
			}
		});
		time = new Date().getTime() - time;
		console.log("Time to check:",time/1000+"s");
	});
	it("should initialize an octet's data to zero using initializeOctet", function() {
		var index, vox;
		// set the voxel first so we're grabbing the right data with getVoxel
		index = voc.setVoxel([0,0,0], {r:31,g:63,b:127,material:12});
		// the tree was empty so the start of the leaf octet should be 264 for a tree of depth 5 (calculated externally) 
		voc.initializeOctet(index); // initialize the octet beginning at offset 1, which is the second down from root octant
		vox = voc.getOctant(index);
		vox[1].should.equal(0);
		vox[2].should.equal(0);
		vox[3].should.equal(0);
		vox[4].should.equal(0);
	});
	xit("should prune redundant branches using prune", function() {
		var i = 0;
		loop3D(16, {y:() => i++, z:(pos)=> voc.setVoxel(pos, {r:i,g:i,b:i,material:i})});
	});
});
