javascript:(async()=>{

if(window.translationUniversalSearchLoaded){
console.log("Universal translation search already loaded.");
return;
}
window.translationUniversalSearchLoaded=true;

const state={
loading:false,
cancelled:false,
data:[],
loadedPages:0,
totalPages:null
};

function getBasePageUrl(){
const m=location.pathname.match(/^(.*\/translation)(?:\/page\/\d+)?$/);
if(m)return`${location.origin}${m[1]}/page/`;
return`${location.origin}${location.pathname.replace(/\/$/,"")}/page/`;
}

function detectTotalPagesFromDocument(doc=document){
const pageSpans=Array.from(doc.querySelectorAll(".paginationControl .page"));
const numericPages=pageSpans.map(el=>parseInt(el.textContent.trim(),10)).filter(n=>!Number.isNaN(n));
const lastBtn=doc.querySelector(".paginationControl .last[id]");
const lastBtnId=parseInt(lastBtn?.id||"",10);

const candidates=[
...numericPages,
...(Number.isNaN(lastBtnId)?[]:[lastBtnId])
];

return candidates.length?Math.max(...candidates):1;
}

function extractRowsFromHtml(html,pageNumber){
const doc=new DOMParser().parseFromString(html,"text/html");
const rows=Array.from(doc.querySelectorAll("#translation_list tbody tr"));

return rows.map((tr,index)=>{
const tds=tr.querySelectorAll("td");

return{
page:pageNumber,
row:index+1,
feature:(tds[0]?.innerText||"").trim(),
key:(tds[1]?.innerText||"").trim(),
valueA:(tds[2]?.innerText||"").trim(),
valueB:(tds[3]?.innerText||"").trim()
};
});
}

async function fetchPage(pageNumber){
const baseUrl=getBasePageUrl();
const url=`${baseUrl}${pageNumber}?_=${Date.now()}_${pageNumber}`;

const res=await fetch(url,{
method:"GET",
credentials:"same-origin",
headers:{
"X-Requested-With":"XMLHttpRequest"
}
});

if(!res.ok){
throw new Error(`Page ${pageNumber} failed with status ${res.status}`);
}

const html=await res.text();
return extractRowsFromHtml(html,pageNumber);
}

async function detectTotalPagesFromServer(){
try{
const page1=await fetchPageRaw(1);
const doc=new DOMParser().parseFromString(page1,"text/html");
return detectTotalPagesFromDocument(doc);
}catch(e){
return detectTotalPagesFromDocument(document);
}
}

async function fetchPageRaw(pageNumber){
const baseUrl=getBasePageUrl();
const url=`${baseUrl}${pageNumber}?_=${Date.now()}_${pageNumber}`;

const res=await fetch(url,{
method:"GET",
credentials:"same-origin",
headers:{
"X-Requested-With":"XMLHttpRequest"
}
});

if(!res.ok){
throw new Error(`Page ${pageNumber} failed with status ${res.status}`);
}

return await res.text();
}

async function loadAllPages(){

if(state.loading)return;

state.loading=true;
state.cancelled=false;
state.data=[];
state.loadedPages=0;

state.totalPages=await detectTotalPagesFromServer();

updateStatus(`Detected ${state.totalPages} page(s). Starting load...`);

const concurrency=5;
let nextPage=1;

async function worker(){

while(nextPage<=state.totalPages && !state.cancelled){

const page=nextPage++;

try{

const rows=await fetchPage(page);

state.data.push(...rows);

state.loadedPages++;

updateStatus(`Loading pages... ${state.loadedPages} / ${state.totalPages} — ${state.data.length} rows`);

}catch(err){

console.error(`Error loading page ${page}:`,err);

state.loadedPages++;

updateStatus(`Loading pages... ${state.loadedPages} / ${state.totalPages} (some errors) — ${state.data.length} rows`);

}

}

}

const workers=Array.from({length:concurrency},()=>worker());

await Promise.all(workers);

state.loading=false;

if(state.cancelled){

updateStatus(`Stopped. Loaded ${state.loadedPages} / ${state.totalPages} page(s), ${state.data.length} rows.`);

}else{

updateStatus(`Done. Loaded ${state.loadedPages} / ${state.totalPages} page(s), ${state.data.length} rows.`);

}

console.log("Loaded rows:",state.data);

return state.data;

}

function searchData(term){

const q=term.trim().toLowerCase();

if(!q){

results.innerHTML=`<div style="color:#666;">Enter a search term.</div>`;

return;

}

const matches=state.data.filter(item=>{

return(

item.feature.toLowerCase().includes(q) ||

item.key.toLowerCase().includes(q) ||

item.valueA.toLowerCase().includes(q) ||

item.valueB.toLowerCase().includes(q)

);

});

const html=matches.slice(0,500).map(item=>`

<div style="padding:8px 0;border-bottom:1px solid #eee;">

<div><b>Page ${item.page}</b> — <code>${escapeHtml(item.key||"—")}</code></div>

<div><b>Feature:</b> ${escapeHtml(item.feature||"—")}</div>

<div><b>Col 3:</b> ${escapeHtml(item.valueA||"—")}</div>

<div><b>Col 4:</b> ${escapeHtml(item.valueB||"—")}</div>

</div>

`).join("");

results.innerHTML=`

<div style="margin-bottom:8px;"><b>${matches.length}</b> match(es)</div>

<div style="max-height:400px;overflow:auto;border:1px solid #ddd;padding:8px;border-radius:6px;background:#fff;">

${html||"<div>No matches found.</div>"}

</div>

${matches.length>500?`<div style="margin-top:8px;color:#666;">Showing first 500 results only.</div>`:""}

`;

}

function escapeHtml(str){

return String(str)

.replaceAll("&","&amp;")

.replaceAll("<","&lt;")

.replaceAll(">","&gt;");

}

function updateStatus(text){

status.innerHTML=text;

}

const existing=document.getElementById("uts-panel");

if(existing)existing.remove();

const panel=document.createElement("div");

panel.id="uts-panel";

panel.style.cssText=`

position:fixed;

top:20px;

right:20px;

width:480px;

max-height:85vh;

overflow:hidden;

z-index:999999;

background:#f1f5fd;

border:1px solid #ccc;

border-radius:10px;

box-shadow:0 10px 25px rgba(0,0,0,0.2);

padding:12px;

font-family:Arial,sans-serif;

color:#222;

`;

panel.innerHTML=`

<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">

<div style="font-size:16px;font-weight:bold;">Universal Translation Search</div>

<button id="uts-close" style="border:none;background:#b7b7b7;padding:4px 8px;border-radius:6px;cursor:pointer;">✕</button>

</div>

<div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">

<button id="uts-load">Load all pages</button>

<button id="uts-stop">Stop</button>

</div>

<div id="uts-status" style="font-size:13px;margin-bottom:10px;color:#444;">

Ready.

</div>

<input id="uts-input" type="text" placeholder="Search in feature, key, and last 2 columns"

style="width:100%;padding:10px;border:1px solid #bbb;border-radius:8px;margin-bottom:8px;" />

<div style="display:flex;gap:8px;margin-bottom:8px;">

<button id="uts-search">Search</button>

<button id="uts-clear">Clear</button>

</div>

<div id="uts-results" style="font-size:13px;line-height:1.4;overflow:auto;max-height:50vh;"></div>

<div style="margin-top:10px;text-align:right;font-size:11px;color:#6b6b6b;font-style:italic;letter-spacing:1px;border-top:1px dashed #c9c9c9;padding-top:6px;">

Developed by Thiago

</div>

`;

document.body.appendChild(panel);

const style=document.createElement("style");

style.innerHTML=`

#uts-panel button{

background-color:#ff7b14;

color:white;

border-radius:10px;

font-family:Muli,Arial,Helvetica,sans-serif !important;

font-size:1.5rem !important;

font-weight:400;

border:0;

padding:8px 15px !important;

}

`;

document.head.appendChild(style);

const status=panel.querySelector("#uts-status");
const input=panel.querySelector("#uts-input");
const results=panel.querySelector("#uts-results");

panel.querySelector("#uts-close").onclick=()=>{

state.cancelled=true;

panel.remove();

delete window.translationUniversalSearchLoaded;

};

panel.querySelector("#uts-load").onclick=async()=>{

await loadAllPages();

};

panel.querySelector("#uts-stop").onclick=()=>{

state.cancelled=true;

updateStatus(`Stopping... already loaded ${state.loadedPages} page(s), ${state.data.length} rows.`);

};

panel.querySelector("#uts-search").onclick=()=>{

if(!state.data.length){

results.innerHTML=`<div style="color:#666;">Load the pages first.</div>`;

return;

}

searchData(input.value);

};

panel.querySelector("#uts-clear").onclick=()=>{

input.value="";

results.innerHTML="";

};

input.addEventListener("keydown",e=>{

if(e.key==="Enter"){

if(!state.data.length){

results.innerHTML=`<div style="color:#666;">Load the pages first.</div>`;

return;

}

searchData(input.value);

}

});

updateStatus("Ready. Click 'Load all pages'.");

})();
