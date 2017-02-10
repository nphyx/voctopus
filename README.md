Voctopus 0.1.0
==============
Voctopus is a Javascript implementation of a sparse voxel octree. The end goal is to create a data structure small and fast 
enough that it can be rendered directly by a shader in WebGL without meshification, using ray tracing techniques (or something
analogous to that - I'm currently experimenting with a mix of ideas taken from cone tracing, path tracing and depth marching). 
The shader code is still a work in progress, and will be released as a separate repository along with the rest of the tools
necessary to create and manipulate scenes.

Architecture
------------
Voctopus has two main pieces: a low-level kernel written in asm.js and a high-level javascript API for use by humans.

Memory management, access, traversal, and other core operations are handled by the kernel, yielding real-world performance 
of over one million (and up to 8 million) r/w operations per second on commodity hardware in a small memory footprint. See the 
[benchmarks](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet) for performance details.

The kernel currently supports 32-bit voxels representing either a 31-bit subtree pointer or 24 bits of RGB color, a 4 bit alpha 
channel, and 3 bits reserved for rendering instructions (the remaining bit is a flag indicating whether the entry is a pointer
or voxel data). The non-kernel code is agnostic, such that kernels with other data structures (e.g. for indexed color) could
be supported.

Todo
----
* prune dead octets and free for reallocation - incomplete
* defragmentation (maybe not neccessary)
* ray intersection - partially complete, weird test results

Voctopus is still a work in progress! Neither the API nor the data structure should be considered stable.

Current documentation is available in the [project wiki](https://github.com/nphyx/voctopus/wiki/voctopus.core). Examples and demos
will follow as the code stabilizies - they're currently not in useful shape.

License (MIT)
=============
Copyright 2015 Justen Robertson <nphyxx@gmail.com> / https://github.com/nphyx.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
