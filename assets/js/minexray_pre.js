// One needs to run this javascript BEFORE calling the wasm _tess_fitslc_export
// However we need to define this AFTER the emscripten generated javascript is included
// in order to have access to the module helpers.
// This routine allocates the expected memory on the javascript side
// The pointers to the memory locations created here will be passed as arguments
// to _tess_fitslc_export

// Generic allocator on the javascript side of things
// using the emscripten HEAP helpers
// sz is number of BYTES in variable type
var EM_HEAP_DATA = {
  'HEAP8': 1,
  'HEAP16': 2,
  'HEAP32': 4,
  'HEAPU8': 1,
  'HEAPU16': 2,
  'HEAPU32': 4,
  'HEAPF32': 4,
  'HEAPF64': 8
}

// Allocate memory on the wasm HEAP
// len - Number of elements in array
// typstr - string that matches one of the types in EM_HEAP_DATA
// init_zero [boolean] - initialize allocated array to zero
function array_allocate(len, typstr, init_zero=true) {
    // Bytes per element
    var bpe = EM_HEAP_DATA[typstr];
    // Allocate the requested memory length on the emscripten HEAP
    // length needs to given in terms of bytes
    var lenbytes = len * bpe;
    var offset = Module._malloc(lenbytes);
    // Frequently need offset / 'type byte length'
    //  This offset is equivalent to number of elements of type
    // or the index into the array if the heap consisted of type elements rather
    // than being fixed to 8bit=1byte elements
    var type_offset = offset / bpe;
    // If we want to initialize the allocation to zero values do so now
    if (init_zero) {
      Module.HEAP8.set(new Int8Array(lenbytes), offset);
    }
    // return the object that stores 'data' that is basically a pointer to the begining of data
    //    on the javascript side and the 'offset' which is the pointer that will
    ///  be used in the argument to the wasm functions.
    offObj = {"offset":offset};
    switch(typstr) {
      case 'HEAP8':
        dataObj = {"data":Module.HEAP8.subarray(type_offset, type_offset + len)}
        break;
      case 'HEAP16':
        dataObj = {"data":Module.HEAP16.subarray(type_offset, type_offset + len)}
        break;
      case 'HEAP32':
        dataObj = {"data":Module.HEAP32.subarray(type_offset, type_offset + len)}
        break;
      case 'HEAPU8':
        dataObj = {"data":Module.HEAPU8.subarray(type_offset, type_offset + len)}
        break;
      case 'HEAPU16':
        dataObj = {"data":Module.HEAPU16.subarray(type_offset, type_offset + len)}
        break;
      case 'HEAPU32':
        dataObj = {"data":Module.HEAPU32.subarray(type_offset, type_offset + len)}
        break;
      case 'HEAPF32':
        dataObj = {"data":Module.HEAPF32.subarray(type_offset, type_offset + len)}
        break;
      case 'HEAPF64':
        dataObj = {"data":Module.HEAPF64.subarray(type_offset, type_offset + len)}
        break;
    }
    return Object.assign(dataObj, offObj);
}
