"use strict";
require("should");
const util = require("../src/voctopus.util.js");
const {DataView, sump8, maxOctreeSize, npot} = util;

describe("The extended DataView", function() {
	xit("should implement Uint24 accessors", function() {
		this.timeout(10000);
		var i, n, buf, dv;
		buf = new ArrayBuffer(3);
		dv = new ExtDV(buf);
		n = Math.pow(2, 24);
		// this should give us decent coverage without trying every single number
		for(i = 1; i < n; i += 111) {
			dv.setUint24(0, i);
			dv.getUint24(0).should.equal(i);
		}
	});
});

