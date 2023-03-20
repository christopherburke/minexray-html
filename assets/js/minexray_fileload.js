var nLDB = 0;
// Read the selected ldb files and store them in wasm file system
async function load_local_files(){
    // Delete from wasm side previous temp ldb files that were loaded
    for (i=0; i<nLDB; i++) {
        let fileName = 'temp' + String(i).padStart(4, '0') + '.ldb';
        //console.log('Removing from wasm filesystem: '+fileName);
        FS.unlink(fileName);
    }
    // reset wasm side tmp ldb file count
    nLDB = 0;
    var fileList = document.getElementById('file-selector').files;
    //console.log(fileList);
    var lenList = fileList.length;
    // Going to use promises to handle asynchronously reading a bunch of files
    // Based on https://stackoverflow.com/a/50486121
    let promises = []; // storage array for reading file promises
    for (i=0; i<lenList; i++) {
        // check extension of file is .ldb
        if (fileList[i].name.split(".").pop() == "ldb") {
            //console.log(fileList[i].name, fileList[i].size);
            // Get a new promise for reading the file into FileReader results
            let filePromise = new Promise(resolve => {
                let reader = new FileReader();
                reader.readAsArrayBuffer(fileList[i]);
                reader.onload = () => resolve(reader.result);
            });
            promises.push(filePromise);
            nLDB++;
        }
    }
    // Wait for accumulated promises to complete the reading
    // Also start a new array of promises for copying file buffers to wasm side
    let promises2 = [];
    Promise.all(promises).then(fileReadResults => {
        // fileReadResults is an array with the read results
        for (i=0; i<nLDB; i++) {
            let filePromise = new Promise(resolve => {
                let fileName = 'temp' + String(i).padStart(4, '0') + '.ldb';
                const uint8_view = new Uint8Array(fileReadResults[i]);
                resolve(FS.writeFile(fileName, uint8_view));
            });
            promises2.push(filePromise);
        }
    });
    // Wait for accumulated promises2 of writing files to wasm side
    Promise.all(promises2).then(copyResults => {
       console.log(copyResults); 
    });
    
    //console.log("User selected " + nLDB+ " LDB files");
    load_wasm_memory();
    $('#runSearch').show();
    $("#blockOutput").hide();
    $("#blockOutputTable thead").empty();
    $("#blockOutputTable tbody").empty();

    // Attach search function to #runSearch button only once
    // Had big time timing issues with searching Status text not showing
    // up until after click event was completely finished.
    // even promises did not work. Solution from
    //https://itecnote.com/tecnote/javascript-force-dom-redraw-with-javascript-on-demand/
    $('#runSearch').unbind('click.namespace').bind('click.namespace', function() {
        $('#searchingStatus').show(
            function () {
                    searchForBlocks('#blockOutput');
            }
        );
    });
}

// This function creates the memory on javascript side that 
// will be filled in by wasm 
// Do some containment so that the memory is created only once
// https://stackoverflow.com/questions/12713564/function-in-javascript-that-can-be-called-only-once
var load_wasm_memory = (function() {
        var executed = false;
        var maxN = 1000;
        return function() {
            if (!executed) {
                executed = true;
                // create the memory
                xAll = array_allocate(maxN, 'HEAP32');
                yAll = array_allocate(maxN, 'HEAP32');
                zAll = array_allocate(maxN, 'HEAP32');
                dAll = array_allocate(maxN, 'HEAPF32');
                nAll = array_allocate(maxN, 'HEAP32');
                nGot = array_allocate(1, 'HEAP32');                        
            }
        }
})();

function searchForBlocks(outputId) {
    var maxN = 1000;
    //console.log('Running Search');
    $('#xErr').hide();
    $('#yErr').hide();
    $('#zErr').hide();
    $('#nErr').hide();
    var allGood = 1;
    var gotX = verify_int($('#xPosString').val(), '#xErr', -999999, 999999);
    if (isNaN(gotX)) {allGood=0;}
    var gotY = verify_int($('#yPosString').val(), '#yErr', -999999, 999999);
    if (isNaN(gotY)) {allGood=0;}
    var gotZ = verify_int($('#zPosString').val(), '#zErr', -999999, 999999);
    if (isNaN(gotZ)) {allGood=0;}
    var gotN = verify_int($('#nBlockString').val(), '#nErr', 0, 1000);
    if (isNaN(gotN)) {allGood=0;}
    //console.log(gotX, gotY, gotZ, gotN, allGood);
    if (allGood == 1) {
        console.log('Start Search');
        $(outputId + "Table thead").empty();
        $(outputId + "Table tbody").empty();
        // Reset all the data from previous search
        for (var i = 0; i < maxN; i++) {
            xAll.data[i] = 0;
            yAll.data[i] = 0;
            zAll.data[i] = 0;
            dAll.data[i] = 0;
            nAll.data[i] = 0;
        }
        nGot.data[0] = 0;
        var matchStr = allocateUTF8($('#blockString').val());
        _run_main(matchStr, gotX, gotY, gotZ, $('#worldType').val(), gotN, $('#doBlobs').val(), xAll.offset, 
                    yAll.offset, zAll.offset, dAll.offset, nAll.offset, nGot.offset);
        //console.log('End Search');
        _free(matchStr);
        var nFnd = nGot.data[0];
        console.log(nFnd);
        kpX = xAll.data.filter( (x,ii) => ii < nFnd);
        kpY = yAll.data.filter( (x,ii) => ii < nFnd);
        kpZ = zAll.data.filter( (x,ii) => ii < nFnd);
        kpD = dAll.data.filter( (x,ii) => ii < nFnd);
        kpN = nAll.data.filter( (x,ii) => ii < nFnd);
        //console.log(kpX);
        fill_block_table(nFnd, kpX, kpY, kpZ, kpD, kpN, outputId, $('#blockString').val());
        $('#searchingStatus').hide();
    }
    
}

function verify_int(instr, errid, intmin, intmax) {
    var gotInt = parseInt(instr);
    //console.log(errid, instr, gotInt);
    if (!isNaN(gotInt)) {
        if (gotInt >= intmin && gotInt <= intmax) {
            return gotInt;
        }
    }
    $(errid).show();
    return NaN;
}

function fill_block_table(nFnd, bX, bY, bZ, bD, bN, outputId, matchStr) {
    //console.log(nFnd, outputId, matchStr);
    if (nFnd == 0) {
      // No data
      $(outputId+"Table thead").append('<tr><th>No blocks found matching'+'"'+matchStr+'"!</th></tr>');
    } else {
      //console.log('Trying to fill table');
      $(outputId+"Table thead").append('<tr><th>X</th><th>Y</th><th>Z</th><th>Size</th><th>XZ Dist</th><th>Visited</th></tr>');
      for (i=0; i<nFnd; i++) {
        $(outputId+"Table tbody").append(`<tr><td>${bX[i]}</td><td>${bY[i]}</td><td>${bZ[i]}</td><td>${bN[i]}</td><td>${parseInt(bD[i])}</td><td><input type="checkbox" id="chkb${i}"><label for="chkb${i}">${i+1}</label></td></tr>`);
      }
    }
    $(outputId).show();
}
