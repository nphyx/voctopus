"use strict";
const Voctopus = require("./src/voctopus.core").Voctopus 
const voxel = require("./src/voctopus.core").voxel 
window.Voctopus = {voxel:voxel,create:(n) => new Voctopus(n)}
