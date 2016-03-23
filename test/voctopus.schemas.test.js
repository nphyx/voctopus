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

describe("RGM Schema", function() {
	var voc, schema = schemas.RGBM;
	it("should have the expected fields", function() {
		checkProps(schema);
		schema[0].label.should.eql("r");
		schema[1].label.should.eql("g");
		schema[2].label.should.eql("b");
		schema[3].label.should.eql("m");
		schema[4].label.should.eql("p");
	});
	it("should get and set voxels", function() {
		this.timeout(3000);
		var size, i, index, count = 0, fy = () => i = 0;
		voc = new Voctopus(5, schema);
		size = Math.pow(2, voc.depth - 1);
		loop3D(size, {
			y:fy, z:(pos) => { 
				index = voc.setVoxel(pos, {r:i,g:i+1,b:i+2,m:i+3});
				i++;
				count++; 
			}
		});
		loop3D(size, {
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
	it("should get and set voxels", function() {
		this.timeout(10000);
		var size, i, index, count = 0, fy = () => i = 0;
		voc = new Voctopus(5, schema);
		size = Math.pow(2, voc.depth - 1);
		loop3D(size, {
			y:fy, z:(pos) => { 
				index = voc.setVoxel(pos, {m:i});
				i++;
				count++; 
			}
		});
		loop3D(size, {
			y:fy, z:(pos) => { 
				voc.getVoxel(pos).m.should.eql(i);
				i++;
			}
		});
	});
});
