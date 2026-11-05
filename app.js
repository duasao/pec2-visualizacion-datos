'use strict';

/* =============================================================
   PEC2 · Laboratorio visual — app.js
   Un solo script para las tres visualizaciones. Cada página
   indica cuál dibujar con <body data-page="pie|arc|hull">.
   ============================================================= */


/* -------------------------------------------------------------
   1. Utilidades generales
   ------------------------------------------------------------- */

const SVG_NS = 'http://www.w3.org/2000/svg';

const $ = (id) => document.getElementById(id);
const readDataset = () => JSON.parse($('dataset').textContent);
const cssVar = (name, fallback) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

/** Crea un elemento SVG con atributos y, opcionalmente, texto. */
function svgEl(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text != null && text !== '') node.textContent = text;
  return node;
}


/* -------------------------------------------------------------
   2. Formato de números (es-ES)
   Intl en es-ES no separa los miles en números de 4 cifras
   (7340 en vez de 7.340), así que los enteros se formatean a mano
   para que coincidan con los textos de la página.
   ------------------------------------------------------------- */

const NBSP = '\u00A0';
const dec1 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dec2 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const integer = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const pct = (n) => `${dec2.format(n)}${NBSP}%`;
const cm = (n) => `${dec1.format(n)}${NBSP}cm`;
const tickLabel = (n) => dec1.format(n).replace(/,0$/, '');


/* -------------------------------------------------------------
   3. Tooltip compartido
   El contenido se escribe con textContent (nunca innerHTML).
   ------------------------------------------------------------- */

function showTip(stage, clientX, clientY, { title, body }) {
  const box = $('tooltip');
  if (!box) return;

  const strong = document.createElement('strong');
  strong.textContent = title;
  box.replaceChildren(strong, document.createTextNode(body));
  box.classList.add('show');

  // Se coloca encima del puntero y nunca se sale del área del gráfico
  const area = stage.getBoundingClientRect();
  const x = clientX - area.left;
  const y = clientY - area.top;
  box.style.left = `${clamp(x + 14, 8, area.width - box.offsetWidth - 8)}px`;
  box.style.top = `${clamp(y - box.offsetHeight - 12, 8, area.height - box.offsetHeight - 8)}px`;
}

function hideTip() {
  $('tooltip')?.classList.remove('show');
}

/** Muestra el tooltip al pasar el ratón y al enfocar con teclado. */
function attachTip(node, stage, getContent) {
  const fromPointer = (event) => showTip(stage, event.clientX, event.clientY, getContent());
  node.addEventListener('pointerenter', fromPointer);
  node.addEventListener('pointermove', fromPointer);
  node.addEventListener('pointerleave', hideTip);
  node.addEventListener('focus', () => {
    const box = node.getBoundingClientRect();
    showTip(stage, box.left + box.width / 2, box.top, getContent());
  });
  node.addEventListener('blur', hideTip);
}

// Escape cierra el tooltip (WCAG 1.4.13)
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') hideTip();
});


/* -------------------------------------------------------------
   4. Pie chart
   ------------------------------------------------------------- */

function polar(cx, cy, r, angle) {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

function wedgePath(cx, cy, r, a0, a1) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const largeArc = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1} Z`;
}

function renderPie() {
  const { rows, total } = readDataset();
  const svg = $('pieSvg');
  const legend = $('pieLegend');
  const stage = $('plotStage');
  const CX = 245, CY = 207, R = 153;

  $('total').textContent = integer(total);

  const slices = [];
  const buttons = [];
  let pinned = null; // modalidad fijada con clic en la leyenda

  function highlight(index) {
    slices.forEach((slice, i) => {
      slice.classList.toggle('dim', index !== null && index !== i);
      slice.classList.toggle('active', index === i);
    });
  }
  const restore = () => highlight(pinned);

  let start = -Math.PI / 2; // empieza a las 12 en punto
  rows.forEach((d, i) => {
    const end = start + (2 * Math.PI * d.alumnos) / total;
    const tip = () => ({ title: d.nombre_es, body: `${integer(d.alumnos)} alumnos · ${pct(d.porcentaje)}` });

    // Sector: interacción con ratón. Teclado y lector de pantalla usan la leyenda.
    const slice = svgEl('path', { d: wedgePath(CX, CY, R, start, end), fill: d.color, class: 'pie-slice' });
    attachTip(slice, stage, tip);
    slice.addEventListener('pointerenter', () => highlight(i));
    slice.addEventListener('pointerleave', restore);
    svg.appendChild(slice);
    slices.push(slice);

    // Leyenda: botón conmutable (aria-pressed)
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'legendbtn';
    button.setAttribute('aria-pressed', 'false');

    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = d.color;

    const name = document.createElement('span');
    name.className = 'lname';
    name.textContent = d.nombre_es;

    const value = document.createElement('span');
    value.className = 'lval';
    const count = document.createElement('small');
    count.textContent = `${integer(d.alumnos)} alumnos`;
    value.append(pct(d.porcentaje), count);

    button.append(swatch, name, value);
    button.addEventListener('click', () => {
      pinned = pinned === i ? null : i;
      buttons.forEach((b, j) => b.setAttribute('aria-pressed', String(pinned === j)));
      restore();
    });
    button.addEventListener('pointerenter', () => highlight(i));
    button.addEventListener('pointerleave', restore);
    button.addEventListener('focus', () => highlight(i));
    button.addEventListener('blur', restore);

    legend.appendChild(button);
    buttons.push(button);
    start = end;
  });

  svg.appendChild(svgEl('text', { x: CX, y: 399, 'text-anchor': 'middle', class: 'tick' },
    `Proporciones sobre ${integer(total)} alumnos presenciales`));
}


/* -------------------------------------------------------------
   5. Arc diagram
   ------------------------------------------------------------- */

function renderArc() {
  const { nodes, edges, races } = readDataset();
  const sizeSelect = $('arcSize'), orderSelect = $('arcOrder');
  const weightInput = $('arcWeight'), weightOutput = $('weightVal');
  const svg = $('arcSvg'), stage = $('plotStage');
  const status = $('arcStatus'), summary = $('arcSummary');
  $('arcUnique').textContent = integer(edges.length);
  const X_START = 95, X_END = 1195, AXIS_Y = 358;
  const HEIGHT_RATIO = 300 / ((X_END - X_START) / 2);
  const orderByPodios = (a,b) => b.podios-a.podios || a.id.localeCompare(b.id);
  const teamRank = { 'Red Bull':0, 'McLaren':1, 'Ferrari':2, 'Mercedes':3, 'Alpine':4 };
  let selected=null, arcPaths=[], nodeGroups=[], visibleEdges=[];

  function selectionUpdate() {
    const neighbours=new Set([selected]);
    let connections=0;
    for (const e of visibleEdges) {
      if (e.source===selected) {neighbours.add(e.target);connections++;}
      if (e.target===selected) {neighbours.add(e.source);connections++;}
    }
    arcPaths.forEach(p=>{
      const active=p.dataset.from===selected || p.dataset.to===selected;
      p.classList.toggle('is-selected',Boolean(selected)&&active);
      p.classList.toggle('is-faded',Boolean(selected)&&!active);
    });
    nodeGroups.forEach(g=>{
      g.classList.toggle('is-selected',Boolean(selected)&&g.dataset.id===selected);
      g.classList.toggle('is-faded',Boolean(selected)&&!neighbours.has(g.dataset.id));
      g.setAttribute('aria-pressed',String(selected===g.dataset.id));
    });
    summary.textContent=selected
      ? `${selected}: ${connections} parejas visibles con los filtros actuales. Haz clic otra vez para volver a la vista general.`
      : `Se han contado ${races} podios, con tres parejas por carrera. La frecuencia está en el grosor del arco, no en su altura.`;
  }

  function draw() {
    hideTip(); svg.replaceChildren();
    const shown=[...nodes].sort(orderByPodios).slice(0,Number(sizeSelect.value));
    const shownIds=new Set(shown.map(x=>x.id));
    const order=orderSelect.value;
    if(order==='alpha') shown.sort((a,b)=>a.id.localeCompare(b.id));
    else if(order==='team') shown.sort((a,b)=>teamRank[a.team]-teamRank[b.team] || orderByPodios(a,b));
    const minWeight=Number(weightInput.value);
    visibleEdges=edges.filter(e=>shownIds.has(e.source)&&shownIds.has(e.target)&&e.weight>=minWeight);
    if(selected && !shownIds.has(selected)) selected=null;
    const step=(X_END-X_START)/Math.max(1,shown.length-1);
    const xOf=new Map(shown.map((d,i)=>[d.id,X_START+i*step]));
    svg.appendChild(svgEl('line',{x1:70,x2:1220,y1:AXIS_Y,y2:AXIS_Y,class:'svg-axis'}));
    arcPaths=visibleEdges.map(e=>{
      const from=Math.min(xOf.get(e.source),xOf.get(e.target));
      const to=Math.max(xOf.get(e.source),xOf.get(e.target));
      const rx=(to-from)/2, ry=rx*HEIGHT_RATIO;
      const path=svgEl('path',{
        d:`M ${from.toFixed(1)} ${AXIS_Y} A ${rx.toFixed(1)} ${ry.toFixed(1)} 0 0 1 ${to.toFixed(1)} ${AXIS_Y}`,
        class: `arc arc-freq-${e.weight <= 2 ? 'baja' : e.weight <= 4 ? 'media' : 'alta'}`,'stroke-width': (2.5 + e.weight * 2).toFixed(2)
      });
      path.dataset.from=e.source;path.dataset.to=e.target;
      attachTip(path,stage,()=>({title:`${e.source} ↔ ${e.target}`,body:`${e.weight} podio${e.weight===1?'':'s'} juntos · ${e.gps.join(', ')}`}));
      svg.appendChild(path);return path;
    });
    nodeGroups=shown.map(d=>{
      const x=xOf.get(d.id);
      const group=svgEl('g',{class:'svg-node',tabindex:0,role:'button','aria-pressed':'false',
        'aria-label':`${d.nombre}: ${d.podios} podios en 2024, ${d.grado} parejas diferentes`});
      group.dataset.id=d.id;
      const labelX=x+4,labelY=AXIS_Y+23;
      group.append(
        svgEl('circle',{cx:x,cy:AXIS_Y,r:(6+Math.sqrt(d.podios)*1.4).toFixed(2)}),
        svgEl('text',{x:labelX,y:labelY,transform:`rotate(52,${labelX},${labelY})`},d.id)
      );
      function toggle(){selected=selected===d.id?null:d.id;selectionUpdate();}
      group.addEventListener('click',toggle);
      group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}});
      attachTip(group,stage,()=>({title:d.nombre,body:`${d.team} · ${d.podios} podios · ${d.grado} parejas diferentes`}));
      svg.appendChild(group);return group;
    });
    status.textContent=`${shown.length} pilotos · ${visibleEdges.length} de ${edges.length} parejas visibles (mínimo ${minWeight} coincidencias)`;
    selectionUpdate();
  }
  sizeSelect.addEventListener('change',draw);
  orderSelect.addEventListener('change',draw);
  weightInput.addEventListener('input',()=>{weightOutput.textContent=weightInput.value;draw();});
  $('arcReset').addEventListener('click',()=>{selected=null;selectionUpdate();});
  draw();
}


/* -------------------------------------------------------------
   6. Convex hull
   ------------------------------------------------------------- */

/** Cadena monótona de Andrew, O(n log n). Devuelve solo los vértices extremos. */
function convexHull(points) {
  const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length < 3) return sorted;

  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  const upper = [];

  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/** Dominio y marcas "redondas" (0,5 · 1 · 2…) para un eje. */
function niceScale(values, targetTicks = 6) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const raw = (max - min) / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const f = raw / magnitude;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * magnitude;

  const lo = Math.max(0, Math.floor((min - step / 4) / step) * step);
  const hi = Math.ceil((max + step / 4) / step) * step;
  const ticks = [];
  for (let i = 0; lo + i * step <= hi + 1e-9; i++) ticks.push(+(lo + i * step).toFixed(10));
  return { lo, hi, ticks };
}

function renderHull() {
  const { rows } = readDataset();
  const stage=$('plotStage'),svg=$('hullSvg');
  const view=$('hullView'),toggle=$('hullToggle');
  const status=$('hullStatus'),insight=$('hullInsight');
  const GROUPS=[
    {key:'4',name:'4 cilindros',color:cssVar('--cyl4','#167b7b')},
    {key:'6',name:'6 cilindros',color:cssVar('--cyl6','#d29645')},
    {key:'8',name:'8 cilindros',color:cssVar('--cyl8','#8f6bb2')}
  ];
  const LABELS={weight_kg:'Peso (kg)',hp:'Potencia (hp)',mpg:'Rendimiento (MPG)'};
  const INSIGHTS={
    'weight_kg,mpg':'En estos 32 coches se aprecia una relación inversa entre peso y MPG: los modelos más pesados suelen recorrer menos millas por galón. Las envolventes permiten ver los rangos y dónde se acercan los grupos; no indican dónde se concentra la mayoría de los coches.',
    'hp,mpg':'Al cambiar el peso por la potencia, las envolventes también cambian: la técnica describe los extremos de las variables escogidas, no una característica fija del grupo. La asociación observada no demuestra causalidad.'
  };
  const P={left:90,right:1020,top:38,bottom:485};
  const pointRadius=5.0;
  function draw(){
    hideTip();svg.replaceChildren();
    const [fx,fy]=view.value.split(',');
    const xs=niceScale(rows.map(r=>r[fx]));const ys=niceScale(rows.map(r=>r[fy]));
    const px=v=>P.left+(v-xs.lo)/(xs.hi-xs.lo)*(P.right-P.left);
    const py=v=>P.bottom-(v-ys.lo)/(ys.hi-ys.lo)*(P.bottom-P.top);
    for(const t of xs.ticks){const x=px(t);svg.appendChild(svgEl('line',{x1:x,x2:x,y1:P.top,y2:P.bottom,class:'svg-grid'}));svg.appendChild(svgEl('text',{x,y:P.bottom+22,'text-anchor':'middle',class:'tick'},Number.isInteger(t)?integer(t):dec1.format(t)));}
    for(const t of ys.ticks){const y=py(t);svg.appendChild(svgEl('line',{x1:P.left,x2:P.right,y1:y,y2:y,class:'svg-grid'}));svg.appendChild(svgEl('text',{x:P.left-13,y:y+4,'text-anchor':'end',class:'tick'},Number.isInteger(t)?integer(t):dec1.format(t)));}
    svg.appendChild(svgEl('line',{x1:P.left,x2:P.right,y1:P.bottom,y2:P.bottom,class:'svg-axis'}));
    svg.appendChild(svgEl('line',{x1:P.left,x2:P.left,y1:P.top,y2:P.bottom,class:'svg-axis'}));
    const midY=(P.top+P.bottom)/2;
    svg.appendChild(svgEl('text',{x:(P.left+P.right)/2,y:555,'text-anchor':'middle',class:'axis-label'},LABELS[fx]));
    svg.appendChild(svgEl('text',{x:21,y:midY,transform:`rotate(-90,21,${midY})`,'text-anchor':'middle',class:'axis-label'},LABELS[fy]));
    if(toggle.checked){
      for(const g of GROUPS){
        const pts=rows.filter(r=>r.cyl===g.key).map(r=>({x:r[fx],y:r[fy]}));
        const hull=convexHull(pts);
        svg.appendChild(svgEl('polygon',{points:hull.map(p=>`${px(p.x).toFixed(2)},${py(p.y).toFixed(2)}`).join(' '),fill:g.color,stroke:g.color,class:'hull-poly','aria-hidden':'true'}));
      }
    }
    let distinct=0;
    for(const g of GROUPS){
      const groups=new Map();
      for(const r of rows.filter(x=>x.cyl===g.key)){
        const key=`${r[fx]}|${r[fy]}`;
        if(!groups.has(key))groups.set(key,[]);
        groups.get(key).push(r);
      }
      distinct+=groups.size;
      for(const observations of groups.values()){
        const r=observations[0],n=observations.length;
        const point=svgEl('circle',{cx:px(r[fx]).toFixed(2),cy:py(r[fy]).toFixed(2),r:(pointRadius*Math.sqrt(n)).toFixed(2),fill:g.color,class:'plotpoint',tabindex:0,role:'img',
          'aria-label':`${g.name}: ${observations.map(x=>x.name).join(', ')}. ${LABELS[fx]}: ${dec1.format(r[fx])}; ${LABELS[fy]}: ${dec1.format(r[fy])}`});
        attachTip(point,stage,()=>({title:observations.map(x=>x.name).join(', '),body:`${g.name} · ${LABELS[fx]}: ${dec1.format(r[fx])} · ${LABELS[fy]}: ${dec1.format(r[fy])}`}));
        svg.appendChild(point);
      }
    }
    status.textContent=`${rows.length} modelos · ${distinct} posiciones distintas · ${GROUPS.length} grupos · ${toggle.checked?'envolventes visibles':'solo puntos'}`;
    insight.textContent=INSIGHTS[view.value];
  }
  view.addEventListener('change',draw);
  toggle.addEventListener('change',draw);
  draw();
}


/* -------------------------------------------------------------
   7. Arranque
   ------------------------------------------------------------- */

const RENDERERS = { pie: renderPie, arc: renderArc, hull: renderHull };

document.addEventListener('DOMContentLoaded', () => {
  RENDERERS[document.body.dataset.page]?.();
});
