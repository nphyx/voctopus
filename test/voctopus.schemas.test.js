"use strict";
require("should");
const Voctopus = require("../src/voctopus.core").Voctopus;
const schemas = require("../src/voctopus.schemas.js");
const {loop3D} = require("../src/voctopus.util.js");

function checkProps(schema) {
	for(let prop of schema) {
		prop.should.have.property("label");
		prop.should.have.property("type");
		prop.type.should.have.property("get")
		prop.type.get.should.have.type("function");
		prop.type.should.have.property("set");
		prop.type.set.should.have.type("function");
		prop.type.should.have.property("length");
	}
}

describe("RGBM Schema", function() {
	var voc, schema = schemas.RGBM;
	it("should have the expected fields", function() {
		checkProps(schema);
		schema[0].label.should.eql("p");
		schema[1].label.should.eql("r");
		schema[2].label.should.eql("g");
		schema[3].label.should.eql("b");
		schema[4].label.should.eql("m");
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
		schema[0].label.should.eql("p");
		schema[1].label.should.eql("m");
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
describe("I16M16P Schema", function() {
	var voc, schema = schemas.I16M16P;
	it("should have the expected fields", function() {
		checkProps(schema);
		schema[0].label.should.eql("p");
		schema[1].label.should.eql("m");
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
describe("I8M16P Schema", function() {
	var voc, schema = schemas.I8M16P;
	it("should have the expected fields", function() {
		checkProps(schema);
		schema[0].label.should.eql("p");
		schema[1].label.should.eql("m");
	});
	it("should have the correct octant and octet size", function() {
		new Voctopus(1, schema).octantSize.should.eql(3);
		new Voctopus(1, schema).octetSize.should.eql(24);
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
describe("I32M32P Schema", function() {
	var voc, schema = schemas.I32M32P;
	it("should have the expected fields", function() {
		checkProps(schema);
		schema[0].label.should.eql("p");
		schema[1].label.should.eql("m");
	});
	it("should have the correct octant and octet size", function() {
		new Voctopus(1, schema).octantSize.should.eql(8);
		new Voctopus(1, schema).octetSize.should.eql(64);
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
describe("I8M24P Schema", function() {
	var voc, schema = schemas.I8M24P;
	it("should have the expected fields", function() {
		checkProps(schema);
		schema[0].label.should.eql("p");
		schema[1].label.should.eql("m");
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
