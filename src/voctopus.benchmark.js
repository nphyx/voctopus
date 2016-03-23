"use strict";
const Voctopus = require("./voctopus.core.js").Voctopus;
const VoctopusSchemas = require("./voctopus.schemas.js");
const loop3D = require("./voctopus.util.js").loop3D;
// use a lot of globals because it has less impact on run time
const testList = ["object", "direct"];

const readObj = (voc, pos) => voc.getVoxel(pos);
/* Setup */
const schemaList = [
	{name:"RGBM", dmin:4, dmax:8, tests:{
		object:{
			read:readObj,
			write:(voc, pos, i) => voc.setVoxel(pos, {r:i,g:i+1,b:i+2,m:i+3})
		},
		direct:{
			read:(voc, pos, i) => {
				let ptr = voc.traverse(pos, true);
				voc.get.r(ptr, i);
				voc.get.g(ptr, i+1);
				voc.get.b(ptr, i+2);
				voc.get.m(ptr, i+3);
			},
			write:(voc, pos, i) => {
				let ptr = voc.traverse(pos, true);
				voc.set.r(ptr, i);
				voc.set.g(ptr, i+1);
				voc.set.b(ptr, i+2);
				voc.set.m(ptr, i+3);
			}
		}
	}}, 
	{name:"I8M24P", dmin:4, dmax:8, tests:{
		object:{
			read:readObj,
			write:(voc, pos, i) => voc.setVoxel(pos, {m:i})
		},
		direct:{
			read:(voc, pos, i) => {
				let ptr = voc.traverse(pos, true);
				voc.get.m(ptr, i);
			},
			write:(voc, pos, i) => {
				let ptr = voc.traverse(pos, true);
				voc.set.m(ptr, i);
			}
		}
	}},
	{name:"I8M16P", dmin:3, dmax:6, tests:{
		object:{
			read:readObj,
			write:(voc, pos, i) => voc.setVoxel(pos, {m:i})
		},
		direct:{
			read:(voc, pos, i) => {
				let ptr = voc.traverse(pos, true);
				voc.get.m(ptr, i);
			},
			write:(voc, pos, i) => {
				let ptr = voc.traverse(pos, true);
				voc.set.m(ptr, i);
			}
		}
	}}
];

/* util functions */
let fmt = (cellw, cells) => {
	return "|"+cells.map((cell) => ((" ").repeat(cellw)+cell).slice(-cellw))
				 .join("|")+"|";
}

// make table border
//let border = (cellw, cells) => "+"+(("-").repeat(cellw+2)+"+").repeat(cells);
//

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
let elapsed = (start) => ((time()-start)/1000).toFixed(3)+"s";

// timer wrapper
let stopwatch = (cb) => {
	let start = time();
	cb();
	return elapsed(start);
}

// calculate octets in voctopus
let calcOctets = (voc) => {
	let usedBytes = voc.buffer.byteLength-(voc.buffer.byteLength-voc.nextOctet)-voc.octantSize;
	return usedBytes / voc.octetSize;
}

// bytes as mb
let inMB = (b) => (b/1024/1024).toFixed(3);

// loop3D y func resets i
let fy = (i) => i = 0;



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

function cbInit(schema, d) {
	return stopwatch(() => new Voctopus(d, VoctopusSchemas[schema.name]));
}

function cbExpand(schema, d) {
	return stopwatch(() => {
		let voc = new Voctopus(d, VoctopusSchemas[schema.name]);
		let res = 1;
		while(res) res = voc.expand();
	});
}

function testRW(testName, schema, d, expand = true) {
	let start, rtime, wtime;
	let i = 0, count = 0;
	let voc = new Voctopus(d, VoctopusSchemas[schema.name]);
	let schemaTests = schema.tests[testName];
	let write = schemaTests.write.bind(null, voc);
	let cbw = (pos) => {
		write(pos, i);
		++i;
		++count;
	}
	let cbr = schemaTests.read.bind(null, voc);
	if(expand) {
		// expand it first so it won't get slowed down arbitrarily
		let res = 1;
		while(res) res = voc.expand();
	}
	let size = Math.pow(2, d - 1);
	start = time();
	loop3D(size, {y:fy, z:cbw});
	wtime = elapsed(start);
	start = time();
	loop3D(size, {y:fy, z:cbr});
	rtime = elapsed(start);
	return [d, rtime, wtime, count, calcOctets(voc), inMB(voc.view.byteLength)+"MB"];
}

function benchmark(schema) {
	let cellw = 8;
	let {name, dmin, dmax} = schema;
	let d = dmin;
	console.log("\nSCHEMA "+name);
	console.log("======="+("=").repeat(name.length));
	// Initialization benchmarks  
	let rows = [];
	console.log("\nInitialization Tests\n--------------------");
	rows.push(["Depth"].concat(range(dmin, dmax)));
	rows.push(divider(cellw, new Array(dmax-dmin+2).fill("r")));
	rows.push(["Init"].concat(iterd(dmin, dmax, cbInit.bind(null, schema))));
	rows.push(["Expand"].concat(iterd(dmin, dmax, cbExpand.bind(null, schema))));
	console.log(table(cellw, rows));

	// Read/Write Benchmarks 
	console.log("\nR/W Tests\n---------");
	rows = [];
	rows.push(["Depth", "Read", "Write", "Voxels", "Octets", "Memory"]);
	rows.push(divider(cellw, ["c","r","r","r","r","r"]));
	testList.forEach((testName) => {
		d = dmin;
		rows.push(["*"+testName+"*"].concat(new Array(5).fill((" ").repeat(cellw))));
		for(let max = dmax; d <= max; ++d) {
			rows.push(testRW(testName, schema, d));
		}
	});

	console.log(table(cellw, rows));
	console.log("\nMemory Tests\n------------");
	rows = [];
	rows.push(["Depth", "Read", "Write", "Voxels", "Octets", "Memory"]);
	rows.push(divider(cellw, ["c","r","r","r","r","r"]));
	d = dmin;
	for(let max = dmax; d <= max; ++d) {
		rows.push(testRW("direct", schema, d, false));
	}
	console.log(table(cellw, rows));
}

console.log(`
Benchmarks
==========
This page includes some benchmarks run against the current version of Voctopus.
They're useful for comparing the performance and memory use characteristics of
different schemas, and as a way to measure the impact of code changes. A brief
description of each test suite follows.

Init Tests
----------
These tests cover the time it takes to initialize a new Voctopus, and how long
it takes to expand it to full size.

R/W Tests
---------
These tests measure how long reads and writes take using different interfaces. The
octree is expanded to full size so that expansions won't interrupt r/w.

* *Object*: how long it takes to read/write using the getVoxel and setVoxel methods
* *Direct*: time to write using the direct getter/setter methods (Voc.set[field])

Memory Tests
------------
These tests measure r/w speeds without expansion, and how much memory is consumed
by Voctopus' on-demand expansion. The direct-write interfaces are used here.

`);

/* Begin Benchmarks */
for(let i in schemaList) {
	let schema = schemaList[i];
	benchmark(schema);
}
