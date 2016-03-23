"use strict";
var Voctopus = require("./voctopus.core.js").Voctopus;
var schemas = require("./voctopus.schemas.js");
var loop3D = require("./voctopus.util.js").loop3D;
let rows = [];
let cellw = 8;
let schema = schemas.RGBM;
let name = "RGBM", testName = "direct";
console.log("\nSCHEMA "+name);
console.log("======="+("=").repeat(name.length));
rows.push([testName].concat(new Array(5).fill((" ").repeat(cellw))));
rows.push(["Depth", "Write", "Read", "Voxels", "Octets", "Memory"]);
console.log("\nR/W Tests\n---------");
let i = 0, count = 0;
let readcb = function(voc, pos) {
	let ptr = voc.traverse(pos, true);
	voc.getVoxel(ptr);
	++count;
	++i;
}
let fy = () => {i = 0};
for(let d = 5; d <= 7; ++d) {
	let voc = new Voctopus(d, schema);
	let size = Math.pow(2, d - 1);
	let res = 1;
	while(res) res = voc.expand();
	count = 0; // reset voxel counter
	let start = new Date().getTime();
	loop3D(size, {y:fy, z:readcb.bind(null, voc)});
	let rtime = new Date().getTime() - start;
	console.log(rtime/1000+"s");
	//wtime = 0; //stopwatch(cbw);
	//rows.push([d, wtime, rtime, count, calcOctets(voc), inMB(voc.view.byteLength)+"MB"]);
}
//console.log(table(cellw, rows));
