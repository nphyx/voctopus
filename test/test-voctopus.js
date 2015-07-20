"use strict";
require("should");
var Voctopus = require("../src/voctopus");

describe("voctopus", function() {
	var voc = new Voctopus(5);
	it("should yield expected octet ids", function () {
		// always 0 at depth 0
		voc.octId([5,5,5], 0).should.equal(0);
		voc.octId([5,5,5], 0).should.equal(0);
		voc.octId([5,5,5], 0).should.equal(0);
		voc.octId([5,5,5], 0).should.equal(0);

		// at depth 1, should get 1-8
		voc.octId([ 0, 0, 0], 0).should.equal(1);
		voc.octId([16, 0, 0], 0).should.equal(2);
		voc.octId([ 0,16, 0], 0).should.equal(3);
		voc.octId([16,16, 0], 0).should.equal(4);
		voc.octId([ 0, 0,16], 0).should.equal(5);
		voc.octId([16, 0,16], 0).should.equal(6);
		voc.octId([ 0,16,16], 0).should.equal(7);
		voc.octId([16,16,16], 0).should.equal(8);
	});
});
