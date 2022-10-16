//@ts-check
//spell-checker: words lubs topo elems uncomparables

/** @template T  @param {T} condition @returns {T extends undefined ? never : T extends false ? never : T extends null ? never : void} */
function assert(condition, ...messages) {
  //@ts-ignore
  if (condition) return;
  console.error(messages);
  throw new Error();
}

const range = (n)=>[...Array(n).fill(null).map((_,i)=>i)];

/** @template T @param {T[]} arr @returns {T[]}*/
const shuffled = (arr)=>{
  return arr.map(x=>({x, rand:Math.random()}))
  .sort(({rand:rand1}, {rand:rand2}) => rand2-rand1)
  .map(({x})=>x);
}
/** @template T @param {T[]} arr*/
const shuffle = (arr)=>{
  const idx = shuffled(range(arr.length));
  const cpy = [...arr];
  arr.forEach((_,i)=>arr[i]=cpy[idx[i]])
  return arr;
}

/** @template T @param {T[]} arr*/
const iterDiffPairs = function*(arr){
  const n = arr.length;
  for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) yield [arr[i], arr[j]];
}


const RNG=(/** @type {number | null} */ seed=null, maxValue=(1<<31))=>{
  const base=257, bigPrime=7778777;
  let curr = seed!=null?seed:Math.floor(Math.random()*bigPrime);
  function next(){
    curr = Math.floor(curr*base+1)%bigPrime;
    return curr%maxValue;
  }
  if(seed==null) next(), next();
  return next;
}
const hashRolling=(/** @type {number[]} */ seq)=>{
  const base=257, bigPrime=7778777;
  let h=0, pow=1;
  for(let x of seq){
    h = (base*h + x) % bigPrime;
    pow = (base*pow) % bigPrime;
  }
  return h;
}


// spell-checker: words powerset inbetween

/**@namespace */
const utilsChildren = (()=>{

  /** @param {number} n @returns {number[][]}*/
  const emptyLists = (n)=> range(n).map(()=>[]);

  /** @param {number} log2n */
  function powerset(log2n){ // produces a lattice of size 2^n
    const n = 1<<log2n;
    let children = /**@type {number[][]} */([[]]);
    while(children.length < n)
      children = twiceChildren(children);
    assert(children.length==n)
    return children;
  }

  /** @param {number[][]} children */
  function twiceChildren(children){
    const n = children.length;
    return range(2*n).map(
      (x)=>x<n?children[x]:[x-n, ...children[x-n].map(y=>y+n)]
    );
  }

  /** @param {number[][]} children1 @param {number[][]} children2 */
  function multiplyChildren(children1, children2){
    const n1 = children1.length;
    const n2 = children2.length;
    const /** @type {number[][]} */children = range(n1*n2).map(()=>[]);
    for(let i=0; i<n1; i++) for(let j=0;j<n2;j++){
      for(let k of children1[i]) children[i + j * n1].push(k + j * n1)
      for(let k of children2[j]) children[i + j * n1].push(i + k * n1)
    }
    return children;
  }

  /** @param {number[][]} children1 @param {number[][]} children2 */
  function addChildren(children1, children2){
    const n1 = children1.length;
    const n2 = children2.length;
    const /** @type {number[][]} */children = range(n1+n2).map(()=>[]);
    for(let i=0; i<n1; i++) for(let k of children1[i]) children[i].push(k);
    for(let j=0; j<n2; j++) for(let k of children2[j]) children[j+n1].push(k+n1);
    const bottoms2 = range(n2).filter(j=>!children2[j].length);
    const nonTops1 = new Set();
    for(let i=0; i<n1; i++) for(let k of children1[i]) nonTops1.add(k);
    const tops1 = range(n1).filter(i=>!nonTops1.has(i));
    for(let i of tops1) for(let j of bottoms2) children[j+n1].push(i)
    return children;
  }

  /** @param {number[][]} children @param {number?} start */
  function randomEdge(children, start=null){
    const n = children.length;
    assert(n>1, 'Can not add edge to a single node lattice');
    if(start==null) start = Math.floor(Math.random()*n);
    let b = start%n, a; // get two subsequent nodes.
    let budget = n+2;
    while(budget&&!children[b].length) b = (b+1)%n, budget-=1;
    if(!budget){console.error(children); throw 'Impossible';}
    a = children[b][0];
    return [a,b];
  }

  /** @param {number[][]} children @param {number[]} where */
  function addNodesBetween(children, [a,b], nNodes=1){
    const n = children.length;
    const out = range(n).map((x)=>[...children[x]]);
    for(let i of range(nNodes)) out.push([a]);
    out[b] = [...out[b].filter(x=>x!=a)];
    for(let i of range(nNodes)) out[b].push(n+i);
    return out;
  }

  /** @param {number} k @param {number} seed*/
  function presets(k, seed=0){ // k is the lattice size at the same time
    if(k<=1) return k==1?[[]]:[];
    k = Math.max(2, k);
    let children = powerset(1);
    let modMul=3, modAdd=5, modBet=2, n;
    const next = RNG(RNG(k)()+seed);
    while((n=children.length)<k){
      if(next()%modMul==0){
        let a = 2;
        while(n*a < k && next()%modMul==0) a+=1;
        if(n*a > k) continue;
        children = multiplyChildren(children, presets(a, next()));
        modMul++;
      } else if(next()%modAdd==0){
        let m = Math.floor(n*((next()%80)+10)/100);
        if(n+m > k) continue;
        children = addChildren(children, presets(m, next()));
        modAdd *= 2;
      } else{
        const [a,b] = randomEdge(children, next());
        let nNodes = 1;
        while(next()%modBet==0) nNodes += 1;
        if(n+nNodes > k) continue;
        children = addNodesBetween(children, [a,b], nNodes);
        modBet++;
      }
    }
    return children;
  }

  // /**@param {boolean[][]} isChild */
  // const isChild2children = (isChild)=>{
  //   const n = isChild.length;
  //   const children = emptyLists(n);
  //   for(let a=0;a<n;a++) for(let b=0;b<n;b++){
  //     if(isChild[a][b]) children[b].push(a);
  //   }
  //   return children;
  // }
  // /**@param {number[][]} parents */
  // const parents2children = (parents)=>{
  //   const n = parents.length;
  //   const children = emptyLists(n);
  //   for(let a=0;a<n;a++) for(let b of parents[a]){
  //     children[b].push(a);
  //   }
  //   return children;
  // }
  /**@param {number[][]} children */
  const children2isChild = (children)=>{
    const n = children.length;
    const isChild = range(n).map(()=>range(n).map(()=>false));
    for(let b=0;b<n;b++) for(let a of children[b]){
      isChild[a][b] = true;
    }
    return isChild;
  }
  /**@param {number[][]} children */
  const children2parents = (children)=>{
    const n = children.length;
    const parents = emptyLists(n);
    for(let a=0;a<n;a++) for(let b of children[a]){
      parents[b].push(a);
    }
    return parents;
  }

  // /**
  //  * @param {{children:number[][]?, parents:number[][]?, isChild:boolean[][]?}} childrenFormats
  //  * * @returns {{children:number[][], parents:number[][], isChild:boolean[][]}}
  //  * */
  // function childrenAllFormats({children, parents, isChild}){
  //   if(children){
  //     isChild = isChild||children2isChild(children);
  //     parents = parents||children2parents(children);
  //     return {children, isChild, parents};
  //   } else if(isChild){
  //     children = children||isChild2children(isChild);
  //   } else if(parents){
  //     children = children||parents2children(parents);
  //   } else throw 'No argument given';
  //   return childrenAllFormats({children, parents, isChild});
  // }

  /**@param {number[][]} children */
  function children2leqSlow(children){
    const n = children.length;
    // leq is the transitive closure of isChild
    const dist = range(n).map(()=>range(n).map(()=>n+1));
    for(let a=0;a<n;a++) dist[a][a]=0;
    for(let b=0;b<n;b++) for(let a of children[b])
      dist[a][b] = 1;
    for(let k=0;k<n;k++) for(let i=0;i<n;i++) for(let j=0;j<n;j++){
      const alt = dist[i][k] + dist[k][j];
      if(alt < dist[i][j]) dist[i][j] = alt;
    }
    const leq = range(n).map(()=>range(n).map(()=>false));
    for(let a=0;a<n;a++) for(let b=0;b<n;b++){
      leq[a][b] = dist[a][b]<=n;
    }
    // for(let a=0;a<n;a++) for(let b=0;b<n;b++){
    //   if(leq[a][b] && a!=b) assert(a!=b)
    // }
    return leq;
  }

  /**@param {number[][]} children */
  function children2leq(children){
    // leq is the transitive closure of isChild
    const n = children.length;
    const {topoDownUp:topo, parents} = children2topo(children);
    assert(topo.length==n);
    const leq = range(n).map(()=>range(n).map(()=>false));
    for(let a=0;a<n;a++) leq[a][a] = true;
    for(let a of topo) for(let b of parents[a]){
      for(let x=0;x<n;x++) leq[x][b] ||= leq[x][a];
    }
    for(let x=0;x<n;x++) assert(leq[x][x]);
    for(let [x,y] of iterDiffPairs(topo)) assert(!leq[y][x]);
    for(let a=0;a<n;a++) for(let b=0;b<n;b++){
      if(leq[a][b] && a!=b) assert(a!=b)
    }
    return leq;
  }

  /**@param {number[][]} children */
  function children2topo(children){
    const topoDownUp = topoDfs(children);
    const parents = children2parents(children);
    const topoUpDown = topoDfs(parents);
    return {topoDownUp, topoUpDown, parents}
  }

  const topoDfs = (/** @type {number[][]} */ req)=>{
    // Requirements will appear first in the output
    const n = req.length;
    const seen = {};
    const topo = [];
    const dfs = (/** @type {number} */ x)=>{
      seen[x] = true;
      for(let y of req[x]) if(!seen[y]) dfs(y);
      topo.push(x);
    }
    for(let x=0;x<n;x++) if(!seen[x]) dfs(x);
    return topo;
  }
  return {presets, powerset, children2leq, children2isChild, children2parents, children2topo};
})();





class Lattice{

  /** @param {boolean[][]} leq @param {number[][]?} _children*/
  constructor(leq, _children=null) {

    const n = leq.length;
    leq = leq.map((row)=>(assert(row.length==n),[...row]));
    const zeroMat = ()=>range(n).map(()=>range(n).map(()=>0));
    const falseMat = ()=>range(n).map(()=>range(n).map(()=>false));
    const geq = falseMat();
    const gt = falseMat();
    const lt = falseMat();

    const nBelow = range(n).map(()=>0);
    const nAbove = range(n).map(()=>0);
    for(let a=0;a<n;a++) for(let b=0;b<n;b++){
      geq[a][b] = leq[b][a];
      gt[a][b] = geq[a][b] && a!=b;
      lt[a][b] = leq[a][b] && a!=b;
      if(leq[a][b]) nBelow[b]++, nAbove[a]++;
    }

    const inversePerm = (/** @type {number[]} */ arr)=>{
      const out = [...arr];
      for(let i=0;i<out.length;i++) out[arr[i]] = i;
      return out;
    }
    const topoDownUp = range(n).sort((a,b)=>nBelow[a]-nBelow[b]);
    const topoUpDown = range(n).sort((a,b)=>nAbove[a]-nAbove[b]);
    const invDownUp = inversePerm(topoDownUp);
    const invUpDown = inversePerm(topoUpDown);

    // for(let ia=0;ia<n;ia++) for(let ib=ia;ib<n;ib++){
    //   caph.assert(!lt[topoDownUp[ib]][topoDownUp[ia]]);
    //   caph.assert(!gt[topoUpDown[ib]][topoUpDown[ia]]);
    // }

    const glb = zeroMat();
    const lub = zeroMat();
    for(let a=0;a<n;a++) for(let b=a;b<n;b++){
      // glb[a][b] = glb[b][a] = range(n).filter((x)=>
      //   leq[x][a] && leq[x][b]
      // ).reduce((x,y)=> leq[x][y]?y:x);
      // lub[a][b] = lub[b][a] = range(n).filter((x)=>
      //   geq[x][a] && geq[x][b]
      // ).reduce((x,y)=> geq[x][y]?y:x);
      for(let i=Math.max(invDownUp[a], invDownUp[b]); i<n; i++){
        const x = topoDownUp[i];
        if(leq[a][x] && leq[b][x]){
          lub[a][b] = lub[b][a] = x;
          break;
        }
      }
      for(let i=Math.max(invUpDown[a], invUpDown[b]); i<n; i++){
        const x = topoUpDown[i];
        if(leq[x][a] && leq[x][b]){
          glb[a][b] = glb[b][a] = x;
          break;
        }
      }
    }
    let children = /** @type {number[][]}*/(_children);
    if(!_children){
      children = range(n).map(()=>[]);
      for(let a=0;a<n;a++) for(let b=0;b<n;b++) if(lt[a][b]){
        if(range(n).filter((x)=>lt[a][x] && lt[x][b]).length == 0) children[b].push(a);
      }
    }
    let m = 0;
    children.forEach(elems=>m+=elems.length);
    const parents = utilsChildren.children2parents(children);
    const isChild = utilsChildren.children2isChild(children);
    const top = range(n).filter(x=>parents[x].length==0)[0];
    const bottom = range(n).filter(x=>children[x].length==0)[0];

    const topoDfs = (/** @type {number[][]} */ req)=>{
      // Requirements will appear first in the output
      const seen = {};
      const topo = [];
      const dfs = (/** @type {number} */ x)=>{
        seen[x] = true;
        for(let y of req[x]) if(!seen[y]) dfs(y);
        topo.push(x);
      }
      for(let x=0;x<n;x++) if(!seen[x]) dfs(x);
      return topo;
    }
    // const topoDownUp = topoDfs(children);
    // const topoUpDown = topoDfs(parents);

    this.walkDown = function* (/** @type {number?} */start=null){
      if(start===null) start = top;
      for(let x of topoUpDown) if(leq[x][start]) yield x;
    }
    this.walkUp = function* (/** @type {number?} */start=null){
      if(start===null) start = bottom;
      for(let x of topoDownUp) if(leq[x][start]) yield x;
    }
    const uncomparables = /**@type {[number, number][]}*/([]);
    for(let a=0;a<n;a++) for(let b=a+1;b<n;b++){
      if(!leq[a][b]&&!leq[b][a]) uncomparables.push([a,b]);
    }
    /** @type {number}*/this.n = n;
    /** @type {number}*/this.m = m; // number of edges
    /** @type {number}*/this.top = top;
    /** @type {number}*/this.bottom = bottom;
    /** @type {boolean[][]}*/this.geq = geq;
    /** @type {boolean[][]}*/this.leq = leq;
    /** @type {boolean[][]}*/this.lt = lt;
    /** @type {boolean[][]}*/this.gt = gt;
    /** @type {boolean[][]}*/this.isChild = isChild;
    /** @type {number[][]}*/this.children = children;
    /** @type {number[][]}*/this.parents = parents;
    /** @type {number[][]}*/this.lub = lub;
    /** @type {number[][]}*/this.glb = glb;
    /** @type {number[]}*/this.topoDownUp = topoDownUp;
    /** @type {number[]}*/this.topoUpDown = topoUpDown;
    /** @type {[number,number][]}*/this.uncomparables = uncomparables;

  }


  /** @param {number} n */
  static total(n){
    const leq = range(n).map(()=>range(n).map(()=>false));
    for(let a=0;a<n;a++) for(let b=a;b<n;b++) leq[a][b] = true;
    return new Lattice(leq);
  }

  /** @param {number} log2n */
  static powerset(log2n){ // produces a lattice of size 2^n
    const children = utilsChildren.powerset(log2n);
    return this.fromChildren(children);
  }
  /** @param {number} k @param {number} seed */
  static preset(k, seed=0){
    const children = utilsChildren.presets(k, seed);
    return this.fromChildren(children);
  }
  /**@param {number[][]} children */
  static fromChildren(children){
    const leq = utilsChildren.children2leq(children);
    return new Lattice(leq, children);
  }

  randomArbitraryF(){
    const n = this.n;
    return range(n).map(()=>~~(Math.random()*n));
  }

  randomMonotoneF(){
    const {n, lt, gt, lub, glb, leq, geq} = this;
    const f = this.randomArbitraryF();
    for(let a of shuffled(range(n))){
      for(let x=0;x<n;x++){
        if(lt[x][a]) f[x] = glb[f[a]][f[x]];
        if(gt[x][a]) f[x] = lub[f[a]][f[x]];
      }
    }
    // CHECK:
    for(let a=0;a<n;a++) for(let b=0;b<n;b++) if(lt[a][b])
      assert(leq[f[a]][f[b]]);
    return f;
  }
  randomJoinF(){
    const {n, children, bottom} = this;
    const f = this.randomMonotoneF();
    for(let x=0; x<n; x++) if(children[x].length>1) f[x] = bottom;
    monoMinAbove(this, f);
    joinMaxBelow(this, f);
    return f;
  }

  powersetRandomSpaceF(){
    /* From delta.py Line 173: random_space_function*/
    const {n, leq, lub, children, lt} = this;
    const atoms = range(n).filter((x) => children[x].includes(0));
    const h = range(n).map(()=>n-1);
    h[0] = 0;
    for(let x of atoms) h[x] = Math.floor(Math.random()*n);
    for(let x=0;x<n;x++) if(h[x] == n-1){
      // f(c) = Vf(a_i) where Va_i = c and each a_i is an atom.
      h[x] = atoms.filter(e=>lt[e][x]).reduce((a,b)=>lub[a][b]);
      console.log(x, atoms.filter(e=>lt[e][x]), h[x])
    }
    console.log(h)
    console.log(children)
    // Check monotonicity
    for(let a=0;a<n;a++) for(let b=0;b<n;b++) if(lt[a][b])
      assert(leq[h[a]][h[b]], [a, b, h[a], h[b]]);
    return h;
  }


  subLatticeIrr(){
    const {n, children, leq} = this;
    const subToSuper = range(n).filter(x=>children[x].length==1);
    const subN = subToSuper.length;
    const superToSub = range(n).map(()=>-1);
    for(let i of range(subN)) superToSub[subToSuper[i]] = i;
    const subLeq = range(subN).map(()=>range(subN).map(()=>false));
    for(let i of range(subN)) for(let j of range(subN)){
      const a = subToSuper[i];
      const b = subToSuper[j];
      subLeq[i][j] = leq[a][b];
    }
    const sub = new Lattice(subLeq);
    return {sub, subToSuper, superToSub};
  }
}



/** @param {Lattice} domain @param {number[]} h @param {Lattice?} coDomain*/
function monoMaxBelow(domain, h, coDomain=null){
  // Computes the maximal monotone below h in-place.
  const {parents, topoUpDown} = domain;
  const {glb} = coDomain || domain;
  let changed = false;
  for(let x of topoUpDown){
    let z = h[x];
    for(let p of parents[x]) z = glb[z][h[p]];
    if(z!=h[x]) changed=true, h[x] = z;
  }
  return changed;
}

/** @param {Lattice} domain @param {number[]} h @param {Lattice?} coDomain*/
function monoMinAbove(domain, h, coDomain=null){
  // Computes the minimal monotone above h in-place.
  const {children, topoDownUp} = domain;
  const {lub} = coDomain || domain;
  let changed = false;
  for(let x of topoDownUp){
    let z = h[x];
    for(let p of children[x]) z = lub[z][h[p]];
    if(z!=h[x]) changed=true, h[x] = z;
  }
  return changed;
}


/** @param {Lattice} domain @param {number[]} h @param {Lattice?} coDomain */
function joinMaxBelow(domain, h, coDomain=null){
  // Computes the maximal join-endomorphism below h in-place.
  // This implementation finds and fixes conflicts immediately
  const {n, lub:domLub} = domain;
  const {lub, gt, glb} = coDomain||domain;
  let changed = true;
  let everChanged = false;
  while(changed){
    changed = false;
    for(let a=0;a<n;a++) for(let b=a+1;b<n;b++){
      const ab = domLub[a][b];
      const c = lub[h[a]][h[b]];
      if(h[ab] == c) continue;
      changed = true;
      if(gt[ h[ab] ][ c ]) h[ab] = c;
      else {
        h[a] = glb[h[a]][h[ab]];
        h[b] = glb[h[b]][h[ab]];
      }
    }
    everChanged ||= changed;
  }
  return everChanged;
}




/** @param {Lattice} L*/
var latticeAlgorithms = (L)=>{

  const {n, m, lub, leq, glb, geq, gt, lt,
    children, parents, top, bottom, topoUpDown, uncomparables,
  } = L;


  /** @param {number[]} h */
  const  GMeetStar = (h)=>{
    // Find conflicts, fixing them immediately
    let cnt = 0;
    while(true){
      let changed = false;
      let ab, hab;
      cnt += n * (n-1); // total LUBs for ab and hab
      for(let a=0;a<n;a++) for(let b=a+1;b<n;b++){
        if(h[ab=lub[a][b]] != (hab=lub[h[a]][h[b]])){
          changed = true, cnt++;
          if(gt[ h[ab] ][ hab ]) h[ab] = hab;
          else {
            h[a] = glb[h[a]][h[ab]];
            h[b] = glb[h[b]][h[ab]];
            cnt += 2;
          }
        }
      }
      if(!changed) break;
    }
    return {h, cnt};
  }

  /** @param {number[]} h */
  const GMeetMonoStar = (h)=>{
    let cnt = 0;
    cnt = m;
    monoMaxBelow(L, h);
    let changed = true;
    while(changed){
      changed = false;
      let ab, hab;
      cnt += n * (n-1); // total LUBs for ab and hab
      for(let a=0;a<n;a++) for(let b=a+1;b<n;b++){
        if(h[ab=lub[a][b]] != (hab=lub[h[a]][h[b]])){
          changed = true;
          cnt += n;
          for(let x=0;x<n;x++) if(leq[x][ab]){
            h[x] = glb[h[x]][hab], cnt+=1;
          }
        }
      }
    }
    return {h, cnt};
  }


  /** @param {number[]} h */
  const GMeetMonoLazy = (h)=>{
    let cnt = 0;
    cnt += m;
    monoMaxBelow(L, h);
    let changed = true;
    while(changed){
      changed = false;
      let ab, hab;
      cnt += n * (n-1); // total LUBs for ab and hab
      for(let a=0;a<n;a++) for(let b=a+1;b<n;b++){
        if(h[ab=lub[a][b]] != (hab=lub[h[a]][h[b]])){
          cnt ++, changed=true;
          h[ab] = glb[h[ab]][hab];
        }
      }
      if(changed) cnt+=m, monoMaxBelow(L, h);
    }
    return {h, cnt};
  }


  // Functions for handling tuples in GMeetPlus:

  // Representation of tuples (i,j) in [0,..n) as numbers in [0,..n^2).
  // Order does not matter, i.e. (i,j)=(j,i).
  /** @type {(a:number, b:number)=>number}*/
  const pack2 = (a,b)=> (a>b? pack2(b,a): a*n+b);

  /** @type {(value:number)=>number[]}*/
  const unpack2 = (value)=>[Math.floor(value/n), value%n];

  /** @template T @param {Set<T>} set @returns {T}*/
  const setPop = (set)=>{ // Pop an element of a set
    for(let k of set){ set.delete(k); return k; }
    throw new Error('Empty set');
  }

  /** @param {number[]} h */
  const GMeetPlus = (h)=>{
    /*Based on the implementation in Santiago's repository. delta.py, line 557.*/
    let cnt = 0;
    cnt += m;
    monoMaxBelow(L, h);
    // (sup, con, fail) as in the paper. Actually, con and fail are global sets (not array of sets like sup).
    /** @type {Set<number>[]}*/ const sup = range(n).map(()=>(new Set()));
    /** @type {Set<number>  }*/ const con = new Set()
    /** @type {Set<number>  }*/ const fail = new Set();

    /** @param {number} u */
    const checkSupports=(u)=>{
      for(let v=0;v<n;v++){
        cnt += 2;
        const w = lub[u][v];
        if(lub[h[u]][h[v]] != h[w]){
          sup[w].delete(pack2(u, v));
          decideAdd(u, v);
        }
      }
    }
    /** @param {number} u @param {number} v */
    const decideAdd = (u, v)=>{
      // Adds [u,v] to either con, sup or fail
      cnt += 2;
      const w = lub[u][v];
      if(lub[h[u]][h[v]] == h[w]) sup[w].add(pack2(u, v));
      else if(cnt++, gt[h[w]][lub[h[u]][h[v]]]) con.add(pack2(u,v)); // ** differs from Santiago's code
      else fail.add(pack2(u, v));
    }
    //for(let a=0;a<n;a++) for(let b=a;b<n;b++)
    for(let [a,b] of uncomparables) decideAdd(a, b);

    while(con.size){
      cnt += 2;
      const [u,v] = unpack2(setPop(con));
      const w = lub[u][v];
      const isCon = gt[h[w]][lub[h[u]][h[v]]]; // **
      if(!isCon){ decideAdd(u,v); continue; }
      // assert(!seen[pack3(u,v,w)]);
      // seen[pack3(u,v,w)]=true;
      h[w] = lub[h[u]][h[v]];
      for(let value of sup[w]) fail.add(value);
      sup[w] = new Set();
      sup[w].add(pack2(u, v));
      checkSupports(w);

      while(fail.size>0){
        cnt += 3;
        const [x, y] = unpack2(setPop(fail));
        const z = lub[x][y];
        const isFail = !geq[h[z]][lub[h[x]][h[y]]]; // **
        if(!isFail){ decideAdd(x, y); continue; }
        for(let xy of [x,y]){
          cnt += 1;
          if(!geq[h[z]][h[xy]]){
            cnt += 1;
            h[xy] = glb[h[xy]][h[z]];
            for(let value of sup[xy]) fail.add(value);
            sup[xy].clear();
            checkSupports(xy);
          }
        }
        cnt += 1;
        if(lub[h[x]][h[y]] == h[z]) sup[z].add(pack2(x, y));
        else con.add(pack2(x, y));
      }
    }
    return {h, cnt};
  }

  
  /** @type {[number,number][][]} */
  const pairsWhoseLubIs = range(n).map(()=>[]);
  for(let a=0; a<n; a++) for(let b=a; b<n; b++){
    pairsWhoseLubIs[lub[a][b]].push([a,b]);
  }
  const arrayGlb = (/**@type {number[]}*/arr)=> arr.reduce((cum, value)=> glb[cum][value], top);
  const arrayEq = (/**@type {number[]}*/a, /**@type {number[]}*/b)=>{
    if(a.length!=b.length) return false;
    for(let i=0; i<a.length; i++) if(a[i]!=b[i]) return false;
    return true;
  }
  /** @param {number[]} h */
  const DMeetPlus = (h)=>{
    for(let x=0; x<n; x++) if(children[x].length>1) h[x] = h[bottom];
    // Computes the minimal monotone above h in-place.
    for(let x of L.topoDownUp){
      if(children[x].length>=2){
        h[x] = lub[h[children[x][0]]][h[children[x][1]]]
      } else if(children[x].length==1) h[x] = lub[h[x]][h[children[x][0]]];
    }
    return {h, cnt:n+m};
  }


  return {
    GMeetStar,
    GMeetMonoStar,
    GMeetMonoLazy,
    GMeetPlus,
    DMeetPlus,
  };
}


// const exampleNonMod = {
//   L:Lattice.fromChildren([[],[0],[0],[0],[1,2],[2,3],[4,5],[6]]),
//   f: [0, 3, 2, 1, 5, 4, 6, 6],
//   g: [0, 7, 6, 2, 7, 6, 7, 7],
// };
// console.log(latticeAlgorithms(exampleNonMod.L).DMeetIrr(exampleNonMod.f, exampleNonMod.g));
// console.log(latticeAlgorithms(exampleNonMod.L).GMeetNaiveLoop(exampleNonMod.f, exampleNonMod.g));
// console.log(latticeAlgorithms(exampleNonMod.L).GMeetMonoLateIrr(exampleNonMod.f, exampleNonMod.g));

// const exampleM5 = {
//   L:Lattice.fromChildren([[],[0],[0],[2],[1,3]]),
//   h: [0, 2, 0, 2, 3],
// };
// console.log(latticeAlgorithms(exampleM5.L).GMeetNaiveLoop(exampleM5.h).h);
// console.log(latticeAlgorithms(exampleM5.L).GMeetTest(exampleM5.h).h);
