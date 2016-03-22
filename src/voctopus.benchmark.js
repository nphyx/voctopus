"use strict";
const {Voctopus} = require("./voctopus.core.js");
const schemas = require("./voctopus.schemas.js");
const loop3D = require("./voctopus.util.js").loop3D;

/* Setup */
const schemaList = ["RGBM", "I8M"];
var start, end, schema, i, voc, count, size, i, n, voxel;

/* util functions */
let calcTime = (start, end) =>  ((end-start)/1000).toFixed(3)+"s";
let inMB = (b) => (b/1024/1024).toFixed(3);
let time = () => new Date().getTime();
let fy = () => i = 0;
let fzr = (pos) => {
	voxel = voc.getVoxel(pos);
	i++;
	count++;
}
let fzw = (pos) => {
	voc.setVoxel(pos, {r:i,g:i+1,b:i+2,material:i+3});
	i++;
	count++;
}

/* Begin Benchmarks */
for(n in schemaList) {
	schema = schemaList[n];
	console.log("SCHEMA "+schema);
	console.log("=================================================");

	/* Initialization benchmarks */ 
	for(let d = 4; d < 10; ++d) {
		start = time();
		new Voctopus(d, schemas[schema]);
		end = time();
		console.log("Time to initialize at depth", d+":", calcTime(start, end));
	}
	console.log("");

	/* Expansion benchmarks */
	for(let d = 5; d < 9; ++d) {
		voc = new Voctopus(d, schemas[schema]);
		start = time();
		let res = 1;
		while(res) res = voc.expand();
		end = time();
		console.log("Time to expand at depth", d+":", calcTime(start, end));
	}
	console.log("");

	/* Read/Write Benchmarks */
	for(let d = 5; d < 8; ++d) {
		voc = new Voctopus(d, schemas[schema]);
		/* expand it first so it won't get slowed down arbitrarily */
		let res = 1;
		while(res) res = voc.expand();
		size = Math.pow(2, d - 1);

		count = 0;
		start = time();
		loop3D(size, {
			y:fy, 
			z:fzw
		});
		end = time();
		let mem = inMB(voc.view.byteLength);
		console.log("Write: depth "+d+", time: "+calcTime(start, end)+", total voxels: "+count+", memory: "+mem+"MB");

		count = 0;
		start = time();
		loop3D(size, {
			y:fy, 
			z:fzr
		});
		end = time();
		console.log("Read:  depth "+d+", time: "+calcTime(start, end)+", total voxels: "+count+", memory: "+mem+"MB");
	}
	console.log("");
}
