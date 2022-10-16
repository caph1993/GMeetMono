//@ts-check
/// <reference path="./lattices.js" />
/// <reference path="./other-tests/types.js" />
/// <reference path="./xxhash.js"/>


caph.injectStyle(`
.CodeMirror{
  height: 100%;
}
`);
caph.pluginDefs['implementations'] = ({})=>{
  return caph.parse`
  <${caph.plugin('@codemirror')} mode="text/javascript" theme="monokai"
    onId=${(id)=>caph.injectStyle(`#${id} .CodeMirror{height: 100%;}
    `)}
  >
    ${latticeAlgorithms.toString()}
  </>
  `
}


caph.injectStyle(`
#graph {
  text-align: center;
  background-color: white; overflow-x:clip;
  box-shadow: 0px 0px 10px 0px black;
  margin: 5px;
}
`)
caph.pluginDefs['viz'] = ({vizCode})=>{
  const [html, setHtml] = preact.useState(caph.parse``);
  preact.useEffect(async ()=>{
    if(!vizCode){ setHtml(null); return;}
    setHtml(caph.parse`<div id="graph" />`);
    await caph.until(()=>document.querySelector('#graph'));
    d3.select("#graph").graphviz().renderDot(vizCode);
  },[vizCode]);
  return html;
}




/** @param {{lattice:Lattice?}} props */
caph.pluginDefs['vizLattice'] = ({lattice})=>{
  const vizLoading = `graph G{\nbgcolor=lightgray\nfontcolor=blue\n a [label="Loading"]; }`;
  const [viz, setViz] = preact.useState(/** @type {string|null}*/(vizLoading));

  preact.useEffect(()=>{
    if(!lattice) return setViz(vizLoading);
    const {n, children} = lattice;
    if(n >= 60) return setViz(`graph G{\nbgcolor=lightgray\nfontcolor=blue\n a [label="Too large to be displayed: ${n} nodes"]; }`);
    let arrows = [];
    for(let b=0;b<n;b++) for(let a of children[b]){
      arrows.push(`${b} -> ${a};`); 
    }
    setViz(`digraph G{\nbgcolor=lightgray\nfontcolor=blue\n${arrows.join('\n')}\n}`);
  }, [lattice]);

  return caph.parse`<${caph.plugin('viz')} vizCode=${viz}/>`;
}




const algoNames = [...Object.keys(latticeAlgorithms(Lattice.powerset(1)))];
const latticeAlgorithmsWithCounters = (L)=>{
  const _algos = latticeAlgorithms(L);
  return algoNames.map(name=>({
    name, algorithm:_algos[name],
    fails:0, failExample:null,
    timeSum:0, timeAvg:0, timeMax:0,
    cntSum:0, cntMax:0, 
  }));
}

const typesOfF = [
  'join of monotone and join-endomorphism',
  'monotone',
  'meet of join-endomorphisms',
  'arbitrary',
  'join-endomorphism',
];

/** @param {Lattice} L @param {any} algos @param {number} ntc @param {string} typeOfF*/ 
const tests = function*(L, algos, ntc, typeOfF){
  //console.log(L);
  const fails = {};
  const failExample = {};
  const outputs = {};
  // hashRolling();

  const batchSize = L.n<=20? ntc: Math.min(ntc, L.n>100? 3: Math.max(50, ntc>>2));
  // Small batches only valid for large n, where executions take at least 1ms

  const seenInputs = new Set();
  const seenOutputs = new Set();
  for(let tc=0; tc<ntc; tc+=batchSize){
    const inputs = [];
    const thisBatch = Math.min(batchSize, ntc-tc);
    for(let _ of range(thisBatch)){
      let h = (()=>{let f,g; let {n,glb,lub} = L; switch(typeOfF){
        case 'arbitrary': return L.randomArbitraryF();
        case 'monotone': return L.randomMonotoneF();
        case 'join-endomorphism': return L.randomJoinF();
        case 'meet of join-endomorphisms':
          f = L.randomJoinF();
          g = L.randomJoinF();
          return range(n).map(x=>glb[f[x]][g[x]]);
        case 'join of monotone and join-endomorphism':
          f = L.randomMonotoneF();
          g = L.randomJoinF();
          return range(n).map(x=>lub[f[x]][g[x]]);
        default: throw `type ${typeOfF} not in ${typesOfF}`;
      }})();
      seenInputs.add(hashRolling(h));
      inputs.push(h);
    }
    let expected = [];
    let first = true;
    for(let e of algos){
      const start = Date.now();
      const outputs = inputs.map(h=>e.algorithm([...h]));
      const msElapsed = (Date.now()-start); // caution! integer!
      if(first){
        expected = outputs.map(({h})=>h);
        for(let h of expected) seenOutputs.add(hashRolling(h));
      }
      first = false;
      
      e.timeSum += msElapsed*1e-3;
      e.timeAvg = e.timeSum/(tc+thisBatch);
      e.cntSum += d3.sum(outputs, d=>d.cnt);
      e.cntMax = Math.max(e.cntMax, d3.max(outputs, d=>d.cnt));

      for(let [h, out, exp] of d3.zip(inputs, outputs.map(({h})=>h), expected)){
        if(d3.some(d3.zip(out, exp), ([a,b])=>a!=b)){
          e.fails++;
          if(!e.failExample) e.failExample = {input:h, output:out, expectedOutput: exp};
        }
      }
    }
    yield {outputs, fails, failExample, 
      different: {
        inputs:seenInputs.size,
        outputs:seenOutputs.size,
      },
      progress: tc+thisBatch,
    };
  }
}



caph.injectStyle(`
.test-results {border-collapse:collapse; margin:auto;}
.test-results td,.test-results th{
  text-align: right;
  padding-right:0.3vw;
  padding-left:0.3vw;
  border: black 1px solid;
}
.display-none { display:none; }
`)
caph.pluginDefs['latticeCode'] = (()=>{
const emergency = {stop:false};
return ({})=>{
  const setModal = preact.useContext(modalContext);
  const [lattice, setLattice] = preact.useState(Lattice.powerset(3));
  const [loading, setLoading] = preact.useState(false);

  const [selected, setSelected] = preact.useState(Object.fromEntries(algoNames.map(name=>[name, true])));

  const [ntc, setNTC] = preact.useState(200);
  
  const showFailExample = preact.useCallback((lattice, {input, output, expectedOutput})=>{
    setModal(caph.parse`
      Input: ${JSON.stringify(input)}
      <br>
      ExpectedOutput: ${JSON.stringify(expectedOutput)}
      <br>
      Output: ${JSON.stringify(output)}
      <br>
      <div (component)="vizLattice" lattice=${lattice}/>
    `)
  },[]);

  const [out, setOut] = preact.useState(caph.parse``);
  const [seed, setSeed] = preact.useState(0);
  const [running, setRunning] = preact.useState(false);
  const [showAlgorithms, setShowAlgorithms] = preact.useState(false);
  const [typeOfF, setTypeOfF] = preact.useState('join of monotone and join-endomorphism');
  const testsParent = preact.useCallback(async (lattice, ntc, typeOfF, selected)=>{
    setRunning(true);
    emergency.stop = false;
    setOut('...');
    await caph.sleep(100);
    const startMs = Date.now();
    const nextIntervalMs = 100;
    let nextOut = startMs + nextIntervalMs;
    const algos = latticeAlgorithmsWithCounters(lattice).filter(({name})=>selected[name]);
    const report = ({different, progress})=> setOut(caph.parse`
    <div>
    <div (component)="@code">
    Seconds:  ${((Date.now()-startMs)/1000).toFixed(0)}<br>
    Progress: ${progress}/${ntc}, of which, ${different.inputs}/${progress} different inputs, ${different.outputs}/${progress} different outputs<br>
    </>
    <table class="test-results">
    <thead>
      <tr><td>Algorithm<td>Time<br>(total)<td>Avg.<br>cnt.<td>Worst<br>cnt.<td>Total<br>cnt.<td>Fails</td></tr>
    <tbody>
    ${algos.map((e)=>caph.parse`
      <tr>
      <td>${e.name}
      <td>${(1000*e.timeSum).toFixed(0)} ms
      <td>${''+(e.cntSum/progress).toFixed(2)}
      <td>${e.cntMax}
      <td>${''+e.cntSum}
      <td>${e.fails==0?''+e.fails:caph.parse`
        <button onClick=${()=>showFailExample(lattice, /** @type {*}*/(e.failExample))}>${''+e.fails}</>
      `}
      </td>
      </tr>
    `)}
    </tbody>
    </table>
    Lattice size: $n=${lattice.n}$ nodes and $m=${lattice.m}$ edges ($n^2 = ${lattice.n*lattice.n}$). $${(lattice.n*(lattice.n-1))/2}$ different pairs.
    </>
    `);
    try{
    for(let result of tests(lattice, algos, ntc, typeOfF)){
      if(Date.now()>nextOut||result.progress==ntc){
        nextOut+=nextIntervalMs;
        report(result);
        await caph.sleep(100/ntc);
      }
      if(emergency.stop||result.progress==ntc){
        let {failExample} = result;
        for(let k in failExample) if(failExample[k]) console.log('Fail Example', k, failExample[k])
        break;
      }
      // if(!ok){
      //   console.log(h);
      //   console.log(outputs);
      //   setRunning(false);
      //   report(profiler, 'Mismatch! Press F12 for details');
      //   break;
      // }
    }} finally{ setRunning(false); }
  }, [tests]);
  
  return caph.parse`
  <div (component)="@tabs" labels=${['Lattice', 'Tests']}>
    <div>
      Choose lattice:${' '}
      ${[2,3,4,5,6,7,8].map(log2n=>caph.parse`
        <button disabled=${running} onClick=${async ()=>{
          setLoading(true);
          await caph.sleep(250);
          setLattice(Lattice.powerset(log2n)); // takes time
          setLoading(false);
        }}>${log2n}-powerset</button>
      `)}
      ${[5,15,30,50,70,100,500].map(k=>caph.parse`
        <button disabled=${running} onClick=${async ()=>{
          setLoading(true);
          await caph.sleep(250);
          setLattice(Lattice.preset(k, seed)); // takes time
          setLoading(false);
        }}>preset-${k}</button>
      `)}
      <br>
      Number of elements: ${lattice.n}
      <br>
      Seed for presets: seed(${seed.toFixed(0)}). ${[0,1,2,42].map(k=>caph.parse`
        <button disabled=${running} onClick=${()=>setSeed(k)}>${`seed(${k})`}</button>
      `)}
      <br>
      <br>
      <${caph.plugin('vizLattice')} lattice=${loading?null:lattice}/>
    </>
    <div>
      (Running on the chosen lattice of ${lattice.n} elements)<br>
      <button disabled=${running} onClick=${()=>testsParent(lattice, ntc, typeOfF, selected)}>Run ${ntc} experiments</>
      <button disabled=${running} onClick=${()=>setNTC(Math.floor(ntc*1.618))}>More</>
      <button disabled=${running} onClick=${()=>setNTC(Math.max(2, ntc>>1))}>Less</>
      <button disabled=${!running} onClick=${()=>emergency.stop=true}>Stop</>
      <br>
      Algorithms: <button onClick=${()=>setShowAlgorithms(!showAlgorithms)}>${showAlgorithms?'Hide list':'Show list'}</button>
      <ul class=${showAlgorithms?'':'display-none'}>
        ${algoNames.map((name)=>caph.parse`
          <li>
            <input type="checkbox" checked=${selected[name]} onClick=${()=>{selected[name] = !selected[name]; setSelected({...selected})}}/>
            ${' '}${name}
            </>
        `)}
      </>
      <br>
      Type of input function: ${ typesOfF.map(t=>
        caph.parse`<input type="radio" checked=${t==typeOfF} onClick=${()=>setTypeOfF(t)}/>${t}${' '}`
      )}
      <hr>
      ${out}
    </>
  </>
  `
}})();














caph.pluginDefs['paperExperiments'] = (()=>{

const global = {
  xAxis: [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000],
  running: false,
  nLattices: 10,
  nFunctions: 1000,
  timeLimit: 1e-3,
  // experiments: localStorage.getItem('paperExperiments')||[],
  changed: false,
  plotData: {},
  uiSetters: {},
};
global.plotData = [];

// Object.fromEntries(algoNames.map(name => [name, {
//   x: global.xAxis,
//   y: global.xAxis.map(()=>/**@type {number|null}*/(null)),
// }]));

const loop = async ()=>{
  const rngMain = RNG(0);
  const timedOut = new Set();
  for(let n of global.xAxis){
    const rngLSeed = RNG(rngMain());
    for(let lSeed of range(global.nLattices).map(()=>rngLSeed())){
      await caph.sleep(0); // Let the browser resolve other async actions
      const L = Lattice.preset(n, lSeed); // To do: Use seed!
      const typeOfF = 'join of monotone and join-endomorphism';
      const algos = latticeAlgorithmsWithCounters(L).filter(({name})=>!timedOut.has(name));
      for(let r of tests(L, algos, global.nFunctions, typeOfF)){
        if(!global.running) return;
      }
      for(let {name, timeAvg} of algos){
        global.plotData.push({name, n, lSeed, timeAvg});
        if(timeAvg>1.2*global.timeLimit) timedOut.add(name);
      }
      global.changed = true;
    }
  }
  global.uiSetters.setRunning(global.running=false);
}
(async ()=>{
  while(true){
    while(!global.running) await caph.sleep(50);
    await loop();
    console.log('SAVE');
  }
})();


const d3ObjPromise = async ()=>{
  const margin = {top: 10, right: 200, bottom: 50, left: 60},
  width = 600 - margin.left - margin.right,
  height = 300 - margin.top - margin.bottom;
  
  await caph.until(()=>document.querySelector('#my_dataviz'));
  await caph.sleep(500); // :/
  // append the svg object to the body of the page
  const svg = d3.select("#my_dataviz")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

  // Add X axis --> it is a date format
  const x = d3.scaleLog()
  .domain([1, d3.max(global.xAxis)])
  .range([ 0, width ]);
  svg.append("g")
  .attr("transform", `translate(0, ${height})`)
  .call(d3.axisBottom(x).ticks(5));

  // Add Y axis
  const y = d3.scaleLog()
    .domain([1e-6, global.timeLimit])
    .range([ height, 0 ]);
  svg.append("g")
    .call(d3.axisLeft(y));
  
  const color = d3.scaleOrdinal()
    .range(['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00','#ffff33','#a65628','#f781bf','#999999'])

  svg.append("text")
    .attr("class", "x label")
    .attr("fill", 'black')
    .attr("text-anchor", "middle")
    .attr("x", width*0.5)
    .attr("y", height+35)
    .text("Lattice size");
  
  svg.append("text")
    .attr("class", "y label")
    .attr("fill", 'black')
    .attr("text-anchor", "middle")
    .attr("y", -42)
    .attr("dx", -height*0.5)
    .attr("transform", "rotate(-90)")
    .text("WC runtime [seconds]");
  
  const linesContainer = svg.append("g");

  // Legend creation
  // create a list of keys
  let keys = algoNames;
  // Add one dot in the legend for each name.
  const x0 = width+20, y0=height*0.1;
  svg.selectAll("myDots")
    .data(keys)
    .enter()
    .append("circle")
      .attr("cx", x0)
      .attr("cy", (d,i)=> y0 + i*25)
      .attr("r", 7)
      .style("fill", (d)=> color(d))

  // Add one dot in the legend for each name.
  svg.selectAll("myLabels")
    .data(keys)
    .enter()
    .append("text")
      .attr("x", x0+20)
      .attr("y", (d,i)=> y0 + i*25 + 6)
      .style("fill", (d)=> color(d))
      .text((d)=> d)
      .attr("text-anchor", "left")
      .style("alignment-baseline", "middle")

  const refs = [];
  for(let power of [1, 2, 3])
    for(let x of global.xAxis)
      refs.push({power, x, y: 1e-6*Math.pow(x, power)})
  svg.selectAll("referenceCurves")
    .data(d3.group(refs, d=>d.power))
    .join("path")
      .style("stroke-dasharray", "5,5")
      .attr("stroke", 'black')
      .attr("stroke-width", 0.5)
      .attr("d", d=>(d3.line()
        .x(({x:xx})=>x(xx))
        .y(({y:yy})=>y(yy))
        (d[1])
      ))
    
  return {svg, x, y, color, linesContainer};
}

const groupedData = ()=>{
  let data = d3.flatRollup(global.plotData,
    (values)=>({
      timeAvg: Math.max(1e-6, d3.mean(values, d=>d.timeAvg)),
      timeMax: Math.max(1e-6, d3.max(values, d=>d.timeAvg)),
    }),
    d => d.name, d => d.n,
  );
  data = Array.from(data, ([name, n, props]) => ({name, n, ...props}));
  return data;
}

const rePlot = ({svg, x, y, color, linesContainer})=>{
  const data = groupedData();

  linesContainer.selectAll("path").remove();
  linesContainer.selectAll("circle").remove();

  linesContainer.selectAll("myLines")
    .data(d3.group(data, d => d.name))
    .join("path")
      .attr("fill", "none")
      .attr("stroke", (d)=>color(d[0]))
      .attr("stroke-width", 1.5)
      .attr("d", d=>(d3.line()
        .x(({n})=>x(n))
        .y(({timeMax})=>y(timeMax))
        (d[1])
      ))
  linesContainer.selectAll("myDots")
    .data(data)
    .join("circle")
      .attr("fill", ({name})=>color(name))
      .attr("r", 2)
      .attr("cx", ({n})=>x(n))
      .attr("cy", ({timeMax})=>y(timeMax))
  return;
}

(async ()=>{
  const d3Obj = await d3ObjPromise();
  global.changed = true;
  while(true){
    while(!global.changed) await caph.sleep(500);
    global.changed = false;
    global.uiSetters.setData([...groupedData()]);
    await rePlot(d3Obj);
  }
})();
return ({})=>{
  const [xAxis, setXAxis] = preact.useState(global.xAxis);
  const [nLattices, setNLattices] = preact.useState(global.nLattices);
  const [nFunctions, setNFunctions] = preact.useState(global.nFunctions);
  const [timeLimit, setTimeLimit] = preact.useState(global.timeLimit);
  const [running, setRunning] = preact.useState(global.running);
  const [data, setData] = preact.useState([]);
  preact.useEffect(()=>{
    global.uiSetters.setRunning=setRunning;
    global.uiSetters.setData=setData;
  }, []);
  preact.useEffect(()=>{global.xAxis=xAxis;}, [xAxis]);
  preact.useEffect(()=>{global.running=running;}, [running]);
  preact.useEffect(()=>{global.nLattices=nLattices;}, [nLattices]);
  preact.useEffect(()=>{global.nFunctions=nFunctions;}, [nFunctions]);
  preact.useEffect(()=>{global.timeLimit=timeLimit;}, [timeLimit]);

  
  return caph.parse`
  <div (component)="@tabs" labels=${['Experiments']}>
    <div>
      Lattice sizes: ${JSON.stringify(xAxis)}<br>
      Lattices per size: ${nLattices} (whenever possible)<br>
      Test functions per lattice: ${nFunctions}<br>
      Time limit: ${(timeLimit*1e6).toFixed(0)} $\mu$s<br>
      <button disabled=${running} onClick=${()=>setRunning(true)}>Run</button>
      <button disabled=${!running} onClick=${()=>setRunning(false)}>Stop</button>
      ${preact.useMemo(()=>caph.parse`<div id="my_dataviz" />`, [])}
      <table class="table">
        <thead>
        <th>$n$</th>
        ${algoNames.map(name=>caph.parse`<td>${name}</td>`)}
        </thead>
        <tbody>
        ${d3.flatGroup(data, ({n})=>n).map(([n, arr])=>
          caph.parse`<tr><td>${n}</>${algoNames.map(thisName=>
            caph.parse`<td>${
              arr.filter(({name})=>thisName==name)
              .map(({timeMax})=>caph.parse`${(timeMax*1e6).toFixed(0)} $\mu$s`)[0]||'TL'}</td>`
          )}</tr>`
        )}
        </tbody>
      </table>
      </>
    </>
  </>
  `
}})();
caph.injectStyle(`
table.table{ text-align: center; border-collapse: collapse; margin:auto; }
.table td, .table th{ padding: 0.3vh 0.5vw; border: solid 1px;  }
`)










// class Distraction {
//   constructor(){
//     class Div{
//       constructor(...children){}
//       set(key, value) {return this;}
//     }
//     class Button extends Div{
//       onClick(fn) {}
//     }
//     this.obj =  (new Div()).set('mode', 'something');
//     new Button().onClick(()=>)
//     `
//     <${caph.plugin('@codemirror')} mode="text/javascript" theme="monokai"
//       onId=${(id)=>caph.injectStyle(`#${id} .CodeMirror{height: 100%;}
//       `)}
//     >
//       ${latticeAlgorithms.toString()}
//     </>
//   `
//   }
// }


caph.injectStyle(`
.main-component{ padding: 1% 6% 3% 6%; max-width: 40em; margin: auto;}
.main-component-parent{
  font-family: Latin Modern Roman, Computer Modern Roman, serif;
  font-size: 1.2rem;
  padding-top: 1em;
}
.main-empty-bottom{ padding-bottom: calc(20vh + 5rem); }
code{ font-size: 0.8em; white-space: pre-wrap; }
.CodeMirror{ font-size: 0.8em; }
`);


const modalContext = preact.createContext();
const mainContent = document.querySelector('#root-content')?.innerHTML;
//console.log(mainContent)

const Main = ({})=>{
  const [modal, setModal] = preact.useState(null);
  const Component = preact.useMemo(()=>caph.parseHtml(mainContent), []);
  return caph.parse`
  <${modalContext.Provider} value=${setModal}>
    <div class=${'modal-parent display-'+(!!modal)} onClick=${(ev)=>(ev.stopPropagation(), setModal(null))}>
      <div class="modal" onClick=${(ev)=>ev.stopPropagation()}>
        ${modal}
      </>
    </>
    <div class="main-component-parent">
      <div class="main-component">
        ${Component}
        <div class="main-empty-bottom" />
      </div>
    </div>
  </>
`;
}


caph.injectStyle(`
.modal-parent {
  position: fixed; /* Stay in place */
  z-index: 3; /* Sit on top. 3 because codemirror uses 2 */
  left: 0;
  top: 0;
  width: 100%; /* Full width */
  height: 100%; /* Full height */
  overflow: auto; /* Enable scroll if needed */
  background-color: rgb(0,0,0); /* Fallback color */
  background-color: rgba(0,0,0,0.4); /* Black w/ opacity */
}
.display-true{ display: block; }
.display-false{ display: none; }
.modal {
  background-color: #fefefe; margin: 5% auto; border: 1px solid #888;
  width: 80%; /* Could be more or less, depending on screen size */
}
`);

async function main(){
  caph.load('@dist/fonts/font-lmroman.css');
  const rootComponent = caph.parse`<${Main}/>`;
  const rootNode = /**@type {Element}*/(document.querySelector('#root'));
  rootNode.innerHTML = '';
  preact.render(rootComponent, rootNode);
};

caph.mathPreprocessor = (formula)=>{
  // Custom preprocessing rules:
  formula = formula.replace(/=/g,`\\@equals`);
  formula = formula.replace(/\\Prob_/g,`\\ProbSub`);
  return formula;
}
caph.mathMacros = {
  ...caph.mathMacros, ...Object.fromEntries([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.matchAll(/./g)].map(C=>   [`bb${C}`, `{\\mathbb ${C}}`] )), ...Object.fromEntries([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.matchAll(/./g)].map(C=>   [`cal${C}`, `{\\mathcal ${C}}`] )), T: '\\intercal', eqdef: `\\@ifstar{\\eqdef@B}{\\eqdef@A}`, 'eqdef@A': `\\stackrel{{\\scriptscriptstyle \\mathrm{def}}}{\\coloneqq}`, 'eqdef@B': `\\coloneqq`, defeq: `\\@ifstar{\\defeq@B}{\\defeq@A}`, 'defeq@A': `\\stackrel{{\\scriptscriptstyle \\mathrm{def}}}{\\eqqcolon}`, 'defeq@B': `\\eqqcolon`, abs: `\\@ifstar{\\abs@B}{\\abs@A}`, 'abs@A': `{|#1|}`, 'abs@B': `{\\left|#1\\right|}`, norm: `\\@ifstar{\\norm@B}{\\norm@A}`, 'norm@A': `{\\Vert#1\\Vert}`, 'norm@B': `{\\left\\lVert\\{#1\\right\\rVert}`, 'given': `\\given@A`, 'given@A': `{\\mkern1.5mu\\mid\\mkern2mu}`, 'given@B': `\\middle|`, 'useGiven@A': `{\\def\\given{\\given@A}#1}`, 'useGiven@B': `{\\def\\given{\\given@B}#1}`, '@equals': `=`, '@equals@A': `{\\mkern0mu=\\mkern1mu}`, '@equals@B': `{\\mkern0.5mu=\\mkern1.5mu}`, 'useEquals@A': `{\\def\\@equals{\\@equals@A}#1}`, 'useEquals@B': `{\\def\\@equals{\\@equals@B}#1}`, 'style@A': `\\useEquals@A{#1}`, 'style@B': `\\useEquals@B{\\useGiven@B{#1}}`, set: `\\@ifstar{\\set@B}{\\set@A}`, 'set@A': `\\style@A{\\{#1\\}}`, 'set@B': `\\style@B{\\left\\{#1\\right\\}}`, lr: `\\@ifstar{\\lr@B}{\\lr@A}`, 'lr@A': `\\style@A{(#1)}`, 'lr@B': `\\style@B{\\left(#1\\right)}`, LR: `\\@ifstar{\\LR@B}{\\LR@A}`, 'LR@A': `\\style@A{[#1]}`, 'LR@B': `\\style@B{\\left[#1\\right]}`, 'Prob': `\\bbP\\lr`, 'ProbSub': `\\operatorname*{\\bbP}_{#1}\\lr`, 'Expe': `\\bbE\\LR`, 'ExpeSub': `\\operatorname*{\\bbE}_{#1}\\LR`,
}
  
main();