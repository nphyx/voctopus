"use strict";
const Voctopus = require("./voctopus.core.js").Voctopus;
const VoctopusSchemas = require("./voctopus.schemas.js");
const loop3D = require("./voctopus.util.js").loop3D;
// use a lot of globals because it has less impact on run time
var voc, count, size, i, d, voxel, ptr, cb, rtime, wtime, rows, results, schema;
const testList = ["object", "direct"];

/* Setup */
const schemaList = [
	{name:"RGBM", dmin:4, dmax:8, tests:{
		object:(ptr, i) => voc.setVoxel(ptr, {r:i,g:i+1,b:i+2,m:i+3}),
		direct:(ptr, i) => {
			voc.set.r(ptr, i);
			voc.set.g(ptr, i+1);
			voc.set.b(ptr, i+2);
			voc.set.m(ptr, i+3);
		}
	}}, 
	{name:"I8M24P", dmin:4, dmax:8, tests:{
		object:(ptr, i) => voc.setVoxel(ptr, {m:i}),
		direct:(ptr, i) => voc.set.m(ptr, i)
	}},
	{name:"I8M16P", dmin:3, dmax:5, tests:{
		object:(ptr, i) => voc.setVoxel(ptr, {m:i}),
		direct:(ptr, i) => voc.set.m(ptr, i)
	}}
];

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
let fy = () => i = 0;

let test = (cb, pos) => {
	ptr = voc.traverse(pos, true);
	cb(ptr, i);
	++count;
	++i;
}

let read = (pos) => {
	return test((ptr) => voxel = voc.getVoxel(ptr), pos);
}

/**
 * Iterate through dmin to dmax, calling callback and putting the result in an array.
 * @param {int} dmin start iteration at 
 * @param {int} dmax stop iteration at
 * @param {function} cb callback
 * @return {array}
 */
let iterd = (dmin, dmax, cb) => {
	results = [];
	for(d = dmin; d <= dmax; ++d) {
		results.push(cb());
	}
	return results;
}

function cbInit() {
	return stopwatch(() => new Voctopus(d, VoctopusSchemas[schema.name]));
}

function cbExpand() {
	return stopwatch(() => {
		voc = new Voctopus(d, VoctopusSchemas[schema.name]);
		let res = 1;
		while(res) res = voc.expand();
	});
}

function cbr() {return loop3D(size, {y:fy, z:(pos) => read(pos)})}
function cbw() {return loop3D(size, {y:fy, z:(pos) => test(cb, pos)})}
function testRW(testName, schema, d, expand = true) {
	voc = new Voctopus(d, VoctopusSchemas[schema.name]);
	cb = schema.tests[testName];
	if(expand) {
		// expand it first so it won't get slowed down arbitrarily
		let res = 1;
		while(res) res = voc.expand();
	}
	size = Math.pow(2, d - 1);
	rtime = stopwatch(cbr);
	count = 0; // reset voxel counter
	wtime = stopwatch(cbw);
	return [d, rtime, wtime, count, calcOctets(voc), inMB(voc.view.byteLength)+"MB"];
}

function benchmark() {
	let cellw = 8;
	console.log("\nSCHEMA "+schema.name);
	console.log("======="+("=").repeat(schema.name.length));
	// Initialization benchmarks  
	rows = [];
	console.log("\nInitialization Tests\n--------------------");
	rows.push(["Depth"].concat(range(schema.dmin, schema.dmax)));
	rows.push(["Init"].concat(iterd(schema.dmin, schema.dmax, cbInit)));
	rows.push(["Expand"].concat(iterd(schema.dmin, schema.dmax, cbExpand)));
	console.log(table(cellw, rows));

	// Read/Write Benchmarks 
	console.log("\nR/W Tests\n---------");
	rows = [];
	/*
	testList.forEach((testName) => {
	*/
		let testName = "direct";
		rows.push([testName].concat(new Array(5).fill((" ").repeat(cellw))));
		rows.push(["Depth", "Read", "Write", "Voxels", "Octets", "Memory"]);
		d = schema.dmin;
		for(let max = schema.dmax; d < max; ++d) {
			rows.push(testRW(testName));
		}
		/*
	});
	*/
	console.log(table(cellw, rows));
	console.log("\nMemory Tests\n------------");
	rows = [];
	rows.push(["Depth", "Read", "Write", "Voxels", "Octets", "Memory"]);
	d = schema.dmin;
	for(let max = schema.dmax; d < max; ++d) {
		rows.push(testRW("direct", false));
	}
	console.log(table(cellw, rows));
}

(function() {
	let schema = schemaList[1];
	let testName = "direct";
	let rows = [];
	let cellw = 8;
	rows.push([testName].concat(new Array(5).fill((" ").repeat(cellw))));
	rows.push(["Depth", "Read", "Write", "Voxels", "Octets", "Memory"]);
	let d = schema.dmin;
	for(let max = schema.dmax; d < max; ++d) {
		rows.push(testRW(testName, schema, d));
	}
	console.log(table(cellw, rows));
})();


/* Begin Benchmarks */
schema = schemaList[1];
benchmark();
/*
for(let i in schemaList) {
	schema = schemaList[i];
	benchmark(schema);
}
*/
