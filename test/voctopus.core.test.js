"use strict";
require("should");
const Voctopus = require("../src/voctopus.core").Voctopus;
const {loop3D, npot, sump8} = require("../src/voctopus.util.js");

describe("Voctopus", function() {
	var d, voc;
	// we haven't tested schemas yet so let's make a stub
	var schema = [
		{label:"m",offset:0,length:1},
		{label:"p",offset:1,length:4}
	];
	beforeEach("set up a clean voctopus instance", function() {
		d = 5;
		voc = new Voctopus(d, schema);
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
		(voc.schema).should.eql(schema);
		voc.octantSize.should.equal(5);
		voc.octetSize.should.equal(40);
		voc.nextOctet.should.equal(45);
	});
	it("should correctly calculate the maximum size for a Voctopus", function() {
		var voxSize = voc.octantSize;
		for(let i = 1; i < 9; ++i) {
			voc = new Voctopus(i, schema);
			voc.maxSize.should.eql(sump8(i)*voxSize);
		}
	});
	it("should initialize the root pointer to the correct offset", function() {
		var dv = voc.view;
		dv.getUint32(1).should.eql(5, "root octant's pointer is pointing at the right offset");
	});
	it("should correctly implement pointer getters and setters", function() {
		// implemented?
		voc.get.m.should.be.type("function");
		voc.get.p.should.be.type("function");
		voc.set.m.should.be.type("function");
		voc.set.p.should.be.type("function");

		voc.get.p(0).should.eql(5);
		voc.set.p(5, 45);
		voc.get.p(5).should.eql(45);
	});
	it("should generate a buffer of the correct length", function() {
		// should make a buffer of max size if the max size is less than 73*octantSize
		let voc = new Voctopus(1, schema);
		voc.buffer.byteLength.should.equal(64);
		// anything larger than this should start out at a quarter of the max size
		for(var i = 2; i < 10; i++) {
			voc = new Voctopus(i, schema);
			voc.buffer.byteLength.should.eql(npot(voc.maxSize/8), "buffer is nearest power of two to one eighth of max length "+voc.maxSize);
		}
	});
	it("should expand the buffer using expand", function() {
		var i, voc, ms;
		for(i = 3; i < 8; i++) {
			voc = null;
			voc = new Voctopus(i, schema);
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
		voc.traverse([0,0,0]).should.equal(5);
		voc.traverse([0,0,0], true).should.equal(165);
		voc.traverse([0,0,0]).should.equal(165);
	});
	it("should walk the octree using walk, returning an array of pointers", function() {
		voc.walk([0,0,0]).should.eql(new Uint32Array([5,0,0,0,0]));
		voc.walk([0,0,0], true).should.eql(new Uint32Array([5, 45, 85, 125, 165]));
	});
	it("should set voxel data at the right position with setVoxel", function() {
		var dv = voc.view;
		// this should make a tree going down to 0,0
		voc.setVoxel([0,0,0], {m:1});
		// look at the raw data, since we haven't yet tested getVoxel
		dv.getUint32(6).should.eql(45, "octant's pointer at depth 1 is pointing at the right offset");
		dv.getUint32(46).should.eql(85, "octant's pointer at depth 2 is pointing at the right offset");
		dv.getUint32(86).should.eql(125, "octant's pointer at depth 3 is pointing at the right offset");
		dv.getUint32(126).should.eql(165, "octant's pointer at depth 4 is pointing at the right offset");
		dv.getUint8(165).should.eql(1, "voxel's material value is correct");
		dv.getUint32(166).should.eql(0, "voxel's pointer value is correct");
	});
	it("should maintain integrity of the buffer during an expansion", function() {
		this.timeout(10000);
		var i, voc, size, index, count = 0, a, b, da, db;
		voc = new Voctopus(6, schema);
		loop3D(size, {
			y:() => i = 0, z:(pos) => {
				index = voc.setVoxel(pos, {m:i});
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
	it("should initialize an octet's data to zero using initializeOctet", function() {
		var index;
		// set the voxel first so we're grabbing the right data with getVoxel
		index = voc.setVoxel([0,0,0], {r:31,g:63,b:127,m:12});
		// the tree was empty so the start of the leaf octet should be 264 for a tree of depth 5 (calculated externally) 
		voc.initializeOctet(index); // initialize the octet beginning at offset 1, which is the second down from root octant
		voc.get(index).should.eql({m:0});
	});
	xit("should prune redundant branches using prune", function() {
		var i = 0;
		loop3D(16, {y:() => i++, z:(pos)=> voc.setVoxel(pos, {r:i,g:i,b:i,m:i})});
	});
});
