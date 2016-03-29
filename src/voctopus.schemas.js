"use strict";
require("./voctopus.util.js");
/**
Voctopus Schemas
================
Schemas describe various data structures for Voctopus octants. They allow a single ocant tocontain heterogeneous data. A schema must be chosen and passed to Voctopus during initialization. Their basic structure is an array of objects, each describing one piece of data in the component. Think of them as structs. They have the following form: 
```js
{label: string, offset: int, length: int}
```
Where label is a string naming the data field, offset is the offset from the beginning of the octet in bytes, and length is the length of the field in bytes.

All schemas must contain a "p" field, which contains the p to the child octant's first octet in the Voctopus memory block. Pointer should be the last field, and should typically have a length of 3 or 4 (corresponding to a 24-bit or 32-bit int). 64-bit ints would allow us to use much larger octrees, but alas Javascript's ArrayBuffer and Int size limitations interfere.

This flexible system allows for Voctopus to use any schema you like - feel free to create your own. More will be added as useful schemas are discovered. Keep in mind the larger the structure the shallower the octree must be. It should be possible to spread data across
multiple sibling octrees but maintenance gets more complicated in that case.

@module voctopus.schemas
*/

const TYPES = {
	UINT8:{get:DataView.prototype.getUint8, set:DataView.prototype.setUint8, length:1},
	UINT16:{get:DataView.prototype.getUint16, set:DataView.prototype.setUint16, length:2},
	UINT24:{get:DataView.prototype.getUint24, set:DataView.prototype.setUint24, length:3},
	UINT32:{get:DataView.prototype.getUint32, set:DataView.prototype.setUint32, length:4},
	FLOAT32:{get:DataView.prototype.getFloat32, set:DataView.prototype.setFloat32, length:4},
	FLOAT64:{get:DataView.prototype.getFloat64, set:DataView.prototype.setFloat64, length:8}
}
/*
const TYPES = {
	UINT8:{get:"getUint8", set:"setUint8", length:1},
	UINT16:{get:"getUint16", set:"setUint16", length:2},
	UINT24:{get:"getUint24", set:"setUint24", length:3},
	UINT32:{get:"getUint32", set:"setUint32", length:4},
	FLOAT32:{get:"getFloat32", set:"setFloat32", length:4},
	FLOAT64:{get:"getFloat64", set:"setFloat64", length:8}
}
*/
/**
 * Schema for RGB voctants with an additional m index field. Balance
 * between color fidelity and reasonable data footprint. Fields are:
 *
 *  * r: red value (as 8-bit int)
 *  * g: green value (as 8-bit int)
 *  * b: blue value (as 8-bit int)
 *  * m: m index (8-bit int)
 *  * p: 32-bit p
 *
 *  The total size of a RGBM octet is thus 64 bits or 8 bytes.
 */
const RGBM = [
	{label:"p",type:TYPES.UINT32}, //offset:4,length:4}
	{label:"r",type:TYPES.UINT8}, //offset:0,length:1},
	{label:"g",type:TYPES.UINT8}, //offset:1,length:1},
	{label:"b",type:TYPES.UINT8}, //offset:2,length:1},
	{label:"m",type:TYPES.UINT8} //offset:3,length:1},
];

/**
 * Schema for m index voctants with 8 bit index and 24 bit pointer.  Lower memory footprint = larger octrees, at the cost of color fidelity. Fields are:
 *  * m: material index (8-bit int)
 *  * p: 24-bit pointer
 *  The total size of an I8M otet is thus 32 bits or 4 bytes.
 */
const I8M24P = [
	{label:"p",type:TYPES.UINT24},//offset:1,length:3}
	{label:"m",type:TYPES.UINT8}//offset:0,length:1},
];

/**
 * Schema for m index voctants with 8 bit index and 16 bit pointer. Very small memory footprint, but limited to about 2730 octets - so only use for very small sprites (~16x16x16). Fields are:
 *  * m: m index (8-bit int)
 *  * p: 16-bit pointer
 *  The total size of an I8M otet is thus 32 bits or 4 bytes.
 */
const I8M16P = [
	{label:"p",type:TYPES.UINT16},//offset:1,length:3}
	{label:"m",type:TYPES.UINT8}//offset:0,length:1},
];

/**
 * Schema for m index voctants with 32 bit index and 32 bit pointer. Similar cost to RGBM but with a large material index instead of direct RGB values.. Fields are:
 *  * m: material index (8-bit int)
 *  * p: 24-bit pointer
 *  The total size of an I8M otet is thus 32 bits or 4 bytes.
 */
const I32M32P = [
	{label:"p",type:TYPES.UINT32},//offset:1,length:3}
	{label:"m",type:TYPES.UINT32}//offset:0,length:1},
];

/**
 * Schema for m index voctants with 16 bit index and 16 bit pointer. Cleanly offset memory footprint, but limited to about 2730 octets - so only use for very small sprites (~16x16x16). Fields are:
 *  * m: m index (16-bit int)
 *  * p: 16-bit pointer
 *  The total size of an I8M otet is thus 32 bits or 4 bytes.
 */

const I16M16P = [
	{label:"p",type:TYPES.UINT16},//offset:1,length:3}
	{label:"m",type:TYPES.UINT16}//offset:0,length:1},
];

if(typeof(module.exports) !== "undefined") {
	module.exports.TYPES = TYPES;
	module.exports.RGBM = RGBM;
	module.exports.I8M24P = I8M24P;
	module.exports.I8M16P = I8M16P;
	module.exports.I16M16P = I16M16P;
	module.exports.I32M32P = I32M32P;
}
