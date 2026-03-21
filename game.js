// ─── Truc Valenciano · game.js ─────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, get, set, remove, onValue, runTransaction }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBHQ3hSWToVKzADI9eUlCNONbi_lN_TTAI",
  authDomain:        "trucvalencia-12345.firebaseapp.com",
  databaseURL:       "https://trucvalencia-12345-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "trucvalencia-12345",
  storageBucket:     "trucvalencia-12345.firebasestorage.app",
  messagingSenderId: "922530958932",
  appId:             "1:922530958932:web:84fe1d9386f5ea2d6f67c1"
};

initializeApp(firebaseConfig);
const db = getDatabase();

// ─── Constants ────────────────────────────────────────────────────────────────
const LS = { room:'truc_room', seat:'truc_seat', name:'truc_name' };
const INACTIVITY_MS = 60 * 60 * 1000;  // 60 min → borrar sala
const TURN_SECONDS  = 30;               // segundos por turno

const SUITS = {
  oros:    { label:'oros',    cls:'s-oros'    },
  copas:   { label:'copas',  cls:'s-copas'   },
  espadas: { label:'espadas',cls:'s-espadas' },
  bastos:  { label:'bastos', cls:'s-bastos'  }
};
const SUIT_ORDER = ['oros','copas','espadas','bastos'];

const SUIT_SVG = {
  oros:`<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="2" fill="rgba(176,125,16,.1)"/>
    <circle cx="16" cy="16" r="7"  stroke="currentColor" stroke-width="1.5" fill="rgba(176,125,16,.15)"/>
    <circle cx="16" cy="16" r="3"  fill="currentColor"/>
  </svg>`,
  copas:`<svg viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 5 Q8 15 16 17 Q24 15 24 5 Z" stroke="currentColor" stroke-width="1.8" fill="rgba(181,42,42,.1)" stroke-linejoin="round"/>
    <path d="M11 17 Q11 22 13.5 23.5 L13.5 28 M18.5 23.5 Q21 22 21 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M10 28 L22 28" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M13 5 Q15 8 16 5 Q17 8 19 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" fill="none"/>
  </svg>`,
  espadas:`<svg viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 3 L16 30" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M16 3 L11 14 L16 11 L21 14 Z" fill="currentColor" opacity=".85"/>
    <path d="M8 22 L24 22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M14 30 L18 30 L17.5 33 L14.5 33 Z" fill="currentColor"/>
  </svg>`,
  bastos:`<svg viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 32 Q10 23 13 16 Q9 12 11 7 Q15 5 16 9 Q17 5 21 7 Q23 12 19 16 Q22 23 20 32 Z"
      stroke="currentColor" stroke-width="1.8" fill="rgba(42,92,23,.1)" stroke-linejoin="round"/>
    <circle cx="11" cy="7"  r="3" fill="currentColor" opacity=".65"/>
    <circle cx="21" cy="7"  r="3" fill="currentColor" opacity=".65"/>
    <circle cx="16" cy="5"  r="2.5" fill="currentColor" opacity=".8"/>
  </svg>`
};

const TRICK_ORDER_GROUPS = [
  ['1_espadas'],['1_bastos'],['7_espadas'],['7_oros'],
  ['3_oros','3_copas','3_espadas','3_bastos'],
  ['2_oros','2_copas','2_espadas','2_bastos'],
  ['1_oros','1_copas'],
  ['12_oros','12_copas','12_espadas','12_bastos'],
  ['11_oros','11_copas','11_espadas','11_bastos'],
  ['10_oros','10_copas','10_espadas','10_bastos'],
  ['7_copas','7_bastos'],
  ['6_oros','6_copas','6_espadas','6_bastos'],
  ['5_oros','5_copas','5_espadas','5_bastos'],
  ['4_oros','4_copas','4_espadas','4_bastos']
];
const TRICK_RANK = (()=>{
  const m={};let s=100;
  for(const g of TRICK_ORDER_GROUPS){for(const c of g)m[c]=s;s-=10;}
  return m;
})();

// ─── Audio ────────────────────────────────────────────────────────────────────
let _actx=null;
const actx=()=>{ if(!_actx)_actx=new(window.AudioContext||window.webkitAudioContext)(); return _actx; };
function tone(freq,type='sine',dur=0.1,vol=0.15,delay=0){
  try{
    const c=actx(),t=c.currentTime+delay;
    const o=c.createOscillator(),g=c.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,t);
    g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+dur);
  }catch(e){}
}
const sndCard  = ()=>{ tone(440,'triangle',0.07,0.14); tone(560,'triangle',0.05,0.09,0.06); };
const sndWin   = ()=>{ [523,659,784,1047].forEach((f,i)=>tone(f,'sine',0.14,0.17,i*0.1)); };
const sndPoint = ()=>{ tone(330,'sine',0.11,0.13); tone(450,'sine',0.09,0.11,0.1); };
const sndTick  = ()=>{ tone(880,'square',0.04,0.06); };

// ─── Session state ────────────────────────────────────────────────────────────
let roomRef=null, roomCode=null, mySeat=null, unsubFn=null;
let inactivityTimer=null;

// Timers de cuenta atrás — uno por tipo para no acumular
let startTimer=null;      // 10s inicio partida
let betweenTimer=null;    // 5s entre manos
let turnTimer=null;       // 30s por turno

// Claves para detectar cambios de estado sin disparar múltiples veces
let prevStateKey='';        // `status-handNumber`
let prevTurnKey='';         // `handNumber-trickIndex-turn` para reiniciar timer de turno
let prevBothReady=false;    // true cuando hay 2 jugadores y status=waiting primera vez

// Para sonidos
let prevEnvitState='none', prevTrucState='none';

// ─── DOM ──────────────────────────────────────────────────────────────────────
const $=id=>document.getElementById(id);

// ─── Pure helpers ─────────────────────────────────────────────────────────────
const clone=o=>JSON.parse(JSON.stringify(o));
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36);
const sanitize=s=>String(s||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
const normName=s=>String(s||'').trim().slice(0,24)||'Invitado';
const other=s=>s===0?1:0;

function parseCard(c){const[n,s]=String(c).split('_');return{num:Number(n),suit:s};}
function cardLabel(c){const{num,suit}=parseCard(c);return`${num} de ${SUITS[suit].label}`;}
function trickRank(c){return TRICK_RANK[c]??0;}
function cmpTrick(a,b){const d=trickRank(a)-trickRank(b);return d>0?1:d<0?-1:0;}
function envitVal(c){const n=parseCard(c).num;return n>=10?0:n;}
function bestEnvit(cards){
  if(!cards||cards.length!==3)return 0;
  let best=0;
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){
    const a=parseCard(cards[i]),b=parseCard(cards[j]);
    if(a.suit===b.suit){const v=20+envitVal(cards[i])+envitVal(cards[j]);if(v>best)best=v;}
  }
  return best>0?best:Math.max(...cards.map(envitVal));
}
function pName(state,seat){return state?.players?.[seat]?.name||`Jugador ${seat}`;}
function pushLog(state,text){
  state.logs=state.logs||[];
  state.logs.unshift({text,at:Date.now()});
  state.logs=state.logs.slice(0,30);
}
function descOffer(offer){
  if(!offer)return'Sin apuesta activa';
  const by=`Jugador ${offer.by}`,to=`Jugador ${offer.to}`;
  if(offer.kind==='envit')return offer.level==='falta'?`Envit de falta (${by}→${to})`:`Envit ${offer.level} (${by}→${to})`;
  return`Truc ${offer.level} (${by}→${to})`;
}

// ─── LocalStorage ─────────────────────────────────────────────────────────────
function loadLS(){
  const n=localStorage.getItem(LS.name),r=localStorage.getItem(LS.room),s=localStorage.getItem(LS.seat);
  if(n)$('nameInput').value=n;
  if(r)$('roomInput').value=r;
  if(s!==null)mySeat=Number(s);
}
function saveLS(name,code,seat){
  localStorage.setItem(LS.name,name||'');
  localStorage.setItem(LS.room,code||'');
  localStorage.setItem(LS.seat,String(seat));
}

// ─── Inactivity ───────────────────────────────────────────────────────────────
function resetInactivity(){
  clearTimeout(inactivityTimer);
  inactivityTimer=setTimeout(async()=>{
    if(roomRef)try{await remove(roomRef);}catch(e){}
    localStorage.removeItem(LS.room);localStorage.removeItem(LS.seat);
    location.reload();
  },INACTIVITY_MS);
}

// ─── Default state ────────────────────────────────────────────────────────────
function defaultState(){
  return{version:1,status:'waiting',roomCode:'',
    players:{0:null,1:null},scores:{0:0,1:0},
    handNumber:0,mano:0,turn:0,hand:null,logs:[],winner:null};
}

// ─── Deck ─────────────────────────────────────────────────────────────────────
function buildDeck(){
  const cards=[],nums=[1,2,3,4,5,6,7,10,11,12];
  for(const s of SUIT_ORDER)for(const n of nums)cards.push(`${n}_${s}`);
  return cards;
}
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

// ─── Hand factory ─────────────────────────────────────────────────────────────
function makeHand(mano){
  const deck=shuffle(buildDeck());
  return{
    status:'in_progress',mano,turn:mano,mode:'normal',
    envitAvailable:true,pendingOffer:null,resume:null,
    hands:{0:deck.slice(0,3),1:deck.slice(3,6)},
    currentTrick:{cards:{},lead:mano,playedBy:[]},
    trickIndex:0,trickWins:{0:0,1:0},trickHistory:[],
    scoreAwards:{0:0,1:0},
    envit:{state:'none',caller:null,responder:null,acceptedLevel:0,acceptedBy:null},
    truc:{state:'none',caller:null,responder:null,acceptedLevel:0,acceptedBy:null}
  };
}

// ─── Game logic ───────────────────────────────────────────────────────────────
function handWinner(state){
  const h=state.hand,w=h.trickWins||{0:0,1:0};
  if(w[0]>=2)return 0;if(w[1]>=2)return 1;
  const hist=h.trickHistory||[];
  if(hist.length<3)return state.mano;
  const r1=hist[0]?.winner??null,r2=hist[1]?.winner??null,r3=hist[2]?.winner??null;
  if(r1===null&&r2===null&&r3===null)return state.mano;
  if(r1===null)return r2!==null?r2:r3!==null?r3:state.mano;
  return r1;
}

function applyHandEnd(state,reason){
  const h=state.hand;if(!h)return;
  const finish=()=>{
    if(state.scores[0]>=12||state.scores[1]>=12){
      const w=state.scores[0]>state.scores[1]?0:state.scores[1]>state.scores[0]?1:state.mano;
      state.status='game_over';state.winner=w;state.hand=null;return true;
    }return false;
  };
  if(h.envit.state==='accepted'){
    const v0=bestEnvit(h.hands[0]),v1=bestEnvit(h.hands[1]);
    const ew=v0>v1?0:v1>v0?1:state.mano;
    const ep=h.envit.acceptedLevel==='falta'?12-Math.max(state.scores[0],state.scores[1]):Number(h.envit.acceptedLevel||0);
    state.scores[ew]+=ep;pushLog(state,`Envit: gana Jugador ${ew} (+${ep}).`);
    if(finish())return;
  }
  for(const s of[0,1])state.scores[s]+=Number(h.scoreAwards?.[s]||0);
  if(finish())return;
  if(h.truc.state==='accepted'){
    const tw=handWinner(state),tp=Number(h.truc.acceptedLevel||0);
    state.scores[tw]+=tp;pushLog(state,`Truc: gana Jugador ${tw} (+${tp}).`);
    if(finish())return;
  }
  if(reason)pushLog(state,reason);
  pushLog(state,`Marcador: ${state.scores[0]}–${state.scores[1]}`);
  state.mano=other(state.mano);state.turn=state.mano;
  state.status='waiting';state.hand=null;
  state.handNumber=Number(state.handNumber||0)+1;
}

function resolveTrick(state){
  const h=state.hand,cards=h.currentTrick.cards;
  const cmp=cmpTrick(cards[0],cards[1]);
  const w=cmp>0?0:cmp<0?1:null;
  h.trickHistory.push({index:h.trickIndex+1,cards:clone(cards),winner:w,lead:h.currentTrick.lead});
  if(w!==null){h.trickWins[w]+=1;h.turn=w;pushLog(state,`Baza ${h.trickIndex+1}: gana Jugador ${w}.`);}
  else{h.turn=h.currentTrick.lead;pushLog(state,`Baza ${h.trickIndex+1}: parda.`);}
  h.currentTrick={cards:{},lead:h.turn,playedBy:[]};
  h.trickIndex+=1;h.mode='normal';
  if(h.trickWins[0]>=2||h.trickWins[1]>=2||h.trickIndex>=3){
    applyHandEnd(state,`La mano la gana Jugador ${handWinner(state)}.`);
  }
}

function resumeOffer(state){
  const h=state.hand,r=h.resume;
  h.pendingOffer=null;h.envitAvailable=false;
  if(r){h.mode=r.mode;h.turn=r.turn;}else{h.mode='normal';}
  h.resume=null;
}

// ─── Firebase wrapper ─────────────────────────────────────────────────────────
async function mutate(fn){
  if(!roomRef)return;
  return runTransaction(roomRef,cur=>{
    if(!cur)return cur;
    const next=clone(cur);
    if(!next.state)next.state=defaultState();
    next.lastActivity=Date.now();
    const ok=fn(next.state);
    if(ok===false)return;
    return next;
  },{applyLocally:false});
}

// ─── Actions ──────────────────────────────────────────────────────────────────
async function dealHand(){
  await mutate(state=>{
    if(!state.players?.[0]||!state.players?.[1])return false;
    if(state.status==='game_over')return false;
    if(state.hand&&state.hand.status==='in_progress')return false;
    state.hand=makeHand(state.mano);
    state.status='playing';
    pushLog(state,`Nueva mano #${state.handNumber+1}. Mano: Jugador ${state.mano}.`);
    return true;
  });
}

async function playCard(card){
  await mutate(state=>{
    const h=state.hand;
    if(!h||state.status!=='playing'||h.status!=='in_progress')return false;
    if(h.turn!==mySeat||h.mode!=='normal'||h.pendingOffer)return false;
    const mine=h.hands?.[mySeat]||[];
    if(!mine.includes(card))return false;
    h.hands[mySeat]=mine.filter(c=>c!==card);
    h.currentTrick.cards[mySeat]=card;
    h.currentTrick.playedBy.push(mySeat);
    h.envitAvailable=false;
    pushLog(state,`Jugador ${mySeat} juega ${cardLabel(card)}.`);
    const oth=other(mySeat);
    if(!h.currentTrick.cards[oth]){h.turn=oth;h.envitAvailable=true;return true;}
    resolveTrick(state);return true;
  });
}

async function goMazo(){
  await mutate(state=>{
    const h=state.hand;
    if(!h||state.status!=='playing'||h.status!=='in_progress')return false;
    if(h.turn!==mySeat||h.mode!=='normal'||h.pendingOffer)return false;
    if(h.trickIndex!==0||Object.keys(h.currentTrick.cards||{}).length!==0)return false;
    const w=other(mySeat);h.scoreAwards[w]+=1;
    pushLog(state,`Jugador ${mySeat} se va al mazo. +1 para Jugador ${w}.`);
    applyHandEnd(state,'Mazo.');return true;
  });
}

async function startOffer(kind){
  await mutate(state=>{
    const h=state.hand;
    if(!h||state.status!=='playing'||h.status!=='in_progress')return false;
    if(h.turn!==mySeat||h.pendingOffer)return false;
    if(kind==='envit'){
      if(!(h.mode==='normal'||h.mode==='respond_truc'))return false;
      if(!h.envitAvailable||h.envit.state!=='none')return false;
      h.resume={mode:h.mode,turn:h.turn};
      h.pendingOffer={kind:'envit',level:2,by:mySeat,to:other(mySeat)};
      h.mode='respond_envit';h.turn=other(mySeat);
      pushLog(state,`Jugador ${mySeat} canta envit.`);return true;
    }
    if(kind==='truc'){
      if(h.mode!=='normal')return false;
      h.resume={mode:h.mode,turn:h.turn};
      h.pendingOffer={kind:'truc',level:2,by:mySeat,to:other(mySeat)};
      h.mode='respond_truc';h.turn=other(mySeat);h.envitAvailable=true;
      pushLog(state,`Jugador ${mySeat} canta truc.`);return true;
    }
    return false;
  });
}

async function respondEnvit(choice){
  await mutate(state=>{
    const h=state.hand,offer=h?.pendingOffer;
    if(!h||state.status!=='playing'||h.status!=='in_progress')return false;
    if(!offer||offer.kind!=='envit'||h.turn!==mySeat||h.mode!=='respond_envit')return false;
    const caller=offer.by,resp=offer.to;
    if(choice==='vull'){
      h.envit={state:'accepted',caller,responder:resp,acceptedLevel:offer.level,acceptedBy:mySeat};
      h.envitAvailable=false;
      pushLog(state,`Envit aceptado (${offer.level==='falta'?'falta':offer.level}).`);
      resumeOffer(state);return true;
    }
    if(choice==='no_vull'){
      h.envit={state:'rejected',caller,responder:resp,acceptedLevel:0,acceptedBy:null};
      h.scoreAwards[caller]+=1;h.envitAvailable=false;
      pushLog(state,`Envit rechazado. +1 para Jugador ${caller}.`);
      resumeOffer(state);return true;
    }
    if(choice==='torne'){
      if(offer.level!==2)return false;
      h.pendingOffer={kind:'envit',level:4,by:resp,to:caller};
      h.turn=caller;h.mode='respond_envit';h.envitAvailable=false;
      pushLog(state,'Torne a envit 4.');return true;
    }
    if(choice==='falta'){
      h.pendingOffer={kind:'envit',level:'falta',by:resp,to:caller};
      h.turn=caller;h.mode='respond_envit';h.envitAvailable=false;
      pushLog(state,'Envit de falta.');return true;
    }
    return false;
  });
}

async function respondTruc(choice){
  await mutate(state=>{
    const h=state.hand,offer=h?.pendingOffer;
    if(!h||state.status!=='playing'||h.status!=='in_progress')return false;
    if(!offer||offer.kind!=='truc'||h.turn!==mySeat||h.mode!=='respond_truc')return false;
    const caller=offer.by,resp=offer.to;
    if(choice==='vull'){
      h.truc={state:'accepted',caller,responder:resp,acceptedLevel:offer.level,acceptedBy:mySeat};
      h.envitAvailable=false;
      pushLog(state,`Truc aceptado (${offer.level}).`);
      resumeOffer(state);return true;
    }
    if(choice==='no_vull'){
      h.truc={state:'rejected',caller,responder:resp,acceptedLevel:0,acceptedBy:null};
      h.scoreAwards[caller]+=1;h.envitAvailable=false;
      pushLog(state,`Truc rechazado. +1 para Jugador ${caller}. Mano terminada.`);
      applyHandEnd(state,'No vull al truc.');return true;
    }
    if(choice==='retruque'){
      if(offer.level!==2)return false;
      h.pendingOffer={kind:'truc',level:3,by:resp,to:caller};
      h.turn=caller;h.mode='respond_truc';h.envitAvailable=true;
      pushLog(state,'Retruque a 3.');return true;
    }
    if(choice==='val4'){
      if(offer.level!==2&&offer.level!==3)return false;
      h.pendingOffer={kind:'truc',level:4,by:resp,to:caller};
      h.turn=caller;h.mode='respond_truc';h.envitAvailable=true;
      pushLog(state,'Val 4 al truc.');return true;
    }
    return false;
  });
}

// ─── Timeout: jugador pierde su mano por inacción ──────────────────────────────
async function timeoutCurrentTurn(){
  // El jugador cuyo turno sea mySeat pierde la baza: jugamos la primera carta disponible
  await mutate(state=>{
    const h=state.hand;
    if(!h||state.status!=='playing'||h.status!=='in_progress')return false;
    if(h.turn!==mySeat)return false;
    // Si hay oferta pendiente que nos corresponde responder, rechazamos
    if(h.pendingOffer&&h.pendingOffer.to===mySeat){
      if(h.pendingOffer.kind==='envit'){
        h.envit={state:'rejected',caller:h.pendingOffer.by,responder:mySeat,acceptedLevel:0,acceptedBy:null};
        h.scoreAwards[h.pendingOffer.by]+=1;h.envitAvailable=false;
        pushLog(state,`Tiempo. Envit rechazado automáticamente.`);
        resumeOffer(state);return true;
      }
      if(h.pendingOffer.kind==='truc'){
        h.truc={state:'rejected',caller:h.pendingOffer.by,responder:mySeat,acceptedLevel:0,acceptedBy:null};
        h.scoreAwards[h.pendingOffer.by]+=1;h.envitAvailable=false;
        pushLog(state,`Tiempo. Truc rechazado automáticamente.`);
        applyHandEnd(state,'No vull al truc (tiempo).');return true;
      }
    }
    // Si no hay oferta, jugamos la primera carta
    if(h.mode==='normal'){
      const mine=h.hands?.[mySeat]||[];
      if(!mine.length)return false;
      const card=mine[0];
      h.hands[mySeat]=mine.slice(1);
      h.currentTrick.cards[mySeat]=card;
      h.currentTrick.playedBy.push(mySeat);
      h.envitAvailable=false;
      pushLog(state,`Jugador ${mySeat} juega ${cardLabel(card)} (tiempo).`);
      const oth=other(mySeat);
      if(!h.currentTrick.cards[oth]){h.turn=oth;h.envitAvailable=true;return true;}
      resolveTrick(state);return true;
    }
    return false;
  });
}

// ─── Timer de turno ───────────────────────────────────────────────────────────
function stopTurnTimer(){
  clearInterval(turnTimer);turnTimer=null;
  const fill=$('turnTimerFill');
  if(fill){fill.style.width='100%';fill.classList.remove('urgent','timer-flash');}
}

function startTurnTimer(isMyTurn){
  stopTurnTimer();
  const fill=$('turnTimerFill');
  if(!fill)return;
  fill.classList.remove('urgent','timer-flash');
  if(!isMyTurn){fill.style.width='0%';return;}

  let remaining=TURN_SECONDS;
  fill.style.transition='none';
  fill.style.width='100%';

  // pequeño delay para que el browser pinte el 100% antes de empezar
  setTimeout(()=>{
    fill.style.transition=`width 1s linear`;
    turnTimer=setInterval(()=>{
      remaining--;
      const pct=Math.max(0,(remaining/TURN_SECONDS)*100);
      fill.style.width=pct+'%';
      if(remaining<=10){fill.classList.add('urgent');}
      if(remaining<=5){sndTick();}
      if(remaining<=0){
        stopTurnTimer();
        timeoutCurrentTurn();
      }
    },1000);
  },50);
}

// ─── Countdown overlays ───────────────────────────────────────────────────────
function stopAllCountdowns(){
  clearInterval(startTimer);  startTimer=null;
  clearInterval(betweenTimer);betweenTimer=null;
  $('startOverlay').classList.add('hidden');
  $('countdownOverlay').classList.add('hidden');
}

// Cuenta atrás de INICIO de partida (10s) — se lanza cuando ambos jugadores están listos
// y status es 'waiting' y handNumber===0
function runStartCountdown(state){
  stopAllCountdowns();
  const overlay=$('startOverlay'), num=$('startNum');
  $('startPlayers').textContent=`${pName(state,0)} vs ${pName(state,1)}`;
  overlay.classList.remove('hidden');
  let n=10; num.textContent=n;
  startTimer=setInterval(async()=>{
    n--;
    if(n>0){ num.textContent=n; sndTick(); }
    else{
      clearInterval(startTimer);startTimer=null;
      overlay.classList.add('hidden');
      if(mySeat===0)await dealHand();
    }
  },1000);
}

// Cuenta atrás ENTRE MANOS (5s)
function runBetweenCountdown(){
  stopAllCountdowns();
  const overlay=$('countdownOverlay'), num=$('countdownNum');
  overlay.classList.remove('hidden');
  let n=5; num.textContent=n;
  betweenTimer=setInterval(async()=>{
    n--;
    if(n>0){ num.textContent=n; sndTick(); }
    else{
      clearInterval(betweenTimer);betweenTimer=null;
      overlay.classList.add('hidden');
      if(mySeat===0)await dealHand();
    }
  },1000);
}

// ─── Card builders ────────────────────────────────────────────────────────────
function svgEl(suit,size){
  const tmp=document.createElement('span');
  tmp.innerHTML=SUIT_SVG[suit]||'';
  const svg=tmp.firstElementChild;
  if(svg){svg.style.width=size+'px';svg.style.height=size+'px';svg.style.display='block';}
  return svg||document.createElement('span');
}

function buildCardEl(card){
  const{num,suit}=parseCard(card);
  const el=document.createElement('div');
  el.className=`playing-card ${SUITS[suit].cls}`;
  const top=document.createElement('div');top.className='pc-top';
  const rT=document.createElement('span');rT.className='pc-rank';rT.textContent=num;
  top.appendChild(rT);top.appendChild(svgEl(suit,13));
  const ctr=document.createElement('div');ctr.className='pc-center';
  ctr.appendChild(svgEl(suit,30));
  const bot=document.createElement('div');bot.className='pc-bot';
  const rB=document.createElement('span');rB.className='pc-rank';rB.textContent=num;
  bot.appendChild(rB);bot.appendChild(svgEl(suit,13));
  el.appendChild(top);el.appendChild(ctr);el.appendChild(bot);
  return el;
}

function buildBackEl(){
  const el=document.createElement('div');el.className='card-back';return el;
}

// ─── Card fly animation ───────────────────────────────────────────────────────
function animateCardPlay(cardEl,card,onDone){
  const slot=$(`trickSlot${mySeat}`);
  const from=cardEl.getBoundingClientRect();
  const to=slot?slot.getBoundingClientRect():{left:window.innerWidth/2,top:window.innerHeight/2,width:80,height:114};
  const flying=buildCardEl(card);
  flying.classList.add('card-flying');
  flying.style.cssText=`left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px;position:fixed;pointer-events:none;z-index:200;`;
  const tx=(to.left+to.width/2)-(from.left+from.width/2);
  const ty=(to.top+to.height/2)-(from.top+from.height/2);
  flying.style.setProperty('--tx',tx+'px');
  flying.style.setProperty('--ty',ty+'px');
  flying.style.setProperty('--rot',(Math.random()*10-5)+'deg');
  document.body.appendChild(flying);
  flying.addEventListener('animationend',()=>{flying.remove();if(onDone)onDone();},{once:true});
}

// ─── Render functions ─────────────────────────────────────────────────────────
function renderRivalCards(cards){
  const zone=$('rivalCards');zone.innerHTML='';
  const count=cards?cards.length:0;
  zone.setAttribute('data-count',count);
  for(let i=0;i<count;i++){
    const slot=document.createElement('div');slot.className='rival-card-slot deal-anim';
    slot.appendChild(buildBackEl());zone.appendChild(slot);
  }
}

function renderMyCards(state){
  const hand=state.hand,zone=$('myCards');zone.innerHTML='';
  if(!hand)return;
  const cards=hand.hands?.[mySeat]||[];
  const isMyTurn=hand.turn===mySeat&&hand.mode==='normal'&&!hand.pendingOffer&&state.status==='playing';
  cards.forEach(card=>{
    const wrap=document.createElement('div');wrap.className='my-card-wrap deal-anim';
    const cardEl=buildCardEl(card);
    wrap.appendChild(cardEl);
    if(isMyTurn){
      wrap.classList.add('playable');
      wrap.addEventListener('click',()=>{
        if(!wrap.classList.contains('playable'))return;
        wrap.classList.remove('playable'); // evitar doble click
        sndCard();
        animateCardPlay(cardEl,card,()=>playCard(card));
      },{once:true});
    }
    zone.appendChild(wrap);
  });
}

function renderTrick(state){
  const hand=state.hand;
  $('trickSlot0').innerHTML='';$('trickSlot1').innerHTML='';
  if(!hand)return;
  const cards=hand.currentTrick?.cards||{};
  [0,1].forEach(seat=>{
    if(cards[seat]){
      const el=buildCardEl(cards[seat]);el.classList.add('land-anim');
      $(`trickSlot${seat}`).appendChild(el);
    }
  });
  const info=$('centerInfo');info.innerHTML='';
  const hist=hand.trickHistory||[];
  if(hist.length){
    const dots=document.createElement('div');dots.className='trick-history-dots';
    hist.forEach(t=>{
      const d=document.createElement('div');d.className='trick-dot';
      if(t.winner===null)d.classList.add('draw');
      else if(t.winner===mySeat)d.classList.add('won');
      else d.classList.add('lost');
      dots.appendChild(d);
    });
    info.appendChild(dots);
  }
}

function renderActions(state){
  const hand=state.hand;
  const envitBtn=$('envitBtn'),trucBtn=$('trucBtn'),mazoBtn=$('mazoBtn');
  const respArea=$('responseArea'),offerMsg=$('offerMsg');
  respArea.innerHTML='';respArea.classList.add('hidden');offerMsg.classList.add('hidden');

  const isPlaying=state.status==='playing'&&hand?.status==='in_progress';
  if(!isPlaying){
    envitBtn.disabled=true;trucBtn.disabled=true;mazoBtn.disabled=true;
    $('statusMsg').textContent=state.status==='waiting'?'Esperando…':state.status==='game_over'?'Partida terminada':'';
    return;
  }
  const myTurn=hand.turn===mySeat;
  const normal=hand.mode==='normal';
  const envitDone=hand.envit.state!=='none';

  envitBtn.disabled=!myTurn||!hand.envitAvailable||envitDone||!!hand.pendingOffer
    ||(hand.mode!=='normal'&&hand.mode!=='respond_truc');
  trucBtn.disabled=!myTurn||!normal||!!hand.pendingOffer;
  mazoBtn.disabled=!myTurn||!normal||!!hand.pendingOffer
    ||hand.trickIndex!==0||Object.keys(hand.currentTrick?.cards||{}).length!==0;

  if(hand.pendingOffer&&hand.turn===mySeat){
    offerMsg.textContent=descOffer(hand.pendingOffer);offerMsg.classList.remove('hidden');
    respArea.classList.remove('hidden');
    const add=(txt,cls,fn)=>{
      const b=document.createElement('button');b.textContent=txt;
      b.className=`abtn ${cls}`;b.addEventListener('click',fn);respArea.appendChild(b);
    };
    if(hand.pendingOffer.kind==='envit'){
      add('Vull','abtn-green',()=>respondEnvit('vull'));
      add('No vull','abtn-red',()=>respondEnvit('no_vull'));
      if(hand.pendingOffer.level===2){add('Torne','abtn-gold',()=>respondEnvit('torne'));add('Falta','abtn-gold',()=>respondEnvit('falta'));}
      else if(hand.pendingOffer.level===4){add('Falta','abtn-gold',()=>respondEnvit('falta'));}
    } else if(hand.pendingOffer.kind==='truc'){
      if(hand.envitAvailable&&!envitDone)add('Envidar','abtn-green',()=>startOffer('envit'));
      add('Vull','abtn-green',()=>respondTruc('vull'));
      add('No vull','abtn-red',()=>respondTruc('no_vull'));
      if(hand.pendingOffer.level===2)add('Retruque','abtn-gold',()=>respondTruc('retruque'));
      if(hand.pendingOffer.level===2||hand.pendingOffer.level===3)add('Val 4','abtn-gold',()=>respondTruc('val4'));
    }
  }

  const sm=$('statusMsg');
  if(!myTurn&&hand.pendingOffer)sm.textContent=`Esperando a ${pName(state,hand.turn)}…`;
  else if(!myTurn)sm.textContent=`Turno de ${pName(state,hand.turn)}`;
  else if(normal&&!hand.pendingOffer)sm.textContent='Tu turno — elige carta o acción';
  else sm.textContent='';
}

function renderHUD(state){
  $('hudRoom').textContent=`Sala ${state.roomCode||roomCode||'—'}`;
  $('hudSeat').textContent=`Jugador ${mySeat===null?'—':mySeat}`;
  $('hudScore0').textContent=String(state.scores?.[0]??0);
  $('hudScore1').textContent=String(state.scores?.[1]??0);
  $('hudName0').textContent=pName(state,0);
  $('hudName1').textContent=pName(state,1);
  $('siMano').textContent=`Jugador ${state.mano}${state.mano===mySeat?' (tú)':''}`;
  $('siHand').textContent=String(state.handNumber??0);
  $('siBazas').textContent=state.hand?`${state.hand.trickWins[0]}-${state.hand.trickWins[1]}`:'0-0';
}

function renderLog(state){
  const area=$('logArea');area.innerHTML='';
  (state.logs||[]).slice(0,15).forEach(item=>{
    const d=document.createElement('div');d.className='log-entry';d.textContent=item.text;area.appendChild(d);
  });
}

function renderNames(state){
  $('myName').textContent=pName(state,mySeat);
  $('rivalName').textContent=pName(state,other(mySeat));
}

// ─── Sound detector ───────────────────────────────────────────────────────────
function detectSounds(state){
  const h=state.hand;
  if(!h)return;
  if(h.envit.state==='accepted'&&prevEnvitState!=='accepted'){sndPoint();}
  if(h.truc.state==='accepted'&&prevTrucState!=='accepted'){sndPoint();}
  prevEnvitState=h.envit.state||'none';
  prevTrucState=h.truc.state||'none';
}

// ─── Main render — called on every Firebase update ────────────────────────────
function renderAll(room){
  const state=room?.state||defaultState();
  resetInactivity();
  detectSounds(state);

  renderHUD(state);
  renderNames(state);
  renderRivalCards(state.hand?.hands?.[other(mySeat)]||[]);
  renderMyCards(state);
  renderTrick(state);
  renderActions(state);
  renderLog(state);

  // ── Lógica de cuentas atrás y timer de turno ──────────────────────────────

  const bothReady=!!(state.players?.[0]&&state.players?.[1]);
  const stateKey=`${state.status}-${state.handNumber}`;
  const hand=state.hand;

  if(state.status==='game_over'){
    stopAllCountdowns();
    stopTurnTimer();
    $('gameOverOverlay').classList.remove('hidden');
    $('goWinner').textContent=pName(state,state.winner)+' gana';
    $('goScore').textContent=`${state.scores[0]} – ${state.scores[1]}`;
    sndWin();
    prevStateKey=stateKey;
    return;
  }

  $('gameOverOverlay').classList.add('hidden');

  if(state.status==='waiting'&&bothReady){
    if(stateKey!==prevStateKey){
      // Primera vez (handNumber===0 con status waiting + 2 jugadores) → inicio de partida
      if(state.handNumber===0&&!startTimer&&!betweenTimer){
        runStartCountdown(state);
      } else if(state.handNumber>0){
        // Entre manos
        runBetweenCountdown();
      }
    }
    stopTurnTimer();
  } else if(state.status==='playing'&&hand){
    stopAllCountdowns();
    // Timer de turno: reiniciar si cambió el turno o la baza
    const turnKey=`${state.handNumber}-${hand.trickIndex}-${hand.turn}-${hand.mode}`;
    if(turnKey!==prevTurnKey){
      const isMyTurn=hand.turn===mySeat&&hand.status==='in_progress';
      startTurnTimer(isMyTurn);
      prevTurnKey=turnKey;
    }
  }

  prevStateKey=stateKey;
}

// ─── Room management ──────────────────────────────────────────────────────────
function goToGame(){
  $('screenLobby').classList.add('hidden');
  $('screenGame').classList.remove('hidden');
}

function startSession(code){
  roomCode=code;roomRef=ref(db,`rooms/${code}`);
  if(unsubFn)unsubFn();
  unsubFn=onValue(roomRef,snap=>renderAll(snap.val()));
  goToGame();
}

function setLobbyMsg(txt,cls=''){
  const el=$('lobbyMsg');el.textContent=txt;el.className='lobby-msg'+(cls?` ${cls}`:'');
}

async function createRoom(){
  const name=normName($('nameInput').value);
  const code=sanitize($('roomInput').value)||Math.random().toString(36).slice(2,6).toUpperCase();
  const r=ref(db,`rooms/${code}`);
  const ex=await get(r);
  if(ex.exists()){setLobbyMsg('Esa sala ya existe. Usa Unirse.','err');return;}
  const init=defaultState();
  init.roomCode=code;init.players[0]={name,clientId:uid()};
  init.logs=[{text:`Sala creada por ${name}.`,at:Date.now()}];
  await set(r,{meta:{createdAt:Date.now(),roomCode:code},state:init,lastActivity:Date.now()});
  mySeat=0;saveLS(name,code,0);$('roomInput').value=code;
  setLobbyMsg(`Sala ${code} creada.`,'good');
  startSession(code);
}

async function joinRoom(){
  const name=normName($('nameInput').value);
  const code=sanitize($('roomInput').value);
  if(!code){setLobbyMsg('Escribe un código de sala.','err');return;}
  const r=ref(db,`rooms/${code}`);
  const result=await runTransaction(r,cur=>{
    if(!cur)return cur;
    if(!cur.state)cur.state=defaultState();
    const st=cur.state;
    if(st.players?.[0]&&st.players?.[1])return cur;
    if(!st.players[0]){st.players[0]={name,clientId:uid()};pushLog(st,`${name} entra como Jugador 0.`);}
    else{st.players[1]={name,clientId:uid()};pushLog(st,`${name} entra como Jugador 1.`);}
    cur.lastActivity=Date.now();return cur;
  },{applyLocally:false});
  if(!result.committed){setLobbyMsg('No se pudo entrar. Sala llena o inexistente.','err');return;}
  const fs=result.snapshot.val()?.state;
  if(!fs){setLobbyMsg('Sala no encontrada.','err');return;}
  if(fs.players?.[1]?.name===name&&fs.players?.[0]?.name!==name)mySeat=1;
  else if(fs.players?.[0]?.name===name)mySeat=0;
  else mySeat=1;
  saveLS(name,code,mySeat);
  setLobbyMsg(`Unido como Jugador ${mySeat}.`,'good');
  startSession(code);
}

async function leaveRoom(){
  stopAllCountdowns();stopTurnTimer();
  if(roomRef&&mySeat!==null){
    try{await remove(ref(db,`rooms/${roomCode}/state/players/${mySeat}`));}catch(e){}
  }
  localStorage.removeItem(LS.room);localStorage.removeItem(LS.seat);
  location.reload();
}

// ─── Events ───────────────────────────────────────────────────────────────────
$('createBtn').addEventListener('click',createRoom);
$('joinBtn').addEventListener('click',joinRoom);
$('leaveBtn').addEventListener('click',leaveRoom);
$('goLeaveBtn').addEventListener('click',leaveRoom);
$('envitBtn').addEventListener('click',()=>startOffer('envit'));
$('trucBtn').addEventListener('click',()=>startOffer('truc'));
$('mazoBtn').addEventListener('click',goMazo);
$('logToggle').addEventListener('click',()=>{
  const b=$('logBody');b.classList.toggle('hidden');
  $('logToggle').textContent=b.classList.contains('hidden')?'▸ Registro':'▾ Registro';
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
loadLS();
const savedRoom=localStorage.getItem(LS.room);
if(savedRoom){
  roomCode=sanitize(savedRoom);$('roomInput').value=roomCode;
  const ss=localStorage.getItem(LS.seat);
  if(ss!==null)mySeat=Number(ss);
  startSession(roomCode);
}
