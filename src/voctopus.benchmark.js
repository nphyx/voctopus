"use strict";
const {Voctopus} = require("./voctopus.core.js");
const schemas = require("./voctopus.schemas.js");
const loop3D = require("./voctopus.util.js").loop3D;

/* Setup */
const schemaList = ["RGBM", "I8M"];
var start, end, schema, i, voc, count, size, i, n, voxel, ptr, pos = new Float32Array(3);

/* util functions */
let calcTime = (start, end) =>  ((end-start)/1000).toFixed(3)+"s";
let inMB = (b) => (b/1024/1024).toFixed(3);
let time = () => new Date().getTime();
let fy = () => i = 0;

// read object
let fzro = (pos) => {
	voxel = voc.getVoxel(pos);
	i++;
	count++;
}
// write object
let fzwo = (pos) => {
	voc.setVoxel(pos, {r:i,g:i+1,b:i+2,material:i+3});
	i++;
	count++;
}

// write raw
let fzwr = {
	RGBM: (pos) => {
		ptr = voc.traverse(pos);
		voc.set.r(ptr, 32);
		voc.set.g(ptr, 128);
		voc.set.b(ptr, 232);
		voc.set.material(ptr, i);
		i++;
		count++;
	},
	I8M: (pos) => {
		ptr = voc.traverse(pos);
		voc.set.material(ptr, i);
		i++;
		count++;
	}
}

// read raw
let fzrr = {
	RGBM: (pos) => {
		ptr = voc.traverse(pos);
		voc.get.r(ptr);
		voc.get.g(ptr);
		voc.get.b(ptr);
		voc.get.material(ptr);
		i++;
		count++;
	},
	I8M: (pos) => {
		ptr = voc.traverse(pos);
		voc.get.material(ptr);
		i++;
		count++;
	}
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
	for(let d = 4; d < 9; ++d) {
		voc = new Voctopus(d, schemas[schema]);
		start = time();
		let res = 1;
		while(res) res = voc.expand();
		end = time();
		console.log("Time to expand at depth", d+":", calcTime(start, end));
	}
	console.log("");

	/* Read/Write Benchmarks */
	console.log("R/W with object interface\n");
	for(let d = 4; d < 8; ++d) {
		voc = new Voctopus(d, schemas[schema]);
		/* expand it first so it won't get slowed down arbitrarily */
		let res = 1;
		while(res) res = voc.expand();
		size = Math.pow(2, d - 1);

		count = 0;
		start = time();
		loop3D(size, {
			y:fy, 
			z:fzwo
		});
		end = time();
		let mem = inMB(voc.view.byteLength);
		console.log("Write: depth "+d+", time: "+calcTime(start, end)+", total voxels: "+count+", memory: "+mem+"MB");

		count = 0;
		start = time();
		loop3D(size, {
			y:fy, 
			z:fzro
		});
		end = time();
		console.log("Read:  depth "+d+", time: "+calcTime(start, end)+", total voxels: "+count+", memory: "+mem+"MB");
	}
	console.log("");
	console.log("R/W with direct interface\n");
	for(let d = 4; d < 8; ++d) {
		voc = new Voctopus(d, schemas[schema]);
		/* expand it first so it won't get slowed down arbitrarily */
		let res = 1;
		while(res) res = voc.expand();
		size = Math.pow(2, d - 1);

		count = 0;
		start = time();
		loop3D(size, {
			y:fy, 
			z:fzwr[schema]
		});
		end = time();
		let mem = inMB(voc.view.byteLength);
		console.log("Write: depth "+d+", time: "+calcTime(start, end)+", total voxels: "+count+", memory: "+mem+"MB");

		count = 0;
		start = time();
		loop3D(size, {
			y:fy, 
			z:fzrr[schema]
		});
		end = time();
		console.log("Read:  depth "+d+", time: "+calcTime(start, end)+", total voxels: "+count+", memory: "+mem+"MB");
	}
	console.log("");
}
