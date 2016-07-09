"use strict";
require("should");
const {VoctopusKernel, VK_FO, VK_OS} = require("../src/voctopus.kernel.asm.js");
const Voctopus = require("../src/voctopus.core").Voctopus;
const {loop3D, npot, sump8} = require("../src/voctopus.util.js");
const max = Math.max;

describe("Voctopus", function() {
	var d, voc;
	const fo = VK_FO, os = VK_OS;
	beforeEach("set up a clean voctopus instance", function() {
		d = 5;
		voc = new Voctopus(d);
	});
	it("should expose expected interfaces", function() {
		voc.should.have.property("freedOctets");
		voc.should.have.property("nextOffset");
		voc.should.have.property("buffer");
		voc.should.have.property("depth");
		voc.should.have.property("maxSize");
		//voc.should.have.property("fields").eql(["m"]);
		(typeof(voc.get)).should.equal("function");
		(typeof(voc.set)).should.equal("function");
		(typeof(voc.getPointer)).should.equal("function");
		(typeof(voc.setPointer)).should.equal("function");
		(typeof(voc.getVoxel)).should.equal("function");
		(typeof(voc.setVoxel)).should.equal("function");
		(typeof(voc.allocateOctets)).should.equal("function");
		(typeof(voc.init)).should.equal("function");
		(typeof(voc.walk)).should.equal("function");
		(typeof(voc.expand)).should.equal("function");
	});
	it("should correctly calculate the maximum size for a Voctopus", function() {
		for(let i = 1; i < 9; ++i) {
			voc = new Voctopus(i);
			voc.maxSize.should.eql(npot(fo+sump8(i)));
		}
	});
	it("should correctly calculate the octree's dimensions", function() {
		for(var i = 1; i < 12; i++) {
			var voc = new Voctopus(i);
			voc.dimensions.should.eql(Math.pow(2, i));
		}
	});
	it("should initialize the root pointer to the correct offset", function() {
		var buf = new Uint32Array(voc.buffer);
		(buf[1]).should.eql(fo);
	});
	it("should correctly implement pointer getters and setters", function() {
		voc.setPointer(fo, fo+os);
		voc.getPointer(fo).should.eql(fo+os);
		voc.setPointer(fo+os, fo+os*2);
		voc.getPointer(fo+os).should.eql(fo+os*2);
	});
	it("should generate a buffer of the correct length", function() {
		// should make a buffer of max size if the max size is less than 73*octantSize
		let voc = new Voctopus(1);
		voc.buffer.byteLength.should.equal(max(0x10000, npot(fo+os*8)));
		voc = new Voctopus(2);
		voc.buffer.byteLength.should.equal(max(0x10000, npot(fo+os*8)));
		voc = new Voctopus(3);
		voc.buffer.byteLength.should.equal(max(0x10000, npot(fo+os*8)));
		// anything larger than this should start out at an eighth of the max size
		for(var i = 4; i < 10; i++) {
			voc = new Voctopus(i);
			voc.buffer.byteLength.should.eql(npot(max(0x10000, voc.maxSize/8)), "buffer is nearest power of two to one eighth of max length "+voc.maxSize);
		}
	});
	it("should expand the buffer using expand", function() {
		var i, voc, ms;
		for(i = 4; i < 8; i++) {
			voc = null;
			voc = new Voctopus(i);
			ms = voc.maxSize;
			voc.buffer.byteLength.should.equal(npot(max(0x10000, ~~(ms/8))));
			voc.expand();
			voc.buffer.byteLength.should.equal(npot(max(0x10000, ~~(ms/4))));
			voc.expand();
			voc.buffer.byteLength.should.equal(npot(max(0x10000, ~~(ms/2))));
			voc.expand();
			voc.buffer.byteLength.should.equal(npot(max(0x10000, ~~(ms))));
			voc.expand().should.be.false();
		}
	});
	it("should initialize a coordinate's branch to a given depth with init", function() {
		// use a smaller tree for these tests because it's less math to reason about
		let vec = Float32Array.of(0,0,0);
		let expected = [fo, fo+os, fo+os*2, fo+os*3, fo+os*4];
		// one at a time
		for(let i = 0; i < 5; ++i) {
			voc.init(vec, i).should.eql(expected[i]);
		}
		// now all at once
		voc = new Voctopus(3);
		voc.init(vec).should.eql(fo+os*3);

		vec[0] = 1.0;
		voc.init(vec).should.eql(fo+os*4);
		voc.init(vec).should.eql(fo+os*4);

		// check each depth level change
		vec[0] = 2.0;
		voc.init(vec).should.eql(fo+os*6);
		voc.init(vec).should.eql(fo+os*6);

		vec[0] = 4.0;
		voc.init(vec).should.eql(fo+os*9);
		voc.init(vec).should.eql(fo+os*9);

		vec[1] = 1.0;
		voc.init(vec).should.eql(fo+os*10);
		voc.init(vec).should.eql(fo+os*10);

		vec[1] = 2.0;
		voc.init(vec).should.eql(fo+os*12);
		voc.init(vec).should.eql(fo+os*12);

		vec[1] = 4.0;
		voc.init(vec).should.eql(fo+os*15);
		voc.init(vec).should.eql(fo+os*15);

		vec[2] = 2.0;
		voc.init(vec).should.eql(fo+os*17);
		voc.init(vec).should.eql(fo+os*17);

		vec[2] = 4.0;
		voc.init(vec).should.eql(fo+os*20);
		voc.init(vec).should.eql(fo+os*20);

		vec[0] = 3.0; vec[1] = 7.0; vec[2] = 4.0;
		voc.init(vec).should.eql(fo+os*23);
		voc.init(vec).should.eql(fo+os*23);

		voc = new Voctopus(5);
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
				voc.init(vec).should.eql(voc.nextOffset - os);
			}
		}});
	});
	it("should maintain integrity of the buffer during an expansion", function() {
		this.timeout(10000);
		var i, voc, size, index, count = 0, a, b, da, db;
		voc = new Voctopus(6);
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
		voc = new Voctopus(2);
		let vec = Float32Array.of(0,0,0);
		voc.walk(vec).should.eql([fo]);
		let expected = [fo, fo+os, fo+os*2];

		// now all at once
		voc.init(vec);
		voc.walk(vec).should.eql(expected);

		vec[0] = 1.0;
		voc.init(vec);
		expected = [fo, fo+os, fo+os*2];
		voc.walk(vec).should.eql(expected);

		// check each depth level change
		vec[0] = 2.0;
		voc.init(vec);
		expected = [fo, fo+os, fo+os*3];
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
		var i = 0, count = 0, fy = () => i = 0, out = Object.create(voc.voxel);
		loop3D(voc.dimensions, {
			y:fy, z:(pos) => {
				voc.setVoxel(pos, {m:count});
				voc.getVoxel(pos).should.eql({m:count}, "expected voc at "+pos[0]+","+pos[1]+","+pos[2]+" m="+(count));
				// using out param
				voc.getVoxel(pos, out).should.eql({m:count}, "expected voc at "+pos[0]+","+pos[1]+","+pos[2]+" m="+(count));
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
		voc.getOctet(vec).should.eql(data);
	});
	it("compute ray intersections", function() {
		let data = [{m:1},{m:1},{m:1},{m:1},{m:1},{m:1},{m:1},{m:1}];	
		let cb = function(t, p) {
			console.log(t);
			console.log(p);
			return 1;
		}
		voc.setOctet([0,0,0], data, 0);
		//voc.intersect([16,16,-32], [16,16,512], cb);
		//voc.intersect([16,16,-16], [0.0,0.0,1.0], cb);
		voc.intersect([16,16,-16], [0.0622573, 0.0622573, 0.996116], cb);
	});
});
