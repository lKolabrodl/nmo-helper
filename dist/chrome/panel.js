const AI_MODELS=[{id:"gpt-4.1-nano",name:"gpt-4.1-nano",tier:"low"},{id:"gpt-4o-mini",name:"gpt-4o-mini",tier:"low"},{id:"gpt-5.4-nano",name:"gpt-5.4-nano",tier:"low"},{id:"gemini-2.0-flash-lite",name:"gemini-2.0-flash-lite",tier:"low"},{id:"gemini-2.0-flash",name:"gemini-2.0-flash",tier:"low"},{id:"claude-haiku-4-5",name:"claude-haiku-4.5",tier:"low"},{id:"gpt-4.1-mini",name:"gpt-4.1-mini",tier:"medium",tag:"rec"},{id:"gpt-4o",name:"gpt-4o",tier:"medium"},{id:"gpt-5-mini",name:"gpt-5-mini",tier:"medium"},{id:"gpt-5.4-mini",name:"gpt-5.4-mini",tier:"medium"},{id:"gemini-2.5-flash",name:"gemini-2.5-flash",tier:"medium",tag:"rec"},{id:"gpt-4.1",name:"gpt-4.1",tier:"high"},{id:"gpt-5",name:"gpt-5",tier:"high",tag:"pricey"},{id:"gpt-5.4",name:"gpt-5.4",tier:"high",tag:"pricey"},{id:"o3-mini",name:"o3-mini",tier:"high",tag:"rec"},{id:"o4-mini",name:"o4-mini",tier:"high",tag:"rec"},{id:"gemini-2.5-pro",name:"gemini-2.5-pro",tier:"high"},{id:"claude-sonnet-4-6",name:"claude-sonnet-4.6",tier:"high"},{id:"o3",name:"o3",tier:"ultra",tag:"pricey"},{id:"gemini-3.1-pro-preview",name:"gemini-3.1-pro",tier:"ultra"},{id:"claude-opus-4-6",name:"claude-opus-4.6",tier:"ultra",tag:"rec"}];function createPanel(o){const{savedUrl:v,savedCollapsed:i,savedLeft:l,savedTop:m,savedAiMode:c,savedAutoMode:r,savedApiKey:u,savedModel:s}=o,n=document.createElement("div");return n.id="nmo-panel",i&&n.classList.add("collapsed"),n.innerHTML=`
        <div class="nmo-header">
            <span class="nmo-header-title">NMO Helper</span>
            <span class="nmo-header-status" id="nmo-header-status"></span>
            <button class="nmo-toggle-btn" id="nmo-collapse" title="Свернуть">${i?"+":"—"}</button>
        </div>
        <div class="nmo-body">
            <label class="nmo-ai-toggle">
                <input type="checkbox" id="nmo-ai-mode" ${c?"checked":""} />
                <span>Решать с помощью AI</span>
            </label>
            <label class="nmo-ai-toggle">
                <input type="checkbox" id="nmo-auto-mode" ${r?"checked":""} />
                <span>Авто-поиск rosmed & 24forcare</span>
            </label>

            <div class="nmo-auto-section" ${r?"":'style="display:none"'}>
                <div class="nmo-status" id="nmo-auto-status">выключено</div>
            </div>

            <div class="nmo-sites-section" ${c||r?'style="display:none"':""}>
                <div class="nmo-field">
                    <label>Поиск</label>
                    <input type="text" id="nmo-search-query" placeholder="Название теста..." />
                </div>
                <button class="nmo-btn nmo-btn-search" id="nmo-search-btn">🔍 Найти ответы</button>
                <div class="nmo-status" id="nmo-search-status"></div>
                <div class="nmo-search-results" id="nmo-search-results" style="display:none"></div>

                <hr class="nmo-separator">

                <div class="nmo-field">
                    <label>URL страницы с ответами</label>
                    <input type="text" id="nmo-url" placeholder="https://..." value="${v}" />
                </div>
                <div class="nmo-btn-row">
                    <button class="nmo-btn nmo-btn-run" id="nmo-run">▶ Запуск</button>
                    <button class="nmo-btn nmo-btn-stop" id="nmo-stop" style="display:none">■ Стоп</button>
                </div>
                <div class="nmo-status" id="nmo-status">готов к работе</div>
            </div>

            <div class="nmo-ai-section" ${c?"":'style="display:none"'}>
                <div class="nmo-field">
                    <label>API-ключ ProxyAPI</label>
                    <input type="password" id="nmo-api-key" placeholder="вставьте ключ..." value="${u}" />
                    <a class="nmo-key-hint" id="nmo-key-hint" href="https://console.proxyapi.ru/keys" target="_blank" ${u?'style="display:none"':""}>Получить ключ API</a>
                </div>
                <div class="nmo-field">
                    <label>Модель</label>
                    <input type="hidden" id="nmo-ai-model" value="${s}" />
                    <div class="nmo-dropdown" id="nmo-model-dropdown">
                        <div class="nmo-dropdown-selected" id="nmo-model-selected"></div>
                        <div class="nmo-dropdown-list" id="nmo-model-list">
                            ${AI_MODELS.map(a=>`<div class="nmo-dropdown-item" data-value="${a.id}" data-tier="${a.tier}" ${a.tag?'data-tag="'+a.tag+'"':""}><span class="nmo-di-name">${a.name}</span>${a.tag==="rec"?'<span class="nmo-di-tag nmo-di-tag-rec">★</span>':a.tag==="pricey"?'<span class="nmo-di-tag nmo-di-tag-pricey">$$$</span>':""}<span class="nmo-di-tier nmo-di-tier-${a.tier}">${a.tier}</span></div>`).join("")}
                        </div>
                    </div>
                </div>
                <div class="nmo-btn-row">
                    <button class="nmo-btn nmo-btn-ai" id="nmo-ai-run">▶ Запуск AI</button>
                    <button class="nmo-btn nmo-btn-stop" id="nmo-ai-stop" style="display:none">■ Стоп</button>
                </div>
                <div class="nmo-status" id="nmo-ai-status">готов к работе</div>
            </div>
        </div>
    `,document.body.appendChild(n),l!==null&&m!==null&&(n.style.left=l+"px",n.style.top=m+"px",n.style.right="auto"),n}function initPanelBehavior(o){const v=o.querySelector(".nmo-header");let i=!1,l=0,m=0;v.addEventListener("mousedown",e=>{e.preventDefault(),i=!0;const t=o.getBoundingClientRect();l=e.clientX-t.left,m=e.clientY-t.top,o.style.willChange="left, top"}),document.addEventListener("mousemove",e=>{i&&(e.preventDefault(),requestAnimationFrame(()=>{o.style.left=e.clientX-l+"px",o.style.top=e.clientY-m+"px",o.style.right="auto"}))}),document.addEventListener("mouseup",()=>{if(i){i=!1,o.style.willChange="";const e=o.getBoundingClientRect();storageSet("panelLeft",e.left),storageSet("panelTop",e.top)}}),document.getElementById("nmo-collapse").addEventListener("click",()=>{o.classList.toggle("collapsed");const e=o.classList.contains("collapsed");document.getElementById("nmo-collapse").textContent=e?"+":"—",storageSet("panelCollapsed",e)});const c=o.querySelector(".nmo-sites-section"),r=o.querySelector(".nmo-ai-section"),u=o.querySelector(".nmo-auto-section"),s=document.getElementById("nmo-ai-mode"),n=document.getElementById("nmo-auto-mode");function a(){const e=s.checked,t=n.checked;c.style.display=e||t?"none":"",r.style.display=e?"":"none",u.style.display=t?"":"none"}s.addEventListener("change",()=>{s.checked&&(n.checked=!1,storageSet("autoMode",!1),n.dispatchEvent(new Event("change"))),storageSet("aiMode",s.checked),a()}),n.addEventListener("change",()=>{n.checked&&(s.checked=!1,storageSet("aiMode",!1)),storageSet("autoMode",n.checked),a()});const h=document.getElementById("nmo-ai-model"),y=document.getElementById("nmo-model-selected"),p=document.getElementById("nmo-model-list"),g=document.getElementById("nmo-model-dropdown");function b(e){const t=AI_MODELS.find(d=>d.id===e);if(t){const d=t.tag==="rec"?'<span class="nmo-tag nmo-tag-rec">★</span>':t.tag==="pricey"?'<span class="nmo-tag nmo-tag-pricey">$$$</span>':"";y.innerHTML=`<span class="nmo-model-name">${t.name}</span>${d}<span class="nmo-tier nmo-tier-${t.tier}">${t.tier}</span>`}}b(h.value),y.addEventListener("click",e=>{e.stopPropagation();const t=g.classList.contains("open");if(g.classList.toggle("open"),!t){const d=y.getBoundingClientRect();p.style.left=d.left+"px",p.style.top=d.bottom+"px",p.style.width=d.width+"px"}}),p.addEventListener("click",e=>{const t=e.target.closest(".nmo-dropdown-item");t&&(h.value=t.dataset.value,storageSet("aiModel",t.dataset.value),b(t.dataset.value),g.classList.remove("open"))}),document.addEventListener("click",()=>{g.classList.remove("open")}),document.getElementById("nmo-api-key").addEventListener("input",e=>{const t=e.target.value.trim();storageSet("apiKey",t),document.getElementById("nmo-key-hint").style.display=t?"none":""}),document.getElementById("nmo-url").addEventListener("change",e=>storageSet("customUrl",e.target.value.trim()));const f=document.getElementById("nmo-header-status"),k=["nmo-ai-status","nmo-auto-status","nmo-status"];setInterval(()=>{let e="nmo-status";s.checked?e="nmo-ai-status":n.checked&&(e="nmo-auto-status");const t=document.getElementById(e);t&&(f.textContent=t.textContent,f.className="nmo-header-status "+t.className.replace("nmo-status","").trim())},500)}
