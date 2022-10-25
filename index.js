//@ts-check
/// <reference path="./lattices.js" />
/// <reference path="./putTools.js" />

var algoNames = [...Object.keys(latticeAlgorithms(Lattice.powerset(1)))];
var latticeAlgorithmsWithCounters = (L)=>{
  const _algos = latticeAlgorithms(L);
  return algoNames.map(name=>({
    name, algorithm:_algos[name],
    fails:0, failExample:null,
    timeSum:0, timeAvg:0, timeMax:0,
    cntSum:0, cntAvg:0, cntMax:0, 
  }));
}


var typesOfF = [
  'join of monotone and join-endomorphism',
  'monotone',
  'meet of join-endomorphisms',
  'arbitrary',
  'join-endomorphism',
];

/** @param {Lattice} L @param {any} algos @param {number} ntc @param {string} typeOfF*/ 
var tests = function*(L, algos, ntc, typeOfF){
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
      e.timeMax = Math.max(e.timeMax, msElapsed*1e-3/thisBatch);
      e.cntSum += d3.sum(outputs, d=>d.cnt);
      e.cntAvg = e.cntSum/(tc+thisBatch);
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



const paperExperiments = (()=>{
  const running$ = new RX(false);
  const runButton = put('button $', 'Run');
  runButton.onclick = ()=>running$.set(true);
  const stopButton = put('button $', 'Stop');
  stopButton.onclick = ()=>running$.set(false);
  running$.subscribe((running)=>{
    put(runButton, running? '[disabled]':'[!disabled]');
    put(stopButton, running? '[!disabled]':'[disabled]');
  });

  const plots = [
    {tab:'Max time', prop:'timeMax', yLabel:"WC runtime [seconds]", isTime:true},
    {tab:'Avg time', prop:'timeAvg', yLabel:"Avg runtime [seconds]", isTime:true},
    {tab:'Max cnt', prop:'cntMax', yLabel:"WC counts", isTime:false},
    {tab:'Avg cnt', prop:'cntAvg', yLabel:"Avg counts", isTime:false},
  ];

  const global = {
    xAxis: [1, 2, 5, 10, 20, 50, 100, 200, 500],
    nLattices: 12,
    nFunctions: 500,
    timeLimit: 1e-3,
    changed: false,
    plotData: /** @type {*[]}*/([]),
    uiSetters: {},
  };
  let plotData$ = new RX(/** @type {*[]}*/([]));

  const loop = async ()=>{
    const rngMain = RNG(0);
    const timedOut = new Set();
    for(let n of global.xAxis){
      const rngLSeed = RNG(rngMain());
      for(let lSeed of range(global.nLattices).map(()=>rngLSeed())){
        await sleep(0); // Let the browser resolve other async actions
        const L = Lattice.preset(n, lSeed); // To do: Use seed!
        const typeOfF = 'join of monotone and join-endomorphism';
        const algos = latticeAlgorithmsWithCounters(L).filter(({name})=>!timedOut.has(name));
        for(let r of tests(L, algos, global.nFunctions, typeOfF)){
          if(!running$.value) return;
        }
        for(let {name, timeAvg, timeMax, cntMax, cntSum, cntAvg} of algos){
          global.plotData.push({name, n, lSeed, timeAvg, timeMax, cntMax, cntSum, cntAvg});
          if(timeAvg>1.2*global.timeLimit) timedOut.add(name);
        }
        global.changed = true;
      }
    }
    running$.set(false);
  }
  (async ()=>{
    while(true){
      while(!running$.value) await sleep(50);
      await loop();
      console.log('SAVE');
    }
  })();

  const d3ObjPromise = async ({yLabel, prop, isTime})=>{
    const margin = {top: 10, right: 200, bottom: 50, left: 60},
    width = 600 - margin.left - margin.right,
    height = 300 - margin.top - margin.bottom;
    
    await until(()=>document.querySelector(`#xd3${prop}`));
    await sleep(500); // :/
    // append the svg object to the body of the page
    const svg = d3.select(`#xd3${prop}`)
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
      .domain(isTime?[1e-6, global.timeLimit]:[1, 2e6])
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
      .text(yLabel);
    
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
    const factor = isTime?1e-6:1;
    for(let power of [1, 2, 3])
      for(let x of global.xAxis)
        refs.push({power, x, y: factor*Math.pow(x, power)});
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
        timeMax: Math.max(1e-6, d3.max(values, d=>d.timeMax)),
        timeAvg: Math.max(1e-6, d3.mean(values, d=>d.timeAvg)),
        cntMax: Math.max(1, d3.max(values, d=>d.cntMax)),
        cntAvg: Math.max(1, d3.mean(values, d=>d.cntAvg)),
      }),
      d => d.name, d => d.n,
    );
    data = Array.from(data, ([name, n, props]) => ({name, n, ...props}));
    return data;
  }

  const rePlot = ({svg, x, y, color, linesContainer, prop})=>{
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
          .y(d=>y(d[prop]))
          (d[1])
        ))
    linesContainer.selectAll("myDots")
      .data(data)
      .join("circle")
        .attr("fill", ({name})=>color(name))
        .attr("r", 2)
        .attr("cx", ({n})=>x(n))
        .attr("cy", d=>y(d[prop]))
    return;
  }

  (async ()=>{
    const d3Objs = d3.zip(plots, await Promise.all(plots.map(d=>d3ObjPromise(d))))
      .map(([a,b])=>({...a, ...b}));
    global.changed = true;
    while(true){
      while(!global.changed) await sleep(500);
      global.changed = false;
      plotData$.set([...groupedData()]);
      for(let d of d3Objs) await rePlot(d);
    }
  })();

  const tableBodies = plots.map(({isTime, prop})=>(
    {tbody: put('tbody'), prop, isTime}
  ));

  plotData$.subscribe((data)=>{
    const rows = d3.flatGroup(data, ({n})=>n)
      .map(([n, arrN])=>{
        const byName = d3.index(arrN, d=>d.name);
        return [n, algoNames.map(name=>[name, byName.get(name)])];
      });
    for(let {tbody, prop, isTime} of tableBodies){
      tbody.replaceChildren(
        ...rows.map(([n,d])=> put('tr', [
          ...putNodes`<td>${n}</td>`,
          ...d.map(([name, d])=>
            !d? put('td $', 'TL'):
            !isTime? put('td $', d[prop].toFixed(0)):
            put('td', putNodes`${(d[prop]*1e6).toFixed(0)} $\mu$s`)
          ),
        ])),
      );
    }
    return ;
  });

  return [
    ...Tabs({entries: [['Experiments', 'Experiments']]},
      put('div[tab="Experiments"]',[
        ...putNodes`
        Lattice sizes: ${JSON.stringify(global.xAxis)}<br>
        Lattices per size: ${global.nLattices} (whenever possible)<br>
        Test functions per lattice: ${global.nFunctions}<br>
        Time limit: ${(global.timeLimit*1e6).toFixed(0)} $\mu$s<br>
        ${runButton}
        ${stopButton}
        `,
        put('br'),
        put('br'),
        ...Tabs({entries: plots.map(({tab, prop})=>[prop, tab])},
          ...tableBodies.map(({isTime, prop, tbody})=>
            put(put('div[tab=$]', prop), [
              put(`div#xd3${prop}`),
              put('table.table', [
                put('thead', [
                  put('th', [putElem`$n$`]),
                  ...algoNames.map(name=>put('td $', name)),
                ]),
                tbody,
              ]),
            ]),//.reduce(((a,b)=>a.concat(b)), []),
          ),
        ),
      ]),
    ),
  ];
})();

document.body.append(put('style', `
table.table{ text-align: center; border-collapse: collapse; margin:auto; }
.table td, .table th{ padding: 0.3vh 0.5vw; border: solid 1px;  }
`));









const playgroundElement = (()=>{
  const running$ = new RX(false);
  const ntc$ = new RX(200);
  const runButtons = (()=>{
    const runButton = put('button', putNodes`
      Run ${putText(ntc$)} experiments
    `);
    runButton.onclick = ()=>{
      running$.set(true);
      testsParent();
    }
    const moreButton = put('button $', 'More');
    moreButton.onclick = ()=>ntc$.set(Math.floor(ntc$.value*1.618));
    const lessButton = put('button $', 'Less');
    lessButton.onclick = ()=>ntc$.set(Math.max(2,ntc$.value>>1));
    const stopButton = put('button $', 'Stop');
    stopButton.onclick = ()=>running$.set(false);
    running$.subscribe((running)=>{
      put(runButton, running? '[disabled]':'[!disabled]');
      put(stopButton, running? '[!disabled]':'[disabled]');
    });
    return [runButton, moreButton, lessButton, stopButton,]
  })();

  document.body.append(put('style', `
  .graph-hidden {
    display: none;
  }
  .dotGraphViz {
    text-align: center;
    background-color: #EBEBEB; overflow-x:clip;
    box-shadow: 0px 0px 3px 0px grey;
    margin: 5px;
  }`));
  const DotGraphViz = (dotCode$)=>{
    const graphId = (''+Math.random()).slice(2);
    const graphDiv = put(`div#graph${graphId}.dotGraphViz`);
    dotCode$.subscribe(async (dotCode)=>{
      if(!dotCode) put(graphDiv, '.graph-hidden');
      else{
        await until(()=>d3.select(`#graph${graphId}`));
        put(graphDiv, '!graph-hidden');
        d3.select(`#graph${graphId}`).graphviz().renderDot(dotCode);
      }
    });
    return [graphDiv];
  }
  
  
  /** @param {{lattice$: RX<Lattice|null>}} props */
  const GraphVizLattice = ({lattice$})=>{
    const vizLoading = `graph G{\nbgcolor=lightgray\nfontcolor=blue\n a [label="Loading"]; }`;
    const vizTooLarge = (n)=>`graph G{\nbgcolor=lightgray\nfontcolor=blue\n a [label="Too large to be displayed: ${n} nodes"]; }`;
    const dotCode$ = lattice$.map((L)=>{
      if(!L) return vizLoading;
      const {n, children} = L;
      if(n >= 60) return vizTooLarge(n);
      let arrows = [];
      for(let b=0;b<n;b++) for(let a of children[b]){
        arrows.push(`${b} -> ${a};`); 
      }
      return `digraph G{\nbgcolor=lightgray\nfontcolor=blue\n${arrows.join('\n')}\n}`;
    });
    return DotGraphViz(dotCode$);
  }
  
  var latticeAlgorithmsWithCounters = (L)=>{
    const _algos = latticeAlgorithms(L);
    return algoNames.map(name=>({
      name, algorithm:_algos[name],
      fails:0, failExample:null,
      timeSum:0, timeAvg:0, timeMax:0,
      cntSum:0, cntAvg:0, cntMax:0, 
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
        e.timeMax = Math.max(e.timeMax, msElapsed*1e-3/thisBatch);
        e.cntSum += d3.sum(outputs, d=>d.cnt);
        e.cntAvg = e.cntSum/(tc+thisBatch);
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
  
  document.head.append(put('style', `
  .test-results {border-collapse:collapse; margin:auto;}
  .test-results td,.test-results th{
    text-align: right;
    padding-right:0.3vw;
    padding-left:0.3vw;
    border: black 1px solid;
  }
  .display-none { display:none; }
  `));

  var modal$ = new RX(/** @type {Node|Node[]} */([]));
  const report$ = new RX(/** @type {Node[]} */([]));
  const rxReport = (()=>{
    const parent = put('div');
    report$.subscribe((report)=>parent.replaceChildren(...report));
    return parent;
  })();

  const showFailExample = (lattice, {input, output, expectedOutput})=>{
    modal$.set( putNodes`
      Input: ${JSON.stringify(input)}
      <br>
      ExpectedOutput: ${JSON.stringify(expectedOutput)}
      <br>
      Output: ${JSON.stringify(output)}
      <br>
      <div (component)="vizLattice" lattice=${lattice}/>
    `)
  };
  
  const updateReport = ({startMs, ntc, L, algos}, {different, progress})=>{
    console.log(algos)
    const trSeq = algos.map((e)=>put('tr', [
      ...[
        e.name,
        (1000*e.timeSum).toFixed(0)+' ms',
        (e.cntSum/progress).toFixed(2),
        e.cntMax,
        e.cntSum,
      ].map(e=>putText(e)),
      e.fails==0?putText(0):((()=>{
        const button = put('button $', e.fails);
        button.onclick = ()=>showFailExample(L, /** @type {*}*/(e.failExample));
        return button;
      })()),
    ].map(e=>put('td', [e]))));
    const tbody = put(put('tbody'), trSeq);
    const table = putElem`
    <table class="test-results">
      <thead>
        <tr><td>Algorithm</td><td>Time<br>(total)</td><td>Avg.<br>cnt.</td><td>Worst<br>cnt.</td><td>Total<br>cnt.</td><td>Fails</td></tr>
      </thead>
    </table>`;
    table.append(tbody);
    const siblings = putNodes`
<pre>
Seconds:  ${((Date.now()-startMs)/1000).toFixed(0)}
Progress: ${progress}/${ntc}, of which,
  ${different.inputs}/${progress} different inputs,
  ${different.outputs}/${progress} different outputs.
</pre>
      ${table}

      Lattice size: $n=$${L.n} nodes and $m=$${L.m} edges ($n^2 = $${L.n*L.n}). ${(L.n*(L.n-1))/2} different pairs.
    `;
    return report$.set(siblings);
  }
  
  const testsParent = async ()=>{
    const L = lattice$.value;
    const ntc = ntc$.value;
    const typeOfF = typeOfF$.value;
    const selected = Object.assign({}, selectedAlgos);
    report$.set([putText('...')]);
    await sleep(100);
    const startMs = Date.now();
    const nextIntervalMs = 100;
    let nextOut = startMs + nextIntervalMs;
    const algos = latticeAlgorithmsWithCounters(L).filter(({name})=>selected[name]);
    try{
      for(let result of tests(L, algos, ntc, typeOfF)){
        if(Date.now()>nextOut||result.progress==ntc){
          nextOut+=nextIntervalMs;
          updateReport({startMs, ntc, L, algos}, result);
          await sleep(100/ntc);
        }
        if(!running$.value||result.progress==ntc){
          let {failExample} = result;
          for(let k in failExample) if(failExample[k]) console.log('Fail Example', k, failExample[k])
          break;
        }
      }
    } finally{ running$.set(false); }
  };


  const lattice$ = new RX(Lattice.powerset(3));
  const loading$ = new RX(false);
  let seed = 0;
  const typeOfF$ = RX.locallyStored('playground-typeOfF', 'monotone');

  const selectedAlgos = {};

  const setLattice = async (setCallback)=>{
    if(loading$.value) return; // already loading (can't cancel)
    loading$.set(true);
    await sleep(250);
    lattice$.set(setCallback()); // takes time
    loading$.set(false);
  }
  const powersetButtons = [2,3,4,5,6,7,8].map(log2n=>{
    const button = put('button $', `${log2n}-powerset`);
    button.onclick = ()=>setLattice(()=>Lattice.powerset(log2n));
    running$.subscribe(running=>{
      put(button, running?'[disabled]':'[!disabled]');
    });
    return button;
  });
  const presetButtons = [5,15,30,50,70,100,500].map(k=>{
    const button = put('button $', `preset-${k}`);
    button.onclick = ()=>setLattice(()=>Lattice.preset(k, seed));
    running$.subscribe(running=>{
      put(button, running?'[disabled]':'[!disabled]');
    });
    return button;
  });

  const tabs = Tabs(
    {
      entries: [['0','Lattice'] ,['1','Tests']],
      defaultKey: '0',
      localStorageKey: 'playground-tab',
    },
    put('div[tab=0]', [
      put('div $', "Choose a lattice:"),
      ...powersetButtons,
      ...presetButtons,
      put('br'),
      ...putNodes`
        Number of elements: ${putText(lattice$.map(L =>`${L.n}`))}
      `,
      put('br'),
      ...(()=>{
        const buttons = [0,1,2,42].map(k=>{
          const b = put('button $', `seed(${k})`);
          b.onclick = ()=>seed=k;
          return b;
        });
        running$.subscribe(running =>{
          for(let b of buttons){
            put(b, running?'[disabled]':'[!disabled]');
          }
        });
        const siblings = [
          ...putNodes`Seed for presets: `,
          ...buttons,
          ...putNodes` (re-click on a preset to apply)`,
        ]
        return siblings;
      })(),
      put('br'),
      put('br'),
      ...GraphVizLattice({
        lattice$: RX.or(lattice$, loading$).map(
          ([lattice, loading])=>loading?null:lattice
        )
      })
    ]),
    put('div[tab=1]', [
      ...putNodes`
        (Running on the chosen lattice of ${
        putText(lattice$.map(L => `${L.n}`))
        }  elements)
      `,
      put('br'),
      ...runButtons,
      put('br'),
      ...(()=>{
        const shown$ = RX.locallyStored('playground-algorithms-shown', false);
        const button = putElem`
          <button>${shown$.map(shown=>shown?'Hide list':'Show list')}</button>
        `
        button.onclick = ()=>shown$.set(!shown$.value);
        const ul = put('ul', algoNames.map(name=>{
          const input = put('input[type="checkbox"]');
          const checked$ = RX.locallyStored(`playground-${name}`, true);
          checked$.subscribe(v=>{
            selectedAlgos[name]=v;
            put(input, v?'[checked]':'[!checked]');
        })
          input.onclick = ()=>checked$.set(!checked$.value)
          return put('li', [input, putText(` ${name}`)]);
        }));
        shown$.subscribe(shown => put(ul, shown?'!hidden':'.hidden'));
        return putNodes`
          Algorithms: ${button}
          ${ul}`;
      })(),
      put('br'),
      ...putNodes`
      Type of input function: ${RadioGroup(typesOfF.map(s=>[s,s]), typeOfF$)}`,
      put('hr'),
      rxReport,
    ]),
  );
  return tabs;
})();



const notationElement = putNodes`
<h2>Notation</h2>

Throughout this document we use the following notation.
$L$ is a non-empty finite lattice with order $\sqleq$ and join and meet operators $\join, \meet$.
The bottom element of $L$ is $\bot$.
The set of all endomorphisms (functions $f:L\to L$) is denoted as $\calF$, and it is a lattice with the order $$
f \sqleqF g \iff (\forall x\in L)\ f(x)\sqleq g(x).
$$
The join and meet operators in $\calF$ (i.e. $\joinF$ and $\meetF$) are the pointwise join and meet operators in $L$.
The endomorphisms that preserve least upper bounds and map $\bot$ to $\bot$ are called <i>join-endomorphisms</i>, and $\calE\subseteq\calF$ is the set of all join-endomorphisms, that is,$$
\calE\eqdef\set{f:L\to L \given f(\bot)=\bot \,\wedge\, \lr{\forall a,b\in L}\,f(a\join b)= f(a)\join f(b)}.
$$
The order $\sqleqE$ for $\calE$ is defined as the restriction of $\sqleqF$ to $\calE$, and with this order, $\calE$ is also a lattice.
The join operator $\joinE$ coincides with $\joinF$ (pointwise $\join$), but the meet $\meetF$ does not coincide with $\meetF$.


<h2>Algorithms of reference</h2>

All the algorithms presented compute the maximal join-endomorphism below a given endomorphism.

The implementations are based on the following abstract algorithms that do not indicate how to find the pairs $a,b$.

<figure class="algorithm bold">
$\mathtt{GMeet}(h)$:
<div class="indent-1em">
  while $\exists a,b\in L$ <span>with</span> $h(a\join b) \neq h(a)\join h(b)$:
  <div class="indent-1em">
    if $h(a\join b) \sqgt h(a) \join h(b)$:
    <div class="indent-1em">
      $h(a\join b) \leftarrow h(a) \join h(b)$
    </div>
    else:
    <div class="indent-1em">
      $h(a) \leftarrow h(a) \meet h(a\join b)$<br>
      $h(b) \leftarrow h(b) \meet h(a\join b)$
    </div>
  </div>
  return $h$
</div>

<figcaption>
\`GMeet\` algorithm. $\mathtt{GMeet}(f \meetF g) \eqdef f \meetE g$.
</figcaption>
</figure>

<figure class="algorithm bold">
$\mathtt{GMeetMono}(f, g)$:
<div class="indent-1em">
  $h \eqdef f \meetF g$<br>
  while $\exists a,b\in L$ <span>with</span> $h(a\join b) \neq h(a)\join h(b)$:
  <div class="indent-1em">
    if $h(a\join b) \sqgt h(a) \join h(b)$:
    <div class="indent-1em">
      $c = h(a) \join h(b)$<br>
      for each $x \sqleq a\join b$
      <div class="indent-1em">
        $h(x) \leftarrow h(x) \meet c$
      </div>
    </div>
  </div>
  return $h$
</div>
<!-- <div class="no-bold">
(Same context and inputs as \`GMeet\`)
</div> -->
<figcaption>
\`GMeetMono\` algorithm. $\mathtt{GMeetMono}(f \meetF g) \eqdef f \meetE g$.
</figcaption>
</figure>`


const implementationsElement = (()=>{
  return putNodes`

  <h2>Implementations</h2>


  Notation following variables that are used in the algorithms are present in the lattice \`L\` and are assumed to be precomputed:
  \`\`\`javascript
  const {n, m, lub, leq, glb, geq, gt, lt, children, isChild,
    walkDown, walkUp, parents, top, bottom, topoUpDown, topoDownUp} = L;
  \`\`\`
  Notation:
  \`n\` is the number of nodes in the lattice.
  \`m\` is the number of edges in the Hasse diagram of the lattice.
  \`lub[a][b]\` is the join (least upper bound) of \`a\` and \`b\`.
  \`glb[a][b]\` is the meet (greatest lower bound).
  \`leq[a][b]\` is the boolean for $a \sqleq b$.
  \`geq[a][b]\` is the boolean for $a \sqgeq b$.
  \`lt[a][b]\` is the boolean for $a \sqlt b$.
  \`gt[a][b]\` is the boolean for $a \sqgt b$.
  \`children[b]\` is the list of (direct) children of $b$.
  \`parents[a]\` is the list of (direct) parents of $a$.
  
  The implementation of the algorithms, including the counters is shown below.

  ${putCodemirror(
    latticeAlgorithms.toString(), {
      mode: "text/javascript",
      //theme: "monokai",
    }
  )}
  
  <br>
  See the <a href="./lattices.js">full code</a>.
  `
})()




document.body.append(put('style', `
.main-component{ padding: 1% 6% 3% 6%; max-width: 40em; margin: auto;}
.main-component-parent{
  font-family: Latin Modern Roman, Computer Modern Roman, serif;
  font-size: 1.2rem;
  padding-top: 1em;
}
.main-empty-bottom{ padding-bottom: calc(20vh + 5rem); }
code{ font-size: 0.8em; white-space: pre-wrap; }
.CodeMirror{ font-size: 0.8em; }
`))

var mainContent = [
  ...putNodes`
  <h1>GMeet algorithms</h1>
  October 2022.
  
  <!-- Create a div where the graph will take place -->

  This document presents the implementation and tests of \`GMeetStar\`, \`GMeetMonoStar\`, \`GMeetMonoLazy\` and \`GMeetPlus\`.

  Paper experiments:

  `,
  ...paperExperiments,
  ...putNodes`
  
  Playground:
  
  `,
  ...playgroundElement,
  put('div.parBreak'),
  ...notationElement,
  put('div.parBreak'),
  ...implementationsElement,
  ...putNodes`<div style="margin-top:10em"></div>`,
]

customElements.define('new-main', class extends HTMLElement{
  constructor(){
    super();
  //   <div class=${'modal-parent display-'+(!!modal)} onClick=${(ev)=>(ev.stopPropagation(), setModal(null))}>
  //   <div class="modal" onClick=${(ev)=>ev.stopPropagation()}>
  //     ${modal}
  //   </div>
  // </div>
    this.append(
      ...putNodes`
        <div class="main-component-parent">
          <div class="main-component">
            ${mainContent}
            <div class="main-empty-bottom" />
          </div>
        </div>
      `,
    );
  }
})