"use strict";
require("should");
const Voctopus = require("../src/voctopus.core").Voctopus;
const schemas = require("../src/voctopus.schemas.js");
const {loop3D} = require("../src/voctopus.util.js");

function checkProps(schema) {
	for(let prop of schema) {
		prop.should.have.property("label");
		prop.should.have.property("offset");
		prop.should.have.property("length");
	}
}

describe("RGBM Schema", function() {
	var voc, schema = schemas.RGBM;
	it("should have the expected fields", function() {
		checkProps(schema);
		schema[0].label.should.eql("r");
		schema[1].label.should.eql("g");
		schema[2].label.should.eql("b");
		schema[3].label.should.eql("m");
		schema[4].label.should.eql("p");
	});
	it("should have the correct octant and octet size", function() {
		new Voctopus(1, schema).octantSize.should.eql(8);
		new Voctopus(1, schema).octetSize.should.eql(64);
	});
	it("should get and set voxels", function() {
		this.timeout(3000);
		var i, index, count = 0, fy = () => i = 0;
		voc = new Voctopus(3, schema);
		loop3D(voc.dimensions, {
			y:fy, z:(pos) => { 
				index = voc.setVoxel(pos, {r:i,g:i+1,b:i+2,m:i+3});
				i++;
				count++; 
			}
		});
		loop3D(voc.dimensions, {
			y:fy, z:(pos) => { 
				voc.getVoxel(pos).should.eql({r:i, g:i+1, b:i+2, m:i+3});
				i++;
			}
		});
	});
});
describe("I8M24P Schema", function() {
	var voc, schema = schemas.I8M24P;
	it("should have the expected fields", function() {
		checkProps(schema);
		schema[0].label.should.eql("m");
		schema[1].label.should.eql("p");
	});
	it("should have the correct octant and octet size", function() {
		new Voctopus(1, schema).octantSize.should.eql(4);
		new Voctopus(1, schema).octetSize.should.eql(32);
	});
	it("should get and set voxels", function() {
		this.timeout(10000);
		var i, index, count = 0, fy = () => i = 0;
		voc = new Voctopus(3, schema);
		loop3D(voc.dimensions, {
			y:fy, z:(pos) => { 
				index = voc.setVoxel(pos, {m:i});
				i++;
				count++; 
			}
		});
		loop3D(voc.dimensions, {
			y:fy, z:(pos) => { 
				voc.getVoxel(pos).m.should.eql(i);
				i++;
			}
		});
	});
});
