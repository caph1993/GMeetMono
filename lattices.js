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
    curr = (curr*base+1)%bigPrime;
    return curr%maxValue;
  }
  return next;
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

  /** @param {number} k */
  function presets(k){ // k is the seed and the max size at the same time
    k = Math.max(2, k);
    let children = powerset(1);
    let mod = 2;
    const next = RNG(k);
    while(children.length<k){
      if(next()%mod==0){
        if(children.length*2 > k) continue;
        children = twiceChildren(children);
        mod *= 2;
      } else{
        const [a,b] = randomEdge(children, next());
        let nNodes = 1;
        while(next()%4==0) nNodes += 1;
        if(children.length+nNodes > k) continue;
        children = addNodesBetween(children, [a,b], nNodes);
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
    for(let a=0;a<n;a++) for(let b=0;b<n;b++){
      geq[a][b] = leq[b][a];
      gt[a][b] = geq[a][b] && a!=b;
      lt[a][b] = leq[a][b] && a!=b;
    }
    const glb = zeroMat();
    const lub = zeroMat();
    for(let a=0;a<n;a++) for(let b=a;b<n;b++){
      glb[a][b] = glb[b][a] = range(n).filter((x)=>
        leq[x][a] && leq[x][b]
      ).reduce((x,y)=> leq[x][y]?y:x);
      lub[a][b] = lub[b][a] = range(n).filter((x)=>
        geq[x][a] && geq[x][b]
      ).reduce((x,y)=> geq[x][y]?y:x);
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
    const topoDownUp = topoDfs(children);
    const topoUpDown = topoDfs(parents);

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

    const {GMeetNaiveLoop} = latticeAlgorithms(this);
    this.GMeet = GMeetNaiveLoop;
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
  /** @param {number} k */
  static preset(k){
    const children = utilsChildren.presets(k);
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
    const f = this.randomMonotoneF();
    const {h} = this.GMeet(f)
    return h;
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

  // Common functions:

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



  /** @param {number[]} f @param {number[]?} g*/
  const  GMeetNaiveSlowest = (f, g=null)=>{
    // Find one conflict, fix it and repeat.
    let cnt = 0;
    const h = range(n).map(x => glb[f[x]][g?(cnt++,g[x]):top]);
    const findOneConflict = ()=>{
      for(let a=0;a<n;a++) for(let b=a+1;b<n;b++){
        cnt+=2;
        if(h[lub[a][b]] != lub[h[a]][h[b]]) return [a,b];
      }
      return [-1,-1];
    }
    while(true){
      const [a,b] = findOneConflict();
      if(a==-1) break;
      cnt += 3;
      const ab = lub[a][b];
      const c = lub[h[a]][h[b]];
      if(gt[ h[ab] ][ c ]) h[ab] = c;
      else {
        h[a] = glb[h[a]][h[ab]];
        h[b] = glb[h[b]][h[ab]];
        cnt+=2;
      }
    }
    return {h, cnt};
  }

  /** @param {number[]} f @param {number[]?} g*/
  const  GMeetNaiveSlow = (f, g=null)=>{
    // Find many conflicts, fix them and repeat.
    let cnt = 0;
    const h = range(n).map(x => glb[f[x]][g?(cnt++,g[x]):top]);
    const findAllConflicts = ()=>{
      let conflicts = [];
      for(let a=0;a<n;a++) for(let b=a+1;b<n;b++){
        cnt += 2;
        if(h[lub[a][b]] == lub[h[a]][h[b]]) continue;
        conflicts.push(pack2(a,b));
      }
      return conflicts
    }
    while(true){
      const conflicts = findAllConflicts();
      if(!conflicts.length) break;
      for(let [a,b] of conflicts.map(unpack2)){
        cnt += 2;
        const ab = lub[a][b];
        const c = lub[h[a]][h[b]];
        if(h[ab] == c) continue;
        cnt++;
        if(gt[ h[ab] ][ c ]) h[ab] = c;
        else {
          h[a] = glb[h[a]][h[ab]];
          h[b] = glb[h[b]][h[ab]];
          cnt+=2;
        }
      }
    }
    return {h, cnt};
  }

  /** @param {number[]} f @param {number[]?} g*/
  const  GMeetNaiveLoop = (f, g=null)=>{
    // Find conflicts, fixing them immediately
    let cnt = 0;
    const h = range(n).map(x => glb[f[x]][g?(cnt++,g[x]):top]);
    let changed = true;
    while(changed){
      changed = false;
      for(let a=0;a<n;a++) for(let b=a+1;b<n;b++){
        cnt += 2;
        const ab = lub[a][b];
        const c = lub[h[a]][h[b]];
        if(h[ab] == c) continue;
        changed = true;
        cnt++;
        if(gt[ h[ab] ][ c ]) h[ab] = c;
        else {
          h[a] = glb[h[a]][h[ab]];
          h[b] = glb[h[b]][h[ab]];
          cnt += 2;
        }
      }
    }
    return {h, cnt};
  }

  /** @param {number[]} f @param {number[]?} g*/
  const GMeetMonoNaive = (f, g=null)=>{
    let cnt = 0;
    const h = range(n).map(x => glb[f[x]][g?(cnt++,g[x]):top]);
    cnt = m;
    monoMaxBelow(L, h);
    let changed = true;
    while(changed){
      changed = false;
      for(let [a,b] of uncomparables){
        cnt += 2;
        const ab = lub[a][b];
        const c = lub[h[a]][h[b]];
        if(h[ab] == c) continue;
        changed = true;
        cnt+=n;
        for(let x=0;x<n;x++) if(leq[x][ab]){
          h[x] = glb[h[x]][c], cnt+=1;
        }
      }
    }
    return {h, cnt};
  }


  /** @param {number[]} f @param {number[]?} g*/
  const GMeetMonoLate = (f, g=null)=>{
    let cnt = 0;
    const h = range(n).map(x => g?(cnt++,glb[f[x]][g[x]]):f[x]);
    cnt += m;
    monoMaxBelow(L, h);
    let changed = true;
    while(changed){
      changed = false;
      for(let [a,b] of uncomparables){
        cnt += 3;
        const ab = lub[a][b];
        const c = lub[h[a]][h[b]];
        if(geq[c][h[ab]]) continue;
        cnt += 1;
        h[ab] = glb[h[ab]][c], changed=true;
      }
      if(changed) cnt+=m, monoMaxBelow(L, h);
    }
    return {h, cnt};
  }

  /** @param {number[]} f @param {number[]?} g*/
  const GMeetPlus = (f, g=null)=>{
    /*Based on the implementation in Santiago's repository. delta.py, line 557.*/
    let cnt = 0;
    const h = range(n).map(x => g?(cnt++,glb[f[x]][g[x]]):f[x]);
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

  /** @param {number[]} f @param {number[]?} g*/
  const GMeetConfirm = (f, g=null)=>{
    let cnt = 0;
    const h = range(n).map(x => g?(cnt++,glb[f[x]][g[x]]):f[x]);
    cnt += m;
    monoMaxBelow(L, h);
    cnt += uncomparables.length;
    const set = new Set(uncomparables.map(([a,b])=>pack2(a,b)));
    cnt += n;
    const confirmed = new Set(range(n).filter(x=>h[x]==h[bottom]));
    const joinIrr = range(n).filter(x=>children[x].length==1).map(x=>[children[x][0], x]);
    //shuffle(notCmp);
    let outer = 0;
    let changed = true;
    while(changed){
      changed = false;
      for(let [a,b] of [...set].map(unpack2)){
        cnt += 1;
        const ab = lub[a][b];
        if(confirmed.has(ab)) set.delete(pack2(a,b));
        const c = lub[h[a]][h[b]];
        if(h[ab] == c) continue;
        changed = true;
        if(gt[ h[ab] ][ c ]) h[ab] = c;
        else{
          h[a] = glb[h[a]][h[ab]];
          h[b] = glb[h[b]][h[ab]];
        }
        let conf = confirmed.has(a) && confirmed.has(b);
        conf ||= confirmed.has(a) && h[a]==h[ab];
        conf ||= confirmed.has(b) && h[b]==h[ab];
        if(conf) confirmed.add(ab), set.delete(pack2(a,b));
      }
      // confirm joinIrr
      for(let [a,b] of joinIrr){
        cnt += 1;
        if(confirmed.has(a) && h[b]==h[a]) confirmed.add(b);
      }
      //if(++outer>=3) console.log(outer);
    }
    return {h, cnt};
  }

  /** @param {number[]} f @param {number[]?} g*/
  const GMeetConfirmMono = (f, g=null)=>{
    let cnt = 0;
    const h = range(n).map(x => g?(cnt++,glb[f[x]][g[x]]):f[x]);
    cnt += m;
    monoMaxBelow(L, h);
    cnt+=n;
    const joinIrr = range(n).filter(x=>children[x].length==1).map(x=>[children[x][0], x]);
    const confirmed = new Set(range(n).filter(x=>h[x]==h[bottom]));
    const pending = [...confirmed]; // to propagate
    while(pending.length){
      while(pending.length){
        const a = /**@type {number}*/(pending.pop());
        for(let b of confirmed){
          cnt += 1;
          let ab = lub[a][b];
          if(confirmed.has(ab)) continue;
          h[ab] = lub[h[a]][h[b]];
          confirmed.add(ab);
          pending.push(ab);
        }
      }
      cnt += n+m;
      monoMaxBelow(L, h);
      cnt += n+m;
      for(let x=0;x<n;x++) if(!confirmed.has(x)){
        for(let y of children[x]) if(h[x]==h[y]&&confirmed.has(y)){
          confirmed.add(x);
          pending.push(x);
        }
      }
      // confirm joinIrr
      for(let [a,b] of joinIrr) if(!confirmed.has(b)){
        cnt += 1;
        if(confirmed.has(a) && h[b]==h[a]){
          confirmed.add(b); pending.push(b);
        }
      }
    }
    // let {h:h2, cnt:cnt2} =  GMeetNaiveLoop(h)
    // cnt+=cnt2;
    return {h, cnt };
  }

  /** @param {number[]} f @param {number[]?} g*/
  const DMeetIrr = (f, g=null)=>{
    let cnt = 0;
    const h = range(n).map(x => g?(cnt++,glb[f[x]][g[x]]):f[x]);
    for(let x of range(n)) if(x!=bottom && children[x].length!=1) h[x] = bottom;
    monoMinAbove(L, h);
    return {h, cnt};
  }

  /** @param {number[]} f @param {number[]?} g*/
  const GMeetMonoLateIrr = (f, g=null)=>{
    let cnt = 0;
    const h = range(n).map(x => g?(cnt++,glb[f[x]][g[x]]):f[x]);

    const irrUncomparables = [];
    for(let a=0;a<n;a++) if(children[a].length==1) for(let b=a+1;b<n;b++) if(children[b].length==1) if(!leq[a][b] && !leq[b][a]) irrUncomparables.push([a,b]);

    cnt += m;
    monoMaxBelow(L, h);
    let changed = true;
    while(changed){
      changed = false;
      for(let [a,b] of irrUncomparables){
        cnt += 3;
        const ab = lub[a][b];
        const c = lub[h[a]][h[b]];
        if(geq[c][h[ab]]) continue;
        cnt += 1;
        h[ab] = glb[h[ab]][c], changed=true;
      }
      if(changed) cnt+=m, monoMaxBelow(L, h);
    }
    for(let x of range(n)) if(x!=bottom && children[x].length!=1) h[x] = bottom;
    monoMinAbove(L, h);
    return {h, cnt};
  }

  /** @param {number[]} f @param {number[]?} g*/
  const GMeetMonoLateIrr2 = (f, g=null)=>{
    let cnt = 0;
    const h = range(n).map(x => g?(cnt++,glb[f[x]][g[x]]):f[x]);

    const irrUncomparables = [];
    for(let a=0;a<n;a++) if(children[a].length==1) for(let b=a+1;b<n;b++) if(children[b].length==1) if(!leq[a][b] && !leq[b][a]) irrUncomparables.push([a,b]);

    const irrFor = range(n).map(()=>/** @type {[number,number][]}*/([]));
    for(let [a,b] of irrUncomparables){
      irrFor[lub[a][b]].push([a,b]);
    }
    cnt += m;
    monoMaxBelow(L, h);
    let changed = true;
    while(changed){
      changed = false;
      for(let x of range(n)){
        if(!irrFor[x].length) continue;
        let c = top;
        for(let [a,b] of irrFor[x]) c = glb[c][lub[h[a]][h[b]]];
        if(h[x]!=c){
          h[x] = c;
          for(let [a,b] of irrFor[x]){
            h[a] = glb[h[a]][c];
            h[b] = glb[h[b]][c];
          }
          changed = true;
        }
      }
      if(changed) cnt+=m, monoMaxBelow(L, h);
    }
    for(let x of range(n)) if(x!=bottom && children[x].length!=1) h[x] = bottom;
    monoMinAbove(L, h);
    return {h, cnt};
  }

  /** @param {number[]} f @param {number[]?} g*/
  const GMeetTest2 = (f, g=null)=>{
    // const {h, cnt} = GMeetMonoNaive(f, g);
    // for(let x of range(n)) if(x!=bottom && children[x].length!=1) h[x] = bottom;


    const irrUncomparables = [];
    for(let a=0;a<n;a++) if(children[a].length==1) for(let b=a+1;b<n;b++) if(children[b].length==1) if(!leq[a][b] && !leq[b][a]) irrUncomparables.push([a,b]);

    const irrFor = range(n).map(()=>/** @type {[number,number][]}*/([]));
    for(let [a,b] of irrUncomparables){
      irrFor[lub[a][b]].push([a,b]);
    }


    const /** @type {number[][]} */ triplesN5 = [];
    const/** @type {number[][]} */ triplesM3 = [];
    for(let x of range(n)){
      const aux = [...new Set(irrFor[x].reduce((prev, [a,b])=>(prev.push(a, b), prev), /** @type {number[]}*/([])))];
      for(let [a,b] of irrFor[x]) for(let c of aux){
        if(c==a || c==b) continue;
        const both = [[a,b], [b,a]];
        for(let [a,b] of both){
          if(lub[a][c]==x && glb[a][c]==glb[a][b]){
            if(leq[b][c]) triplesN5.push([a,b,c]);
            if(lub[b][c]==x && glb[b][c]==glb[a][b]) triplesM3.push([a,b,c]);
          }
        }
      }
    }
    const/** @type {number[][]} */ links = range(n).map(()=>[]);
    for(let [a,b,c] of triplesN5){
      links[c].push(a);
    }
    for(let [a,b,c] of triplesM3){
      links[a].push(b); links[a].push(c);
      links[b].push(a); links[b].push(c);
      links[c].push(a); links[c].push(b);
    }
    for(let x of range(n)) links[x] = [x, ...new Set(links[x])];

    let cnt = 0;
    const h0 = range(n).map(x => g?(cnt++,glb[f[x]][g[x]]):f[x]);
    const h = range(n).map(()=>bottom);
    const irr = range(n).filter(x=>children[x].length==1);
    cnt += 2*irr.length*irr.length;
    for(let a of irr) for(let b of irr){
      let ok = true;
      for(let aa of links[a]) if(!leq[b][h0[aa]]) ok = false;
      if(!ok) continue;
      console.log(links[a], b)
      for(let aa of links[a]) h[aa] = lub[h[aa]][b];
    }
    h[bottom] = h0[bottom];
    monoMinAbove(L, h);

    return {h, cnt};
  }
  /** @param {number[]} f @param {number[]?} g*/
  const GMeetTest = (f, g=null)=>{
    // const {h, cnt} = GMeetMonoNaive(f, g);
    // for(let x of range(n)) if(x!=bottom && children[x].length!=1) h[x] = bottom;
    let cnt = 0;
    const h = range(n).map(x => g?(cnt++,glb[f[x]][g[x]]):f[x]);
    for(let x of L.topoUpDown){
      for(let a=0;a<n;a++) for(let b=0;b<n;b++) if(lub[a][b]==x){
        // const ab = lub[a][b];
        // cnt+=4;
        h[a] = glb[h[a]][h[x]];
        h[b] = glb[h[b]][h[x]];
        h[x] = glb[h[x]][lub[h[a]][h[b]]];
      }
    }
    // const confirmed = new Set([bottom]);
    // while(confirmed.size < n){
    //   let more = []
    //   for(let a of [...confirmed]) for(let b of [...confirmed]) if(!confirmed.has(lub[a][b])){
    //     const ab = lub[a][b];
    //     h[ab] = lub[h[a]][h[b]];
    //     more.push(ab);
    //   }
    //   for(let b of more) confirmed.add(b);
    //   more = [];
    //   for(let a of [...confirmed]) for(let b of parents[a]) if(children[b].length==1 && !confirmed.has(b)){
    //     //for(let x of [...confirmed]) if(leq[b][lub[a][x]]) console.warn(a,b,x);
    //     for(let x of [...confirmed]) if(leq[b][lub[a][x]]) h[b] = glb[h[b]][lub[h[a]][h[x]]];
    //     more.push(b);
    //   }
    //   for(let b of more) confirmed.add(b);
    //   //console.log([...confirmed]);
    // }
    return {h, cnt};
  }




  // /** @param {number[]} f @param {number[]?} g*/
  // const GMeetMono = (f, g=null)=>{
  //   let cnt = 0;
  //   const h = range(n).map(x => glb[f[x]][g?(cnt++,g[x]):top]);
  //   cnt = m;
  //   monoMaxBelow(L, h);
  //   let pending = uncomparables.length;
  //   for(let i=0; pending>0; pending--, i=(i+1)%uncomparables.length){
  //     const [a, b] = uncomparables[i];
  //     const ab = lub[a][b];
  //     const c = lub[h[a]][h[b]];
  //     if(h[ab]==c) continue;
  //     pending = uncomparables.length;
  //     for(let x=0;x<n;x++) if(leq[x][ab]){
  //       h[x] = glb[h[x]][c], cnt+=1;
  //     }
  //   }
  //   return {h, cnt};
  // }



  const triples = range(n).map(()=>/**@type {number[][]}*/([]));
  for(let a=0;a<n;a++) for(let b=a+1;b<n;b++){
    //cnt+=1;
    const ab = lub[a][b];
    if(ab==a || ab==b) continue;
    const triple = [a,b,ab];
    triples[a].push(triple);
    triples[b].push(triple);
    triples[ab].push(triple);
  }

  /** @param {number[]} f @param {number[]?} g*/
  const GMeetMonoDfs = (f, g=null)=>{
    let cnt = 0;
    const h = range(n).map(x => g?(cnt++,glb[f[x]][g[x]]):f[x]);
    cnt += m;
    monoMaxBelow(L, h);

    let seen = new Set();
    /** @param {number} b @param {number} bound */
    const dfs = (b, bound)=>{
      cnt += 1;
      seen.add(b);
      const hb = glb[h[b]][bound];
      if(h[b]==hb) return;
      if(!inQueue[b]) inQueue[b] = true, queue.push(b);
      h[b] = hb;
      cnt += children[b].length;
      for(let a of children[b]) if(!seen.has(a)) dfs(a, bound);
    }

    const queue = range(n);
    const inQueue = range(n).map(()=>true);

    while(queue.length){
      const x = /**@type {number}*/(queue.pop());
      inQueue[x] = false;
      for(let [a,b,ab] of triples[x]){
        cnt += 1;
        const hab = lub[h[a]][h[b]];
        if(h[ab] != hab) seen.clear(), dfs(ab, hab);
      }
    }
    return {h, cnt};
  }


  /** @param {number[]} f @param {number[]?} g*/
  const GMeetEasy = (f, g=null)=>{
    let cnt = 0;
    const h = range(n).map(x => glb[f[x]][g?(cnt++,g[x]):top]);
    // //cnt = m;
    // let changed = true;
    // while(changed){
    //   changed = false;
    //   for(let a=0;a<n;a++) for(let b=a+1;b<n;b++){
    //     cnt += 1;
    //     const ab = lub[a][b];
    //     let hab = lub[h[a]][h[b]];
    //     if(h[ab]==hab) continue;
    //     cnt += 3;
    //     h[ab] = glb[h[ab]][hab];
    //     h[a] = glb[h[a]][h[ab]];
    //     h[b] = glb[h[b]][h[ab]];
    //     changed = true;
    //   }
    // }
    let pending = (n*(n+1))>>1;
    for(let a=0; pending; a=(a+1)%n) for(let b=(a+1)%n; pending; b=(b+1)%n){
      pending--;
      cnt += 1;
      const ab = lub[a][b];
      let hab = lub[h[a]][h[b]];
      if(h[ab]==hab) continue;
      cnt += 3;
      h[ab] = glb[h[ab]][hab];
      h[a] = glb[h[a]][h[ab]];
      h[b] = glb[h[b]][h[ab]];
      pending = (n*(n+1))>>1;
    }
    return {h, cnt};
  }

  /** @param {number[]} f @param {number[]?} g*/
  const GMeetEasy2 = (f, g=null)=>{
    let cnt = 0;
    const h = range(n).map(x => glb[f[x]][g?(cnt++,g[x]):top]);
    cnt = m;
    const queue = range(n);
    const inQueue = range(n).map(()=>true);
    while(queue.length){
      const x = /**@type {number}*/(queue.pop());
      inQueue[x] = false;
      for(let [a,b,ab] of triples[x]){
        cnt += 1;
        let hab = lub[h[a]][h[b]];
        if(h[ab]==hab) continue;
        cnt += 3;
        if(!inQueue[ab]) inQueue[ab]=true, queue.push(ab);
        const ha = glb[h[a]][h[ab]];
        const hb = glb[h[b]][h[ab]];
        if(h[a]!=ha && !inQueue[a]) inQueue[a]=true, queue.push(a);
        if(h[b]!=hb && !inQueue[b]) inQueue[b]=true, queue.push(b);
        h[ab] = glb[h[ab]][hab];
        h[a] = ha;
        h[b] = hb;
      }
    }
    return {h, cnt};
  }
  /** @param {number[]} f @param {number[]?} g*/
  const GMeetEasy3 = (f, g=null)=>{
    let cnt = 0;
    const h = range(n).map(x => glb[f[x]][g?(cnt++,g[x]):top]);
    cnt = m;
    while(true){
      let h0 = [...h];
      for(let [a,b] of uncomparables){
        const ab = lub[a][b];
        cnt += 3;
        h[ab] = glb[h[ab]][lub[h[a]][h[b]]];
        h[a] = glb[h[a]][h[ab]];
        h[b] = glb[h[b]][h[ab]];
      }
      if(range(n).reduce((cum, i)=> cum&&(h[i]==h0[i]), true)) break;
    }
    return {h, cnt};
  }

  return {
    //GMeetNaiveSlowest, GMeetNaiveSlow,
    GMeetNaiveLoop,
    GMeetEasy,
    GMeetEasy2,
    GMeetEasy3,
    GMeetMonoNaive,
    GMeetMonoDfs,
    GMeetMonoLate,
    GMeetPlus,
    //GMeetConfirmMono, GMeetConfirm, DMeetIrr,
    //GMeetMonoLateIrr, GMeetMonoLateIrr2, GMeetTest,
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
