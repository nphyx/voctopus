"use strict";
require("should");
const Voctopus = require("../src/voctopus.core").Voctopus;
const {loop3D, npot, sump8} = require("../src/voctopus.util.js");

describe("Voctopus", function() {
	var d, voc;
	// we haven't tested schemas yet so let's make a stub
	var schema = [
		{label:"p",type:{get:DataView.prototype.getUint32, set:DataView.prototype.setUint32,length:4}},
		{label:"m",type:{get:DataView.prototype.getUint8, set:DataView.prototype.setUint8,length:1}},
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
		//voc.should.have.property("fields").eql(["m"]);
		(typeof(voc.get)).should.equal("function", "method get implemented");
		(typeof(voc.set)).should.equal("function", "method set implemented");
		(typeof(voc.getVoxel)).should.equal("function", "method getVoxel implemented");
		(typeof(voc.setVoxel)).should.equal("function", "method setVoxel implemented");
		(typeof(voc.allocateOctets)).should.equal("function", "method allocateOctets implemented");
		(typeof(voc.init)).should.equal("function", "method init implemented");
		(typeof(voc.walk)).should.equal("function", "method walk implemented");
		(typeof(voc.expand)).should.equal("function", "method expand implemented");
	});
	it("should implement octant schemas", function() {
		(voc.schema).should.eql(schema);
		voc.octantSize.should.equal(5);
		voc.octetSize.should.equal(40);
		voc.nextOctet.should.equal(80);
	});
	it("should correctly calculate the maximum size for a Voctopus", function() {
		var voxSize = voc.octantSize;
		for(let i = 1; i < 9; ++i) {
			voc = new Voctopus(i, schema);
			voc.maxSize.should.eql(npot(sump8(i)*voxSize));
		}
	});
	it("should correctly calculate the octree's dimensions", function() {
		for(var i = 1; i < 16; i++) {
			var voc = new Voctopus(i, schema);
			voc.dimensions.should.eql(Math.pow(2, i));
		}
	});
	it("should initialize the root pointer to the correct offset", function() {
		var dv = voc.view;
		dv.getUint32(0).should.eql(40, "root octant's pointer is pointing at the right offset");
	});
	it("should correctly implement pointer getters and setters", function() {
		// implemented?
		voc.get.m.should.be.type("function");
		voc.get.p.should.be.type("function");
		voc.set.m.should.be.type("function");
		voc.set.p.should.be.type("function");

		voc.set.p(0, 40);
		voc.get.p(0).should.eql(40);
		voc.set.p(40, 80);
		voc.get.p(40).should.eql(80);
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
	it("should initialize a coordinate's branch to a given depth with init", function() {
		// use a smaller tree for these tests because it's less math to reason about
		let vec = Float32Array.of(0,0,0);
		let expected = [40, 80, 120, 160, 200];
		// one at a time
		for(let i = 0; i < expected.length; ++i) {
			voc.init(vec, i).should.eql(expected[i]);
		}
		// now all at once
		voc = new Voctopus(3, schema);
		voc.init(vec).should.eql(120);

		vec[0] = 1.0;
		voc.init(vec).should.eql(125);
		voc.init(vec).should.eql(125);

		// check each depth level change
		vec[0] = 2.0;
		voc.init(vec).should.eql(160);
		voc.init(vec).should.eql(160);

		vec[0] = 4.0;
		voc.init(vec).should.eql(240);
		voc.init(vec).should.eql(240);

		vec[1] = 1.0;
		voc.init(vec).should.eql(250);
		voc.init(vec).should.eql(250);

		vec[1] = 2.0;
		voc.init(vec).should.eql(280);
		voc.init(vec).should.eql(280);

		vec[1] = 4.0;
		voc.init(vec).should.eql(360);
		voc.init(vec).should.eql(360);

		vec[2] = 2.0;
		voc.init(vec).should.eql(400);
		voc.init(vec).should.eql(400);

		vec[2] = 4.0;
		voc.init(vec).should.eql(480);
		voc.init(vec).should.eql(480);

		vec[0] = 3.0; vec[1] = 7.0; vec[2] = 4.0;
		voc.init(vec).should.eql(575);
		voc.init(vec).should.eql(575);

		voc = new Voctopus(5, schema);
		loop3D(16, {x:(pos) => {
			let posb = Array.prototype.slice.call(pos);
			let vec = [];
			for(let i in posb) posb[i] *= 2;
			for(let i = 0; i < 8; ++i) {
				// this is slow and dumb but it's easy to understand and just a test!
				let str = (("0").repeat(3)+(i >>> 0).toString(2)).slice(-3);
				vec[0] = posb[0]+parseInt(str.charAt(2));
				vec[1] = posb[1]+parseInt(str.charAt(1));
				vec[2] = posb[2]+parseInt(str.charAt(0));
				voc.init(vec).should.eql(voc.nextOctet - 40 + voc.octantSize*i);
			}
		}});
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
	it("should walk the octree, returning an array of pointers", function() {
		// use a smaller tree for these tests because it's less math to reason about
		voc = new Voctopus(3, schema);
		let vec = Float32Array.of(0,0,0);
		voc.walk(vec).should.eql([40]);
		let expected = [40, 80, 120];

		// now all at once
		voc.init(vec);
		voc.walk(vec).should.eql(expected);

		vec[0] = 1.0;
		voc.init(vec);
		expected = [40, 80, 125];
		voc.walk(vec).should.eql(expected);

		// check each depth level change
		vec[0] = 2.0;
		voc.init(vec);
		expected = [40, 85, 160];
		voc.walk(vec).should.eql(expected);

		vec[0] = 4.0;
		voc.init(vec);
		expected = [45, 200, 240];
		voc.walk(vec).should.eql(expected);

		vec[1] = 1.0;
		voc.init(vec);
		expected = [45, 200, 250];
		voc.walk(vec).should.eql(expected);

		vec[1] = 2.0;
		voc.init(vec);
		expected = [45, 210, 280];
		voc.walk(vec).should.eql(expected);

		vec[1] = 4.0;
		voc.init(vec);
		expected = [55, 320, 360];
		voc.walk(vec).should.eql(expected);

		vec[2] = 2.0;
		voc.init(vec);
		expected = [55, 340, 400];
		voc.walk(vec).should.eql(expected);

		vec[2] = 4.0;
		voc.init(vec);
		expected = [75, 440, 480];
		voc.walk(vec).should.eql(expected);

		vec[0] = 3.0; vec[1] = 7.0; vec[2] = 4.0;
		voc.init(vec);
		expected = [70, 535, 575];
		voc.walk(vec).should.eql(expected);
	});
	it("should set voxel data at the right position with setVoxel", function() {
		var dv = voc.view;
		// this should make a tree going down to 0,0
		voc.setVoxel([0,0,0], {m:16});
		// look at the raw data, since we haven't yet tested getVoxel
		dv.getUint32(0).should.eql(40, "octant's pointer at depth 1 is pointing at the right offset");
		dv.getUint32(40).should.eql(80, "octant's pointer at depth 2 is pointing at the right offset");
		dv.getUint32(80).should.eql(120, "octant's pointer at depth 3 is pointing at the right offset");
		dv.getUint32(120).should.eql(160, "octant's pointer at depth 4 is pointing at the right offset");
		dv.getUint32(160).should.eql(200, "octant's pointer at depth 4 is pointing at the right offset");
		dv.getUint32(200).should.eql(0, "voxel's pointer value is correct");
		dv.getUint8(204).should.eql(16, "voxel's material value is correct");

		voc.setVoxel([1,0,0], {m:12});
		dv.getUint8(209).should.eql(12, "voxel's material value is correct");
	});
	it("should get and set voxels", function() {
		voc = new Voctopus(3, schema);
		var i = 0, count = 0, fy = () => i = 0;
		loop3D(voc.dimensions, {
			y:fy, z:(pos) => {
				voc.setVoxel(pos, {m:count});
				voc.getVoxel(pos).should.eql({m:count}, "expected voc at "+pos[0]+","+pos[1]+","+pos[2]+" m="+(count));
				if(count < 254) count++;
				else count = 0;
			}
		});
	});
	it("should write a full octet in one pass", function() {
		var dv = voc.view;
		var vec = Uint32Array.of(0,0,0);
		let index = voc.init(vec);
		let data = [{m:0},{m:1},{m:2},{m:3},{m:4},{m:5},{m:6},{m:7}];
		voc.setOctet(vec, data);
		for(let i = 0; i < 8; ++i) {
			dv.getUint8(index+4+voc.octantSize*i).should.eql(i);
		}
	});
});
