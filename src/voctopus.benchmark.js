"use strict";
const Voctopus = require("./voctopus.core.js").Voctopus;
const loop3D = require("./voctopus.util.js").loop3D;
// use a lot of globals because it has less impact on run time
const testList = ["voxel", "direct", "octet"];
var tmpvec = new Float32Array(3);
/* Setup */
const tests = {
	voxel:{
		read:(voc, pos, out) => voc.getVoxel(pos, out),
		write:(voc, pos, i) => voc.setVoxel(pos, {r:i,g:i+1,b:i+2,m:i+3})
	},
	direct:{
		read:(voc, pos, out) => {
			let ptr = voc.traverse(pos);
			out = voc.get(ptr); 
		},
		write:(voc, pos, i) => {
			let ptr = voc.init(pos);
			voc.set(ptr, i, i+1, i+2, i+3, i+4>>4);
		}
	},
	octet:{
		read: (voc, pos, out) => {
			tmpvec[0] = pos[0]*2; tmpvec[1] = pos[1]*2; tmpvec[2] = pos[2]*2;
			voc.getOctet(tmpvec, out);
		},
		write:(voc, pos, i) => {
			tmpvec[0] = pos[0]*2; tmpvec[1] = pos[1]*2; tmpvec[2] = pos[2]*2;
			let data = [
					{r:i+0,g:i+0,b:i+0,m:i+0},
					{r:i+1,g:i+1,b:i+1,m:i+1},
					{r:i+2,g:i+2,b:i+2,m:i+2},
					{r:i+3,g:i+3,b:i+3,m:i+3},
					{r:i+4,g:i+4,b:i+4,m:i+4},
					{r:i+5,g:i+5,b:i+5,m:i+5},
					{r:i+6,g:i+6,b:i+6,m:i+6},
					{r:i+7,g:i+7,b:i+7,m:i+7}
			];
			voc.setOctet(tmpvec, data);
		}
	}
}

/* util functions */
let fmt = (cellw, cells) => {
	return "|"+cells.map((cell) => ((" ").repeat(cellw)+cell).slice(-cellw))
				 .join("|")+"|";
}

// make table dividers
let divider = (cellw, cells) => cells.map((cell) => {
	switch(cell) {
		case "l": return ":"+(("-").repeat(cellw-2))+"-";
		case "r": return "-"+(("-").repeat(cellw-2))+":";
		case "c": return ":"+(("-").repeat(cellw-2))+":";
		default: return ("-").repeat(cellw);
	}
});

// range from a to b
let range = (a, b) => {
	let arr = [];
	for(let x = a; x <= b; x++) arr.push(x);
	return arr;
}

// make table
function table(cellw, rows) {
	let out = "";
	out += "\n"+rows.map((row) => fmt(cellw, row)).join("\n");
	return out;
}


// shortcut for Date().getTime();
let time = () => new Date().getTime();

// calculate time elapsed
let elapsed = (start) => (time()-start)/1000
let fmtTime = (time) => time.toFixed(3)+"s";

// timer wrapper
let stopwatch = (cb) => {
	let start = time();
	cb();
	return fmtTime(elapsed(start));
}

// calculate octets in voctopus
let calcOctets = (voc) => {
	let usedBytes = voc.buffer.byteLength-(voc.buffer.byteLength-voc.nextOffset);
	return ~~(usedBytes / voc.octetSize - 1);
}

// bytes as mb
let inMB = (b) => (b/1024/1024).toFixed(3);

/**
 * Iterate through dmin to dmax, calling callback and putting the result in an array.
 * @param {int} dmin start iteration at 
 * @param {int} dmax stop iteration at
 * @param {function} cb callback
 * @return {array}
 */
let iterd = (dmin, dmax, cb) => {
	let results = [];
	for(let d = dmin; d <= dmax; ++d) {
		results.push(cb(d));
	}
	return results;
}

function cbInst(d) {
	return stopwatch(() => new Voctopus(d));
}

function cbExpand(d) {
	let voc = new Voctopus(d);
	return stopwatch(() => {
		let res = 1;
		while(res) res = voc.expand();
	});
}

function cbInit(d) {
	let voc = new Voctopus(d);
	let size = Math.pow(2, d - 1);
	let start = time();
	loop3D(size, {z:(pos) => voc.init(pos)});
	return fmtTime(elapsed(start));
}

function cbWalk(d) {
	let voc = new Voctopus(d);
	let size = Math.pow(2, d - 1);
	let start = time();
	loop3D(size, {z:(pos) => voc.walk(pos, true)});
	return fmtTime(elapsed(start));
}

function loop(voc, read, write, dims, out) {
	var start, rtime, wtime, i = 0, count = 0;
	var pos = new Uint32Array(3);

	start = time();
	for(pos[0] = 0; pos[0] < dims; ++pos[0]) {
		for(pos[1] = 0; pos[1] < dims; ++pos[1]) {
			i = 0;
			for(pos[2] = 0; pos[2] < dims; ++pos[2]) {
				write(voc, pos, i);
				++i;
				++count;
			}
		}
	}
	wtime = elapsed(start);

	start = time();
	for(pos[0] = 0; pos[0] < dims; ++pos[0]) {
		for(pos[1] = 0; pos[1] < dims; ++pos[1]) {
			for(pos[2] = 0; pos[2] < dims; ++pos[2]) {
				read(voc, pos, out);
			}
		}
	}
	rtime = elapsed(start);
	return {rtime, wtime, count};
}

function testMem(d) {
	var voc = new Voctopus(d);
	var out = [
		Object.create(voc.voxel),
		Object.create(voc.voxel),
		Object.create(voc.voxel),
		Object.create(voc.voxel),
		Object.create(voc.voxel),
		Object.create(voc.voxel),
		Object.create(voc.voxel),
		Object.create(voc.voxel)
	];

	var {rtime, wtime, count} = loop(voc, tests.octet.read, tests.octet.write, voc.dimensions/2, out);

	// fudge for octet test
	count *= 8;
	return [d, voc.dimensions+"^3", fmtTime(rtime), fmtTime(wtime), count, calcOctets(voc), inMB(voc.view.byteLength)+"MB"];
}

function testRW(testName, d) {
	var voc = new Voctopus(d);
	var res = 1, dims, out;
	// expand it first so it won't get slowed down arbitrarily
	while(res) res = voc.expand();
	if(testName == "octet") {
		dims = Math.ceil(voc.dimensions/2);
		out = [
			Object.create(voc.voxel),
			Object.create(voc.voxel),
			Object.create(voc.voxel),
			Object.create(voc.voxel),
			Object.create(voc.voxel),
			Object.create(voc.voxel),
			Object.create(voc.voxel),
			Object.create(voc.voxel)
		];
	}
	else {
		dims = voc.dimensions;
		out = Object.create(voc.voxel);
	}
	var {rtime, wtime, count} = loop(voc, tests[testName].read, tests[testName].write, dims, out);

	// fudge for octet test
	if(testName == "octet") {
		count *= 8;
		dims *= 2;
	}
	return [testName, fmtTime(rtime), fmtTime(wtime), Math.round((1/rtime)*count), Math.round((1/wtime)*count), dims+"^3", count];
}

function benchmark() {
	let cellw = 8, i = 0, rows = [], depth = 8;
	console.log("\nBEGIN BENCHMARK");
	console.log(  "===============");
	// Initialization benchmarks  
	console.log("\nInitialization Tests\n--------------------");
	rows.push(["Depth"].concat(range(3, depth)));
	rows.push(divider(cellw, new Array(depth-1).fill("r")));
	rows.push(["Create"].concat(iterd(3, depth, cbInst.bind(null))));
	rows.push(["Expand"].concat(iterd(3, depth, cbExpand.bind(null))));
	rows.push(["Init"].concat(iterd(3, depth, cbInit.bind(null))));
	rows.push(["Walk"].concat(iterd(3, depth, cbWalk.bind(null))));
	console.log(table(cellw, rows));

	const doTest = (testName) => rows.push(testRW(testName, depth));
	// Read/Write Benchmarks 
	console.log("\nR/W Tests Depth "+depth)
	console.log(  "-----------------");
	rows = [];
	rows.push(["Type", "Read", "Write", "R/s", "W/s", "Dims", "Voxels"]);
	rows.push(divider(cellw, ["r","r","r","r","r","r","r"]));
	testList.forEach(doTest);
	console.log(table(cellw, rows));

	console.log("\nMemory Tests\n------------");
	rows = [];
	rows.push(["Depth", "Dims", "Read", "Write", "Voxels", "Octets", "Memory"]);
	rows.push(divider(cellw, ["c","r","r","r","r","r","r"]));

	i = 5;
	for(let max = depth; i <= max; ++i) {
		rows.push(testMem(i));
	}
	console.log(table(cellw, rows));
}

console.log(`
Benchmarks
==========
This page includes some benchmarks run against the current version of Voctopus.
They're useful as a way to measure the impact of code changes. A brief
description of each test suite follows.

Init Tests
----------
These benchmarks cover certain maintenance operations:
* Create: the time it takes to instantiate a new Voctopus
* Expand: how long it takes to expand a buffer to maximum size 
* Init: the total time to initialize every voxel in the octree to full depth
* Walk: the total time to walk to each voxel in the tree

R/W Tests
---------
These tests measure how long reads and writes take using different interfaces. The
octree is expanded to full size so that expansions won't interrupt r/w.

* *Object*: how long it takes to read/write using the getVoxel and setVoxel methods
* *Direct*: time to read/write using the direct getter/setter methods (Voc.set[field])
* *Octet*: time to read/write using the octet batch write (Voc.set[field])

Memory Tests
------------
These tests measure r/w speeds without expansion, and how much memory is consumed
by Voctopus' on-demand buffer expansion. The direct-write interfaces are used here.
`);

benchmark();
