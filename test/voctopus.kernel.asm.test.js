"use strict";
require("should");
const {VoctopusKernel, VK_FO, VK_OS} = require("../src/voctopus.kernel.asm.js");
describe("the voctopus 32-bit kernel", function() {
	var vk, buffer, view;
	beforeEach(function() {
		buffer = new ArrayBuffer(0x10000);
		view = new Uint32Array(buffer);
		vk = new VoctopusKernel(buffer, 5);
	});
	it("should have set up its initial values", function() {
		view[0].should.eql(5);
		view[1].should.eql(VK_FO);
		view[2].should.eql(VK_FO+VK_OS);
	});
	it("should implement depth functions", function() {
		var {getCurrentDepth, getMaxDepth, setCurrentDepth, incrementCurrentDepth} = vk;
		getMaxDepth().should.eql(5);
		for(let i = 0; i < 5; i++) {
			setCurrentDepth(i);
			getCurrentDepth().should.eql(i);
		}
		setCurrentDepth(0);
		for(let i = i; i < 6; i++) {
			incrementCurrentDepth();
			getCurrentDepth().should.eql(i);
		}
	});
	it("should implement offset functions", function() {
		var {getFirstOffset, setFirstOffset, getNextOffset, setNextOffset} = vk;
		getFirstOffset().should.eql(VK_FO);
		getNextOffset().should.eql(VK_FO+VK_OS);
		setFirstOffset(124);
		getFirstOffset().should.eql(124);
		setNextOffset(132);
		getNextOffset().should.eql(132);
	});
	it("should allocate octets", function() {
		var {getNextOffset, allocateOctet} = vk, n = VK_FO+VK_OS;
		for(let i = 0; i < 256; i++) {
			allocateOctet().should.eql(n);
			n += VK_OS;
			getNextOffset().should.eql(n);
		}
	});
	it("should be able to test whether a number is an encoded pointer", function() {
		var isP = vk.isP;
		for(let i = 0; i < 2048; i++) {
			isP(i).should.eql(i % 2); // only odd numbers should be treated as pointers
		}
	});
	it("should encode pointers correctly", function() {
		var makeP = vk.makeP;
		for(let i = 0; i < 2048; i++) {
			makeP(i).should.eql(i << 1 | 1);
		}
	});
	it("should decode pointers correctly", function() {
		var {makeP, pFrom} = vk;
		for(let i = 0; i < 2048; i++) {
			pFrom(makeP(i)).should.eql(i);
		}
		for(let i = 0; i < 2048; i+=2) {
			pFrom(i).should.eql(0);
		}
	});
	it("should set pointers", function() {
		const {setP, makeP, isP, pFrom} = vk;
		for(let i = VK_FO; i < 256+VK_FO; ++i) {
			setP(i, i+1);
			view[i].should.eql(makeP(i+1));
		}
		let n = makeP(VK_FO), i = 0;
		while(isP(n)) {
			n = view[pFrom(n)];
			i++;
		}
		// should loop 256 times, then count one extra
		i.should.eql(257);
	});
	it("should read decoded pointers", function() {
		const {setP, getP} = vk;
		for(let i = VK_FO; i < 256+VK_FO; ++i) {
			setP(i, i+1);
		}
		let n = VK_FO, i = 0;
		while(n) {
			n = getP(n);
			i++;
		}
		// should loop 256 times, then count one extra
		i.should.eql(257);
	});
	it("should encode red channels", function() {
		var valFromRGBA = vk.valFromRGBA;
		for(let i = 0; i < 256; i++) {
			valFromRGBA(i, 0, 0, 0).should.eql(i << 24);
		}
	});
	it("should encode green channels", function() {
		var valFromRGBA = vk.valFromRGBA;
		for(let i = 0; i < 256; i++) {
			valFromRGBA(0, i, 0, 0).should.eql(i << 16);
		}
	});
	it("should encode blue channels", function() {
		var valFromRGBA = vk.valFromRGBA;
		for(let i = 0; i < 256; i++) {
			valFromRGBA(0, 0, i, 0).should.eql(i << 8);
		}
	});
	it("should encode alpha channels", function() {
		var valFromRGBA = vk.valFromRGBA;
		for(let i = 1; i < 16; i++) {
			valFromRGBA(0, 0, 0, i).should.eql(i << 4);
		}
	});
	it("should decode rgba data", function() {
		var rgba;
		var {valFromRGBA, rFrom, gFrom, bFrom, aFrom} = vk;
		for(let i = 1; i < 16; i++) {
			rgba = valFromRGBA(i << 3, i << 2, i << 1, i);
			rFrom(rgba).should.eql(i << 3);
			gFrom(rgba).should.eql(i << 2);
			bFrom(rgba).should.eql(i << 1);
			aFrom(rgba).should.eql(i);
		}
		for(let i = 0; i < 256; i++) {
			rgba = valFromRGBA(i, i, i, 15);
			rFrom(rgba).should.eql(i);
			gFrom(rgba).should.eql(i);
			bFrom(rgba).should.eql(i);
			aFrom(rgba).should.eql(15);
		}
	});
	it("should find octant identities", function() {
		const {prepareLookup, setCurrentDepth, octantIdentity} = vk;
		var d = 5;
		var i;
		function check(x, y, z, td, cd, expected) {
			prepareLookup(x, y, z, td);
			setCurrentDepth(cd);
			octantIdentity().should.equal(expected);
		}
		// These should have the same identity at any depth
		for(i = 0; i < d; ++i) {
			check( 0, 0, 0, 0, d, 0);
			check(31, 0, 0, 0, d, 1);
			check( 0,31, 0, 0, d, 2);
			check(31,31, 0, 0, d, 3);
			check( 0, 0,31, 0, d, 4);
			check(31, 0,31, 0, d, 5);
			check( 0,31,31, 0, d, 6);
			check(31,31,31, 0, d, 7);
		}
		for(i = 1; i < d; ++i) {
			check( 0, 0, 0, 0, d, 0);
			check(15, 0, 0, 0, d, 1);
			check( 0,15, 0, 0, d, 2);
			check(15,15, 0, 0, d, 3);
			check( 0, 0,15, 0, d, 4);
			check(15, 0,15, 0, d, 5);
			check( 0,15,15, 0, d, 6);
			check(15,15,15, 0, d, 7);
		}
		for(i = 2; i < d; ++i) {
			check( 0, 0, 0, 0, d, 0);
			check( 7, 0, 0, 0, d, 1);
			check( 0, 7, 0, 0, d, 2);
			check( 7, 7, 0, 0, d, 3);
			check( 0, 0, 7, 0, d, 4);
			check( 7, 0, 7, 0, d, 5);
			check( 0, 7, 7, 0, d, 6);
			check( 7, 7, 7, 0, d, 7);
		}
		for(i = 3; i < d; ++i) {
			check( 0, 0, 0, 0, d, 0);
			check( 3, 0, 0, 0, d, 1);
			check( 0, 3, 0, 0, d, 2);
			check( 3, 3, 0, 0, d, 3);
			check( 0, 0, 3, 0, d, 4);
			check( 3, 0, 3, 0, d, 5);
			check( 0, 3, 3, 0, d, 6);
			check( 3, 3, 3, 0, d, 7);
		}
		check( 0, 0, 0, 0, 5, 0);
		check( 1, 0, 0, 0, 5, 1);
		check( 0, 1, 0, 0, 5, 2);
		check( 1, 1, 0, 0, 5, 3);
		check( 0, 0, 1, 0, 5, 4);
		check( 1, 0, 1, 0, 5, 5);
		check( 0, 1, 1, 0, 5, 6);
		check( 1, 1, 1, 0, 5, 7);
	});
	it("should find an octant's pointer given its vector, depth and the pointer to its octet", function() {
		const {prepareLookup, octantPointer, getP, setP, allocateOctet, setCurrentDepth, setCurrentPointer} = vk;
		let c = VK_FO, p = 0;
		for(let i = 0; i < 5; i++) {
			p = allocateOctet();
			setP(c+7, p);
			c = p;
		}
		prepareLookup(31, 31, 31, 0);
		setCurrentDepth(1);
		p = VK_FO;
		for(let i = 1; i < 6; i++) {
			setCurrentPointer(p);
			setCurrentDepth(i);
			p = getP(octantPointer());
			p.should.eql(VK_FO+i*8);
		}
	});
	it("should traverse the octree given a vector and target depth", function() {
		const {allocateOctet, valFromRGBA, prepareLookup, setP, setOctant, 
		       traverse, rFrom, gFrom, bFrom, aFrom, getCurrentDepth} = vk;
		let c = VK_FO, p = 0, res = 0;

		// with deeper pointers unset, traverse should return after one iteration
		prepareLookup(31, 31, 31, 5);
		res = traverse();
		getCurrentDepth().should.eql(1);
		res.should.eql(0);

		// setup pointers
		for(let i = 0; i < 4; i++) {
			p = allocateOctet();
			setP(c+7, p);
			c = p;
		}
		setOctant(c+7, valFromRGBA(244,213,112,15));

		// full depth walk to target
		for(let i = 1; i < 4; i++) {
			prepareLookup(31,31,31,i);
			res = traverse();
			res.should.eql(VK_FO+VK_OS*i);
			getCurrentDepth().should.eql(i);
		}

		// read octant at lowest depth
		prepareLookup(31, 31, 31, 5);
		res = traverse();
		getCurrentDepth().should.eql(5);
		rFrom(res).should.eql(244);
		gFrom(res).should.eql(213);
		bFrom(res).should.eql(112);
		aFrom(res).should.eql(15);
	});
	it("should initialize an octet at a given depth", function() {
		const {getCurrentDepth, traverse, prepareLookup, initOctet} = vk;
		let res = 0;
		// do it one step at a time
		for(let i = 0; i < 5; i++) {
			prepareLookup(1, 7, 3, i);
			initOctet().should.eql(VK_FO+VK_OS*i);
			getCurrentDepth().should.eql(i);
		}
		let start = VK_FO+VK_OS*4;
		// do it again with another coordinate 
		prepareLookup(15,31,17,4);
		initOctet().should.eql(VK_FO+VK_OS*8);
		for(let i = 1; i < 5; i++) {
			prepareLookup(15,31,17,i);
			res = traverse();
			res.should.eql(start+VK_OS*i);
			getCurrentDepth().should.eql(i);
		}
	});
});
