Voctopus 0.0.1
==============
An experimental implementation of a sparse voxel octree in javascript. The basic
data structure is here, but it still needs work before it's ready for production.

The tree is stored in a flattened structure:
```
[00]
|-`----------------------------.
[01][02][03][04][05][06][07][08]
|-`----------------------------.
[09][10][11][12][13][14][15][16][...]
|-`----------------------------.
[73][74][75][76][77][79][80][81][...]
```

This lets it traverse using some nifty math (check the source if you want to know more, 
the algorithm is somewhat documented). 

It automatically prunes branches that are empty (which is the Sparse part of a SVO) but
perhaps more interestingly it also prunes branches that are uniform (whose children are
all identical).

Since Javascript Arrays are naturally sparse (empty elements don't take up any memory) 
you can store a very large volume in a relatively small place and retrieve data quickly.

It can defer cleanup during a large transaction (updating multiple voxels) and will
intelligently do the minimum amount of work it needs to to keep the tree up to date.

Combine all these features together and you get an octree that updates and traverses
lightning fast. There are still a few rough spots that might have room for improvement.

License (MIT)
=============
Copyright 2015 Justen Robertson <nphyxx@gmail.com> / https://github.com/nphyx.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
