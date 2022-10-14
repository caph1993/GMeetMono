//@ts-check
/// <reference path="./lattices.js" />
console.log('STARTED SCRIPT')

// console.log(utilsChildren.powerset(1));
// console.log(utilsChildren.powerset(2));
// console.log(utilsChildren.powerset(3));

// 27 collapses
// var L = Lattice.preset(19);
//var L = Lattice.preset(19);
//var L = Lattice.preset(7);
//var L = Lattice.preset(6);
var L = Lattice.preset(200);
console.log('Lattice size:', L.n)
for(let [b,a] of iterDiffPairs(L.topoUpDown)){
  assert(!L.leq[b][a], a, b)
}
var {GMeetNaive, GMeetNaiveD} = algorithms(L);

let cntRef = 0;
let cntTest = 0;
let ntc= 100;
for(let tc=0; tc<ntc; tc++){
  const h = L.randomMonotoneF();
  const ref = GMeetNaive(h);
  cntRef += ref.cnt;
  let hX=null, cntX=null, error=false;
  try{
    ({h:hX, cnt:cntX} = GMeetNaiveD(h));
    cntTest += cntX;
    for(let x of range(L.n)) if(hX[x]!=ref.h[x]) error=true;
  } catch(err){
    console.error(err);
    error = true;
  }
  if(error){
    console.log('Expected', ref.h);
    console.log('Found', hX);
    break;
  }
}
console.log(cntRef/ntc, cntTest/ntc)
console.log('END WAS REACHED')