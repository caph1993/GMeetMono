//@ts-check
/// <reference path="./lattices.js" />
/// <reference path="./types.js" />


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
const algoNames = [...Object.keys(latticeAlgorithms(Lattice.powerset(1)))];
const typesOfF = ['monotone', 'meet of join-endomorphisms', 'arbitrary'];
return ({})=>{
  const setModal = preact.useContext(modalContext);
  const [lattice, setLattice] = preact.useState(Lattice.powerset(3));
  const [loading, setLoading] = preact.useState(false);
  // const allAlgorithms = preact.useCallback((/** @type {Lattice} */ L)=>{
  //   return Object.entries(algorithms(L)).map(([name,algorithm],i)=>({
  //     name, algorithm,
  //   }));;
  // }, []);

  const [selected, setSelected] = preact.useState(Object.fromEntries(algoNames.map(name=>[name, true])));

  const [ntc, setNTC] = preact.useState(200);
  const tests = preact.useCallback(function*(lattice, algos, ntc, typeOfF){
    //console.log(L);
    const hash=(/** @type {number[]} */ seq)=>{
      const base=257, bigPrime=7778777;
      let h=0, pow=1;
      for(let x of seq){
        h = (base*h + x) % bigPrime;
        pow = (base*pow) % bigPrime;
      }
      return h;
    }
    const fails = {};
    const failExample = {};
    const outputs = {};

    const seenInputs = new Set();
    const seenOutputs = new Set();
    for(let tc=0;tc<ntc;tc++){
      let h = (()=>{switch(typeOfF){
        case 'arbitrary': return lattice.randomArbitraryF()
        case 'monotone': return lattice.randomMonotoneF()
        case 'meet of join-endomorphisms':
          const f = lattice.randomJoinF();
          const g = lattice.randomJoinF();
          const {n, glb} = lattice;
          return range(n).map(x=>glb[f[x]][g[x]]);
        default: throw `type ${typeOfF} not in ${typesOfF}`;
      }})();
      seenInputs.add(hash(h));
      for(let e of algos){
        const start = Date.now();
        const {h:out, cnt} = e.algorithm(h);
        const elapsed = (Date.now()-start);
        outputs[e.name] = out;
        e.counts += cnt;
        e.mSeconds += elapsed;
        e.maxCounts = Math.max(e.maxCounts, cnt);
      }
      let h0 = outputs[algos[0].name];
      seenOutputs.add(hash(h0));
      for(let e of algos){
        const out = outputs[e.name];
        let ok = true;
        for(let x=0;x<lattice.n;x++) ok = ok && (h0[x]==out[x]);
        e.fails += !ok;
        if(!ok && !e.failExample) e.failExample = {input:h, output:out, expectedOutput: h0};
      }
      yield {outputs, fails, failExample, different: {inputs:seenInputs.size, outputs:seenOutputs.size}};
    }
  }, []);
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
  const [running, setRunning] = preact.useState(false);
  const [showAlgorithms, setShowAlgorithms] = preact.useState(false);
  const [typeOfF, setTypeOfF] = preact.useState('monotone');
  const testsParent = preact.useCallback(async (lattice, ntc, typeOfF, selected)=>{
    setRunning(true);
    emergency.stop = false;
    setOut('...');
    await caph.sleep(100);
    const startMs = Date.now();
    const nextIntervalMs = 100;
    let nextOut = startMs + nextIntervalMs;
    let tc=0;
    const _algos = latticeAlgorithms(lattice);
    const algos = algoNames.filter(name=>selected[name]).map(name=>({
      name, algorithm:_algos[name],
      mSeconds:0, fails:0, failExample:null,
      counts:0, maxCounts:0, 
    }));

    const report = ({different})=> setOut(caph.parse`
    <div>
    <div (component)="@code">
    Seconds:  ${((Date.now()-startMs)/1000).toFixed(0)}<br>
    Progress: ${tc}/${ntc}, of which, ${different.inputs}/${tc} different inputs, ${different.outputs}/${tc} different outputs<br>
    </>
    <table class="test-results">
    <thead>
      <tr><td>Algorithm<td>Time<br>(total)<td>Avg.<br>cnt.<td>Worst<br>cnt.<td>Total<br>cnt.<td>Fails</td></tr>
    <tbody>
    ${algos.map((e)=>caph.parse`
      <tr>
      <td>${e.name}
      <td>${''+e.mSeconds} ms
      <td>${''+(e.counts/tc).toFixed(2)}
      <td>${e.maxCounts}
      <td>${''+e.counts}
      <td>${e.fails==0?''+e.fails:caph.parse`
        <button onClick=${()=>showFailExample(lattice, /** @type {*}*/(e.failExample))}>${''+e.fails}</>
      `}
      </td>
      </tr>
    `)}
    </tbody>
    </table>
    Lattice size: $n=${lattice.n}$ nodes and $m=${lattice.m}$ edges ($n^2 = ${lattice.n*lattice.n}$).
    </>
    `);
    try{
    for(let result of tests(lattice, algos, ntc, typeOfF)){
      ++tc;
      if(Date.now()>nextOut||tc==ntc){
        nextOut+=nextIntervalMs;
        report(result);
        await caph.sleep(100/ntc);
      }
      if(emergency.stop||tc==ntc){
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
          setLattice(Lattice.preset(k)); // takes time
          setLoading(false);
        }}>preset-${k}</button>
      `)}
      <br>
      Number of elements: ${lattice.n}
      <br>
      Lattice: (scroll to zoom in or out)
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