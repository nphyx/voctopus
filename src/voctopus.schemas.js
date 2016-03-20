"use strict";
/**
Voctopus Schemas
================
Schemas describe various data structures for Voctopus octants. They allow a single ocant tocontain heterogeneous data. A schema must be chosen and passed to Voctopus during initialization. Their basic structure is an array of objects, each describing one piece of data in the component. Think of them as structs. They have the following form: 
```js
{label: string, offset: int, length: int}
```
Where label is a string naming the data field, offset is the offset from the beginning of the octet in bytes, and length is the length of the field in bytes.

All schemas must contain a "pointer" field, which contains the pointer to the child octant's first octet in the Voctopus memory block. Pointer should be the last field, and should typically have a length of 3 or 4 (corresponding to a 24-bit or 32-bit int). 64-bit ints would allow us to use much larger octrees, but alas Javascript's ArrayBuffer and Int size limitations interfere.

This flexible system allows for Voctopus to use any schema you like - feel free to create your own. More will be added as useful schemas are discovered. Keep in mind the larger the structure the shallower the octree must be. It should be possible to spread data across
multiple sibling octrees but maintenance gets more complicated in that case.

@module voctopus.schemas
*/

/**
 * Schema for RGB voctants with an additional material index field. Balance
 * between color fidelity and reasonable data footprint. Fields are:
 *
 *  * r: red value (as 8-bit int)
 *  * g: green value (as 8-bit int)
 *  * b: blue value (as 8-bit int)
 *  * material: material index (8-bit int)
 *  * pointer: 32-bit pointer
 *
 *  The total size of a RGBM octet is thus 64 bits or 8 bytes.
 */
const RGBM = [
	{label:"r",offset:0,length:1},
	{label:"g",offset:1,length:1},
	{label:"b",offset:2,length:1},
	{label:"material",offset:3,length:1},
	{label:"pointer",offset:4,length:4}
];

	/**
	 * Schema for material index voctants with 8 bit index and 16 bit pointer.
	 * Lower memory footprint = larger octrees, at the cost of color fidelity. Fields
	 * are:
   *  * material: material index (8-bit int)
   *  * pointer: 24-bit pointer
	 *  The total size of an I8M otet is thus 32 bits or 4 bytes.
	 */
const I8M = [
	{label:"material",offset:0,length:1},
	{label:"pointer",offset:1,length:3}
];

if(typeof(module.exports) !== "undefined") {
	module.exports.RGBM = RGBM;
	module.exports.I8M = I8M;
}
