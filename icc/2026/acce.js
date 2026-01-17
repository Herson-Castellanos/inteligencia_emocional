// accesibilidad.js - Panel de accesibilidad (tamaño fuente, tipo, contraste alto, lectura)
    (function(){
    const LS_KEY='accesibilidadPrefsV2';
    const DEF={ size:0, family:'inherit', contrast:false, voice:'' };
    let prefs=cargar();
    let vozActiva=null;
    let vocesDisponibles=[];
    function cargar(){ try{ return Object.assign({},DEF, JSON.parse(localStorage.getItem(LS_KEY)||'{}')); }catch(e){ return {...DEF}; } }
    function guardar(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(prefs)); }catch(e){} }
    function aplicar(){
        document.documentElement.classList.toggle('modo-alto-contraste', !!prefs.contrast);
        // Marcar estado de accesibilidad activa si hay cambios respecto a los valores por defecto
        const activa = (prefs.size !== 0) || (prefs.family !== 'inherit') || !!prefs.contrast;
        document.documentElement.classList.toggle('accesibilidad-activa', activa);
        const sizePct = (100 + prefs.size*10) + '%';
        document.documentElement.style.fontSize = sizePct; // afecta rem y herencia
        document.body.style.fontSize = sizePct; // fallback por si hay reglas sobre body

        // Manejo especial para OpenDyslexic: si se selecciona, cargar la hoja de fuente en línea
        if(prefs.family && prefs.family === 'OpenDyslexic'){
        ensureOpenDyslexic();
        var fam = "'OpenDyslexic', sans-serif";
        } else {
        // si se seleccionó otra familia que no sea 'inherit', usarla tal cual
        var fam = (prefs.family && prefs.family!=='inherit') ? prefs.family : '';
        removeOpenDyslexic();
        }

        // Aplicar la familia intentando forzarla sobre reglas existentes (usar estilo inyectado con !important)
        applyDynamicFontStyle(fam);

        // Notificar cambios de altura si hay iframe contenedor
        try { if(typeof window.sendHeight==='function'){ window.requestAnimationFrame(()=>setTimeout(window.sendHeight,40)); } } catch(e){}
    }
    function cambiarTam(delta){ prefs.size=Math.min(5,Math.max(-3,prefs.size+delta)); aplicar(); guardar(); }
    function setFamily(f){ prefs.family=f; aplicar(); guardar(); }
    function setVoice(v){ prefs.voice=v; guardar(); }
    
    function cargarVocesEnSelector(){
        const selectVoz=document.querySelector('select[data-act="voice"]');
        if(!selectVoz) return;
        
        const voces=speechSynthesis.getVoices();
        if(voces.length===0){
            speechSynthesis.onvoiceschanged = cargarVocesEnSelector;
            return;
        }
        
        vocesDisponibles=voces;
        selectVoz.innerHTML='<option value="">Automática (Español)</option>';
        
        // Filtrar y mostrar solo voces en español
        const vocesEspanol=voces.filter(v=>/^es/i.test(v.lang));
        vocesEspanol.forEach(voz=>{
            const opt=document.createElement('option');
            opt.value=voz.name;
            opt.textContent=`${voz.name} (${voz.lang})`;
            if(prefs.voice===voz.name) opt.selected=true;
            selectVoz.appendChild(opt);
        });
        
        // Si hay otras voces disponibles, agregarlas en un grupo separado
        const otrasVoces=voces.filter(v=>!/^es/i.test(v.lang));
        if(otrasVoces.length>0){
            const optgroup=document.createElement('optgroup');
            optgroup.label='Otros idiomas';
            otrasVoces.forEach(voz=>{
                const opt=document.createElement('option');
                opt.value=voz.name;
                opt.textContent=`${voz.name} (${voz.lang})`;
                if(prefs.voice===voz.name) opt.selected=true;
                optgroup.appendChild(opt);
            });
            selectVoz.appendChild(optgroup);
        }
    }

    // Inyecta una hoja de estilos dinámica que fuerza la familia tipográfica mediante !important
    function applyDynamicFontStyle(family){
        // eliminar estilo anterior
        const id = 'accesibilidad-dyn-font';
        let st = document.getElementById(id);
        if(st) st.parentNode.removeChild(st);
        if(!family) return;
        st = document.createElement('style'); st.id = id; st.type='text/css';
        // Lista de selectores a los que forzaremos la fuente en modo accesibilidad (Mobirise)
        const selectors = [
        'html.accesibilidad-activa',
        'html.accesibilidad-activa body',
        'html.accesibilidad-activa p',
        'html.accesibilidad-activa li',
        'html.accesibilidad-activa h1',
        'html.accesibilidad-activa h2',
        'html.accesibilidad-activa h3',
        'html.accesibilidad-activa h4',
        'html.accesibilidad-activa .mbr-text',
        'html.accesibilidad-activa .mbr-section-title',
        'html.accesibilidad-activa .mbr-fonts-style',
        'html.accesibilidad-activa .item-text',
        'html.accesibilidad-activa .panel-text',
        'html.accesibilidad-activa .mbr-label',
        'html.accesibilidad-activa .content-wrapper',
        'html.accesibilidad-activa .text-wrapper',
        'html.accesibilidad-activa .title-wrapper',
        'html.accesibilidad-activa .card',
        // Asegurar que controles y botones también usen la fuente accesible
        'html.accesibilidad-activa button',
        'html.accesibilidad-activa input',
        'html.accesibilidad-activa textarea',
        'html.accesibilidad-activa select',
        'html.accesibilidad-activa label',
        'html.accesibilidad-activa .btn',
        'html.accesibilidad-activa a'
        ];
        const css = selectors.join(',') + '{ font-family: ' + family + ' !important; }';
        st.appendChild(document.createTextNode(css));
        document.head.appendChild(st);
    }

    // Asegura que la hoja/fonts OpenDyslexic esté cargada (intenta hoja local 'opendyslexic.css' y luego CDN)
    function ensureOpenDyslexic(){
        const id = 'opendyslexic-link';
        if(document.getElementById(id) || document.querySelector('link[href*="opendyslexic"]')) return;
        try{
        // Intentar cargar hoja local 'opendyslexic.css'. Para páginas en subcarpetas
        // calculamos la ruta base a partir del script que cargó este archivo (document.currentScript o selector).
        let scriptEl = document.currentScript;
        if(!scriptEl){
            // Buscar el primer script cuyo src termine en 'accesibilidad.js'
            scriptEl = Array.from(document.getElementsByTagName('script')).reverse().find(s => (s.src||'').toLowerCase().endsWith('/accesibilidad.js') || (s.src||'').toLowerCase().endsWith('accesibilidad.js')) || null;
        }
        let basePath = '';
        try{
            if(scriptEl && scriptEl.src){
            basePath = scriptEl.src.replace(/[^\/]*accesibilidad\.js(?:\?.*)?$/i, '');
            }
        }catch(_e){ basePath = ''; }

        const tryPaths = [];
        // Preferir hoja en el mismo directorio del script si se pudo calcular
        if(basePath){
            tryPaths.push(basePath + 'opendyslexic.css');
        }
        // También intentar rutas relativas desde la página (1..3 niveles)
        tryPaths.push('opendyslexic.css','../opendyslexic.css','../../opendyslexic.css','../../../opendyslexic.css');

        const idBase = id;
        let loaded = false;
        const head = document.head || document.getElementsByTagName('head')[0] || document.documentElement;
        const tryNext = function(paths){
            if(!paths || !paths.length) {
            // último recurso: CDN
            try{ const d = document.createElement('link'); d.id = idBase + '-cdn'; d.rel='stylesheet'; d.href = 'https://cdn.jsdelivr.net/gh/antijingoist/open-dyslexic@master/open-dyslexic.css'; head.appendChild(d); }catch(_e){}
            return;
            }
            const href = paths.shift();
            const link = document.createElement('link'); link.rel = 'stylesheet'; link.id = idBase; link.href = href;
            link.onload = function(){ loaded = true; };
            link.onerror = function(){ try{ link.parentNode && link.parentNode.removeChild(link); }catch(_e){}; tryNext(paths); };
            head.appendChild(link);
        };
        tryNext(tryPaths.slice());
        }catch(e){}
    }

    function removeOpenDyslexic(){ const n=document.getElementById('opendyslexic-link'); if(n) n.parentNode.removeChild(n); }
    function toggleContraste(){ prefs.contrast=!prefs.contrast; aplicar(); guardar(); }
    function textoLectura(){
        // Capturar todo el contenido principal sin el panel de accesibilidad
        const sections = Array.from(document.querySelectorAll('section:not(#accesibilidad-panel)'));
        let textoCompleto = '';
        
        sections.forEach(section => {
            const clone = section.cloneNode(true);
            // Quitar elementos que no deben leerse
            clone.querySelectorAll('#accesibilidad-panel, #btn-accesibilidad, script, style, nav, footer, img, picture, figure, svg, canvas, input[type="image"], iframe, .socicon, .mbr-iconfont, button, .btn, a[class*="btn"]').forEach(n=>n.remove());
            const texto = clone.textContent.replace(/\s+/g,' ').trim();
            if(texto) textoCompleto += texto + '. ';
        });
        
        return textoCompleto.slice(0,15000) || 'No hay contenido disponible para leer.';
    }
    function iniciarLectura(){
        if(!('speechSynthesis' in window)){ alert('Lectura de voz no soportada en este navegador'); return; }
        detenerLectura(true);
        const txt=textoLectura(); 
        if(!txt || txt === 'No hay contenido disponible para leer.') { 
            alert('No se encontró contenido para leer'); 
            return; 
        }
        
        // Esperar a que las voces estén cargadas
        const iniciarSintesis = () => {
            const u=new SpeechSynthesisUtterance(txt);
            const voces=speechSynthesis.getVoices();
            vocesDisponibles=voces;
            
            let vozSeleccionada=null;
            // Si hay una voz guardada, intentar usarla
            if(prefs.voice){
                vozSeleccionada=voces.find(v=>v.name===prefs.voice);
            }
            // Si no hay voz guardada o no se encontró, usar voz por defecto en español
            if(!vozSeleccionada){
                vozSeleccionada=voces.find(v=>/es[-_](MX|ES|US)/i.test(v.lang)) || voces.find(v=>/^es/i.test(v.lang));
            }
            
            if(vozSeleccionada) u.voice=vozSeleccionada;
            u.lang= (vozSeleccionada && vozSeleccionada.lang) || 'es-ES';
            u.rate = 1.0;
            u.pitch = 1.0;
            u.volume = 1.0;
            vozActiva=u; 
            speechSynthesis.speak(u);
        };
        
        if(speechSynthesis.getVoices().length > 0) {
            iniciarSintesis();
        } else {
            speechSynthesis.onvoiceschanged = iniciarSintesis;
        }
    }
    function detenerLectura(force){ if(!('speechSynthesis' in window)) return; speechSynthesis.cancel(); if(force) vozActiva=null; }

    function construirPanel(){
        if(document.getElementById('accesibilidad-panel')) return;
        // Botón flotante circular
        if(!document.getElementById('btn-accesibilidad')){
        const btn=document.createElement('button');
        btn.id='btn-accesibilidad';
        btn.type='button';
        btn.className='sidebar-tab accesibilidad-tab'; // reutiliza estilos del tab lateral
        btn.setAttribute('aria-label','Mostrar opciones de accesibilidad');
        btn.setAttribute('aria-expanded','false');
        // Solo icono (homologado al botón MENÚ pero sin texto)
    btn.innerHTML='<span class="tab-icon" aria-hidden="true"><img src="https://desarrollo.clavijero.edu.mx/cursos/pregrado/imagenes_cursos/i-03.png" alt="Accesibilidad" style="width:35px; height:auto; display:block; margin:0 auto;"></span>';
        document.body.appendChild(btn);
        btn.addEventListener('click',()=>{
            let panel=document.getElementById('accesibilidad-panel');
            if(!panel){ crearPanelReal(); panel=document.getElementById('accesibilidad-panel'); }
            if(!panel) return;
            const visible=panel.classList.toggle('visible');
            btn.setAttribute('aria-expanded', String(visible));
        });
        }
        // Crear panel oculto inicialmente
        function crearPanelReal(){
        const div=document.createElement('div');
        div.id='accesibilidad-panel';
        div.setAttribute('role','dialog');
        div.setAttribute('aria-label','Opciones de accesibilidad');
        div.innerHTML=`<div class="cabecera"><h3>Accesibilidad</h3><button class="cerrar" data-act="close" aria-label="Cerrar panel">×</button></div>
            <div class="grp"><button data-act="inc">A+</button><button data-act="dec">A-</button></div>
            <label class="lbl-select">Fuente<select data-act="family">
            <option value="inherit">Por defecto</option>
            <option value="Verdana, sans-serif">Verdana</option>
            <option value="Arial, sans-serif">Arial</option>
            <option value="'Times New Roman', serif">Times</option>
            <option value="'Open Sans', sans-serif">Open Sans</option>
            <option value="'Courier New', monospace">Monoespacio</option>
            <option value="OpenDyslexic">OpenDyslexic</option>
            </select></label>
            <button data-act="contrast">Alto contraste</button>
            <label class="lbl-select">Voz de lectura<select data-act="voice">
            <option value="">Cargando voces...</option>
            </select></label>
            <button data-act="tts-play">Leer</button>
            <button data-act="tts-stop">Detener lectura</button>
            <button data-act="reset">Restablecer</button>`;
        document.body.appendChild(div);
        // Reposicionar si el botón homologado (sidebar-tab) existe
        const trigger=document.getElementById('btn-accesibilidad');
        if(trigger && trigger.classList.contains('sidebar-tab')){
            // Colocar el panel debajo del botón en el lado derecho
            const top = (trigger.offsetTop + trigger.offsetHeight + 8);
            div.style.top = top + 'px';
            div.style.right = '0';
            div.style.bottom = 'auto';
        }
        requestAnimationFrame(()=>div.classList.add('visible'));
        enlazarEventos(div);
        const sel=div.querySelector('select[data-act="family"]'); if(sel) sel.value=prefs.family;
        cargarVocesEnSelector();
        }
        function enlazarEventos(div){
        div.addEventListener('click',e=>{
            const t = e.target.closest('[data-act]');
            const act = t && t.getAttribute('data-act');
            if(!act) return;
            if(act==='inc') cambiarTam(1);
            else if(act==='dec') cambiarTam(-1);
            else if(act==='contrast') toggleContraste();
            else if(act==='tts-play') iniciarLectura();
            else if(act==='tts-stop') detenerLectura();
            else if(act==='reset'){ prefs={...DEF}; aplicar(); guardar(); detenerLectura(true);} 
            else if(act==='close'){ div.classList.remove('visible'); const btn=document.getElementById('btn-accesibilidad'); if(btn) btn.setAttribute('aria-expanded','false'); }
        });
        const select=div.querySelector('select[data-act="family"]');
        if(select){ select.addEventListener('change', e=>{ setFamily(e.target.value); }); }
        const selectVoz=div.querySelector('select[data-act="voice"]');
        if(selectVoz){ selectVoz.addEventListener('change', e=>{ setVoice(e.target.value); }); }
        }
    }
    document.addEventListener('DOMContentLoaded', function(){ aplicar(); construirPanel(); });
    })();
