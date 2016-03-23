"use strict";
const {Voctopus} = require("./voctopus.core.js");
const schemas = require("./voctopus.schemas.js");
const loop3D = require("./voctopus.util.js").loop3D;

/* Setup */
const schemaList = ["RGBM", "I8M"];
const dmin = 4;
const dmax = 8;
var start, end, schema, i, voc, count, size, i, n, voxel, ptr;

/* util functions */
let fmt = (cellw, cells) => {
	return "| "+cells.map((cell) => ((" ").repeat(cellw)+cell).slice(-cellw))
				 .join(" | ")+" |";
}

// make table border
let border = (cellw, cells) => "+"+(("-").repeat(cellw+2)+"+").repeat(cells);

// range from a to b
let range = (a, b) => {
	let arr = [];
	for(let x = a; x <= b; x++) arr.push(x);
	return arr;
}

// make table
let table = (cellw, rows) => {
	let out = "";
	out += border(cellw, rows[0].length);
	out += "\n"+rows.map((row) => fmt(cellw, row)).join("\n");
	out += "\n"+border(cellw, rows[0].length);
	return out;
}
// shortcut for Date().getTime();
let time = () => new Date().getTime();

// calculate time elapsed
let elapsed = (start) => ((time()-start)/1000).toFixed(3)+"s";

// calculate octets in voctopus
let calcOctets = (voc) => {
	let usedBytes = voc.buffer.byteLength-(voc.buffer.byteLength-voc.nextOctet)-voc.octantSize;
	return usedBytes / voc.octetSize;
}

// bytes as mb
let inMB = (b) => (b/1024/1024).toFixed(3);

// loop3D y func resets i
let fy = () => i = 0;

// read object
let fzro = (pos) => {
	voxel = voc.getVoxel(pos);
	i++;
	count++;
}
// write object
let fzwo = (pos) => {
	voc.setVoxel(pos, {r:i,g:i+1,b:i+2,m:i+3});
	i++;
	count++;
}

// write raw
let fzwr = {
	RGBM: (pos) => {
		ptr = voc.traverse(pos, true);
		voc.set.r(ptr, 32);
		voc.set.g(ptr, 128);
		voc.set.b(ptr, 232);
		voc.set.m(ptr, i);
		i++;
		count++;
	},
	I8M: (pos) => {
		ptr = voc.traverse(pos, true);
		voc.set.m(ptr, i);
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
		voc.get.m(ptr);
		i++;
		count++;
	},
	I8M: (pos) => {
		ptr = voc.traverse(pos);
		voc.get.m(ptr);
		i++;
		count++;
	}
}

/* Begin Benchmarks */
for(n in schemaList) {
	let rows = [];
	let cells = [];
	let cellw = 8;
	schema = schemaList[n];
	console.log("\nSCHEMA "+schema);
	console.log("=================================================");

	/* Initialization benchmarks */ 
	rows.push(["Depth:"].concat(range(dmin, dmax)));
	for(let d = dmin; d <= dmax; ++d) {
		start = time();
		new Voctopus(d, schemas[schema]);
		end = time();
		cells.push(elapsed(start, end));
	}
	rows.push(["Init"].concat(cells));

	cells = [];
	/* Expansion benchmarks */
	for(let d = dmin; d <= dmax; ++d) {
		voc = new Voctopus(d, schemas[schema]);
		start = time();
		let res = 1;
		while(res) res = voc.expand();
		end = time();
		cells.push(elapsed(start, end));
	}
	rows.push(["Expand"].concat(cells));
	console.log(table(cellw, rows));

	/* Read/Write Benchmarks */
	rows = [];
	rows.push(["Read", "Write", "Depth", "Voxels", "Octets", "Memory"]);
	rows.push(["Object"].concat(new Array(5).fill(("-").repeat(cellw))));
	for(let d = 4; d < 8; ++d) {
		voc = new Voctopus(d, schemas[schema]);
		/* expand it first so it won't get slowed down arbitrarily */
		let res = 1;
		while(res) res = voc.expand();
		size = Math.pow(2, d - 1);

		count = 0;
		start = time();
		loop3D(size, {y:fy, z:fzwo});
		let read = elapsed(start);

		count = 0;
		start = time();
		loop3D(size, {y:fy, z:fzro});
		let write = elapsed(start);
		rows.push([read, write, d, count, calcOctets(voc), inMB(voc.view.byteLength)+"MB"]);
	}

	rows.push(["Direct"].concat(new Array(5).fill(("-").repeat(cellw))));
	for(let d = dmin; d < dmax; ++d) {
		voc = new Voctopus(d, schemas[schema]);
		/* expand it first so it won't get slowed down arbitrarily */
		let res = 1;
		while(res) res = voc.expand();
		size = Math.pow(2, d - 1);

		count = 0;
		start = time();
		loop3D(size, {y:fy, z:fzwr[schema]});
		end = time();
		let read = elapsed(start);

		count = 0;
		start = time();
		loop3D(size, {y:fy, z:fzrr[schema]});
		let write = elapsed(start);
		rows.push([read, write, d, count, calcOctets(voc), inMB(voc.view.byteLength)+"MB"]);
	}
	console.log(table(cellw, rows));
}
