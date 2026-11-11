(() => {
  const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
  const shell = document.getElementById('game-shell');
  const TAU = Math.PI * 2;
  let W = 1000, H = 625, dpr = 1, last = 0, game = 'title', soundOn = false;
  let audio;
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const rand = (a,b)=>a+Math.random()*(b-a);
  const choose = a=>a[Math.floor(Math.random()*a.length)];
  const keys = Object.create(null);
  const pointer = {x:0,y:0,down:false,id:null};
  const palettes = [
    ['#c5bf66','#e1d78d','#aca54d','#777541'], ['#b2ad67','#d4ce86','#9c9858','#77734a'],
    ['#c6b96b','#e6d994','#b2a954','#817b48'], ['#aaa563','#d2c985','#949052','#6e714b'],
    ['#c9bd76','#e5db9d','#b0a65e','#77744e']
  ];
  let player, enemies=[], bullets=[], enemyShots=[], pickups=[], particles=[], decor=[], map, upgrades=[], upgradeChoices=[], floor=1, floorTime=0, spawnClock, wave, kills, totalKills, shake=0, flash=0, introTime, score;
  const upgradePool = [
    {name:'BIGGER PROP',tag:'DAMAGE',desc:'Your shots hit harder.',icon:'✦',apply:p=>p.damage+=4},
    {name:'TURBO ENGINE',tag:'SPEED',desc:'Fly faster through the maze.',icon:'➤',apply:p=>p.speed+=38},
    {name:'EXTRA AMMO',tag:'FIRE RATE',desc:'Shoot more often.',icon:'✹',apply:p=>p.fireRate=Math.max(.12,p.fireRate*.78)},
    {name:'PAPER ARMOR',tag:'ARMOR',desc:'A little more hull to spare.',icon:'⬟',apply:p=>p.maxHp+=20},
    {name:'GUMDROP FUEL',tag:'REPAIR',desc:'Patch up your plane.',icon:'♥',apply:p=>p.hp=Math.min(p.maxHp,p.hp+28)},
    {name:'WIDE WINGS',tag:'SPREAD',desc:'Add another pair of shots.',icon:'✣',apply:p=>p.multishot=Math.min(5,p.multishot+1)},
    {name:'LUCKY CHARM',tag:'PICKUPS',desc:'More goodies from baddies.',icon:'☘',apply:p=>p.luck+=.12},
    {name:'GOLDEN NOSE',tag:'CRITICAL',desc:'Big hits happen more often.',icon:'✧',apply:p=>p.crit+=.08},
    {name:'PAPERCLIP SHIELD',tag:'SHIELD',desc:'Shrug off one extra bump.',icon:'◈',apply:p=>p.shield++},
    {name:'BUBBLE GUM',tag:'SLOW TIME',desc:'Enemies drift a little slower.',icon:'◉',apply:p=>p.slow=Math.min(.35,p.slow+.08)}
  ];
  const zones=['THE YELLOW LOOP','CARPET COUNTRY','THE HUMMING WING','OFFICE OF NOWHERE','THE LONG HALL','THE DAMP LEVEL','LOST & FOUND','THE FALSE EXIT','MOTHLIGHT MALL','THE LAST ROOM'];
  function resize(){
    const r=shell.getBoundingClientRect(); W=r.width; H=r.height; dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
    if(player){player.x=clamp(player.x,48,W-48);player.y=clamp(player.y,90,H-45)}
  }
  window.addEventListener('resize',resize); resize();
  function startGame(){
    player={x:W*.5,y:H*.57,vx:0,vy:0,r:17,hp:100,maxHp:100,speed:240,damage:13,fireRate:.38,fire:0,multishot:1,luck:0,crit:.05,shield:0,slow:0,invuln:0,dash:0,dashCd:0,angle:-Math.PI/2,level:1,xp:0,nextXp:32};
    enemies=[];bullets=[];enemyShots=[];pickups=[];particles=[];decor=[];upgrades=[];floor=1;floorTime=0;spawnClock=1;wave=1;kills=0;totalKills=0;shake=0;flash=0;score=0;introTime=2;game='playing';
    createMap(); for(let i=0;i<17;i++)addDecor();
  }
  function createMap(){
    const cols=Math.ceil(W/72),rows=Math.ceil(H/72); map={cols,rows,tiles:[],offset:Math.random()*1000};
    for(let y=0;y<rows;y++){map.tiles[y]=[];for(let x=0;x<cols;x++){
      const n=(x*17+y*31+floor*19)%23;
      map.tiles[y][x]=n===0?'stain':n===6?'stripe':'plain';
    }}
  }
  function addDecor(){decor.push({x:rand(20,W-20),y:rand(72,H-20),type:Math.random()<.58?'lamp':'stain',s:rand(.7,1.3),phase:rand(0,TAU)})}
  function beginFloor(){
    floor++;floorTime=0;wave=1;spawnClock=.7;enemies=[];enemyShots=[];createMap();
    for(let i=0;i<7;i++)addDecor();
    player.hp=Math.min(player.maxHp,player.hp+12);player.invuln=1.5;
    for(let i=0;i<24;i++)particles.push({x:player.x+rand(-30,30),y:player.y+rand(-25,25),vx:rand(-60,60),vy:rand(-80,10),life:rand(.3,.9),color:'#e4dc94',size:rand(2,5)});
  }
  function spawnEnemy(){
    const edge=Math.floor(Math.random()*4);let x=edge===0?rand(0,W):edge===1?rand(0,W):edge===2?-24:W+24;let y=edge===0?-24:edge===1?H+24:rand(60,H);
    const difficulty=1+(floor-1)*.12+Math.floor(floor/4)*.18;
    const r=Math.random();let type=r<.16+Math.min(floor*.01,.12)?'moth':r<.39?'stalker':'dust';
    const data=type==='moth'?{r:17,hp:40,speed:82,color:'#a58adb',damage:12,xp:5}:{...type==='stalker'?{r:14,hp:28,speed:102,color:'#dc795a',damage:9,xp:4}:{r:11,hp:16,speed:122,color:'#656b58',damage:7,xp:3}};
    enemies.push({x,y,vx:0,vy:0,type,hp:data.hp*difficulty,maxHp:data.hp*difficulty,speed:data.speed*(1+floor*.012),r:data.r,color:data.color,damage:data.damage,xp:data.xp,phase:rand(0,TAU),hit:0,shoot:rand(1.7,3.8)});
  }
  function burst(x,y,color,n=8){for(let i=0;i<n;i++){const a=rand(0,TAU),s=rand(35,180);particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.22,.62),color,size:rand(2,5)})}}
  function fire(){
    if(player.fire>0)return;
    player.fire=player.fireRate;
    const target=enemies.reduce((best,e)=>{const d=Math.hypot(e.x-player.x,e.y-player.y);return d<best.d?{e,d}:best},{e:null,d:Infinity}).e;
    if(!target)return;
    const base=Math.atan2(target.y-player.y,target.x-player.x);player.angle=base;
    const spread=player.multishot===1?[0]:Array.from({length:player.multishot},(_,i)=>(i-(player.multishot-1)/2)*.14);
    for(const a of spread){const angle=base+a;const crit=Math.random()<player.crit;bullets.push({x:player.x+Math.cos(angle)*20,y:player.y+Math.sin(angle)*20,vx:Math.cos(angle)*560,vy:Math.sin(angle)*560,life:1.15,damage:player.damage*(crit?2:1),crit});}
    if(soundOn)beep(540,.035,'square',.018);
  }
  function update(dt){
    if(game!=='playing')return;
    dt=Math.min(dt,.035);floorTime+=dt;introTime=Math.max(0,introTime-dt);shake=Math.max(0,shake-dt*20);flash=Math.max(0,flash-dt*2);
    if(floorTime>18)wave=2;if(floorTime>36)wave=3;
    const moveX=(keys.ArrowRight||keys.d?1:0)-(keys.ArrowLeft||keys.a?1:0),moveY=(keys.ArrowDown||keys.s?1:0)-(keys.ArrowUp||keys.w?1:0);
    let dx=moveX,dy=moveY;
    if(pointer.down){const ox=pointer.startX??pointer.x,oy=pointer.startY??pointer.y;dx=clamp((pointer.x-ox)/58,-1,1);dy=clamp((pointer.y-oy)/58,-1,1);}
    const mag=Math.hypot(dx,dy);if(mag>1){dx/=mag;dy/=mag}
    if(keys[' ']&&player.dashCd<=0){player.dash=.18;player.dashCd=2.1;player.invuln=.42;burst(player.x,player.y,'#d7f06c',8)}
    player.dashCd=Math.max(0,player.dashCd-dt);player.invuln=Math.max(0,player.invuln-dt);player.fire=Math.max(0,player.fire-dt);
    const boost=player.dash>0?3.2:1;player.dash=Math.max(0,player.dash-dt);
    player.vx+=(dx*player.speed*boost-player.vx)*Math.min(1,dt*9);player.vy+=(dy*player.speed*boost-player.vy)*Math.min(1,dt*9);
    player.x=clamp(player.x+player.vx*dt,38,W-38);player.y=clamp(player.y+player.vy*dt,72,H-40);
    if(Math.hypot(player.vx,player.vy)>20&&Math.hypot(player.vx,player.vy)>Math.hypot(dx,dy)*30)player.angle=Math.atan2(player.vy,player.vx);
    fire();
    spawnClock-=dt;const rate=Math.max(.22,1.15-floor*.045);if(spawnClock<=0){spawnEnemy();if(floorTime>22&&Math.random()<.42)spawnEnemy();spawnClock=rate*rand(.65,1.3)}
    for(const e of enemies){
      e.phase+=dt*3;e.hit=Math.max(0,e.hit-dt*5);const a=Math.atan2(player.y-e.y,player.x-e.x),spd=e.speed*(1-player.slow);
      if(e.type==='moth'){e.shoot-=dt;e.vx+=(Math.cos(a)*spd-e.vx)*dt*1.6;e.vy+=(Math.sin(a)*spd-e.vy)*dt*1.6;if(e.shoot<0&&Math.hypot(e.x-player.x,e.y-player.y)<360){const ang=a;enemyShots.push({x:e.x,y:e.y,vx:Math.cos(ang)*150,vy:Math.sin(ang)*150,life:3,r:6});e.shoot=rand(2.4,3.6)}}
      else{e.vx+=(Math.cos(a)*spd-e.vx)*dt*2.7;e.vy+=(Math.sin(a)*spd-e.vy)*dt*2.7}
      e.x+=e.vx*dt;e.y+=e.vy*dt;
      if(Math.hypot(e.x-player.x,e.y-player.y)<e.r+player.r&&player.invuln<=0){hurt(e.damage);e.vx-=Math.cos(a)*180;e.vy-=Math.sin(a)*180}
    }
    for(const b of bullets){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;for(const e of enemies){if(e.hp>0&&Math.hypot(b.x-e.x,b.y-e.y)<e.r+5){e.hp-=b.damage;e.hit=.12;b.life=0;burst(b.x,b.y,b.crit?'#fff17a':'#f3d996',b.crit?7:3);if(e.hp<=0){kills++;totalKills++;score+=10*floor;burst(e.x,e.y,e.color,12);if(Math.random()<.64+player.luck)pickups.push({x:e.x,y:e.y,r:7,xp:e.xp,phase:rand(0,TAU),type:'xp'});if(Math.random()<.035)pickups.push({x:e.x,y:e.y,r:8,hp:18,phase:0,type:'heart'});}}}}
    for(const b of enemyShots){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(Math.hypot(b.x-player.x,b.y-player.y)<b.r+player.r&&player.invuln<=0){b.life=0;hurt(10)}}
    for(const p of pickups){p.phase+=dt*4;const d=Math.hypot(player.x-p.x,player.y-p.y);if(d<115){const a=Math.atan2(player.y-p.y,player.x-p.x);p.x+=Math.cos(a)*Math.min(520,1750/(d+12))*dt;p.y+=Math.sin(a)*Math.min(520,1750/(d+12))*dt}if(d<player.r+p.r+3){p.got=true;if(p.type==='xp')gainXp(p.xp);else player.hp=Math.min(player.maxHp,player.hp+p.hp);burst(p.x,p.y,p.type==='xp'?'#d8f36a':'#ff8294',5)}}
    for(const q of particles){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.96;q.vy*=.96;q.life-=dt}
    enemies=enemies.filter(e=>e.hp>0);bullets=bullets.filter(b=>b.life>0&&b.x>-30&&b.x<W+30&&b.y>-30&&b.y<H+30);enemyShots=enemyShots.filter(b=>b.life>0);pickups=pickups.filter(p=>!p.got);particles=particles.filter(p=>p.life>0);
    if(floorTime>=52){game=floor>=10?'win':'exit';burst(W*.5,H*.5,'#e3ea8b',30)}
  }
  function hurt(amount){if(player.shield>0){player.shield--;player.invuln=1;burst(player.x,player.y,'#b5e9e9',14)}else{player.hp-=amount;player.invuln=.85;shake=8;flash=.4;burst(player.x,player.y,'#ff815e',12);if(soundOn)beep(130,.14,'sawtooth',.045);if(player.hp<=0){player.hp=0;game='over'}}}
  function gainXp(n){player.xp+=n;if(player.xp>=player.nextXp){player.xp-=player.nextXp;player.level++;player.nextXp=Math.floor(player.nextXp*1.3+10);game='upgrade';upgradeChoices=[...upgradePool].sort(()=>Math.random()-.5).slice(0,3)}}
  function chooseUpgrade(i){if(game!=='upgrade')return;const u=upgradeChoices[i];if(!u)return;u.apply(player);upgrades.push(u.name);game='playing';if(soundOn)beep(720,.09,'triangle',.04)}
  function beep(freq,duration,type='sine',volume=.03){try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.value=volume;o.connect(g);g.connect(audio.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.stop(audio.currentTime+duration)}catch(_){}}
  function rounded(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}}
  function text(str,x,y,size,color='#f7f1df',weight=800,align='left',font='Nunito'){ctx.fillStyle=color;ctx.font=`${weight} ${size}px '${font}', sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(str,x,y)}
  function drawBackground(t){
    const pal=palettes[(floor-1)%palettes.length];ctx.fillStyle=pal[0];ctx.fillRect(0,0,W,H);
    // Repeating, slightly warped wallpaper and office carpet.
    for(let y=55;y<H;y+=72)for(let x=0;x<W;x+=72){const ox=((Math.floor(y/72)%2)*36),xx=x+ox;ctx.fillStyle=((Math.floor(x/72)+Math.floor(y/72))%2)?pal[1]:pal[0];ctx.fillRect(xx,y,72,72);ctx.strokeStyle='#4c4a2d18';ctx.lineWidth=1;ctx.strokeRect(xx+.5,y+.5,71,71);ctx.fillStyle='#484a3110';ctx.fillRect(xx,y+68,72,4);}
    for(const d of decor){if(d.type==='lamp'){const flick=.86+Math.sin(t*2+d.phase)*.1;ctx.save();ctx.translate(d.x,d.y);ctx.fillStyle=`rgba(255,244,175,${.16*flick})`;ctx.beginPath();ctx.ellipse(0,0,49*d.s,23*d.s,0,0,TAU);ctx.fill();rounded(-19*d.s,-5*d.s,38*d.s,9*d.s,4,'#e7e1b5','#6b693c77');ctx.fillStyle='#fff7d5';ctx.fillRect(-13*d.s,-3*d.s,26*d.s,4*d.s);ctx.restore()}else{ctx.fillStyle='#675e3815';ctx.beginPath();ctx.ellipse(d.x,d.y,19*d.s,9*d.s,d.phase,0,TAU);ctx.fill()}}
    // Vignette, old-film grain and subtle glowing pool around the pilot.
    const v=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.18,W/2,H/2,Math.max(W,H)*.72);v.addColorStop(0,'#00000000');v.addColorStop(1,'#25271f66');ctx.fillStyle=v;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#ffffe5';for(let i=0;i<42;i++){const x=((i*173+t*11)%W),y=((i*89+t*7)%H);ctx.globalAlpha=.035+((i%3)*.008);ctx.fillRect(x,y,1,1)}ctx.globalAlpha=1;
  }
  function drawPlane(x,y,angle,scale=1,ghost=false){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale,scale);
    // Propeller blur and chunky cartoon fuselage.
    ctx.fillStyle='#f8b45155';ctx.beginPath();ctx.ellipse(-22,0,8,15+Math.sin(performance.now()/35)*2,0,0,TAU);ctx.fill();
    ctx.fillStyle='#283c3d';ctx.beginPath();ctx.ellipse(-1,4,22,10,0,0,TAU);ctx.fill();
    ctx.fillStyle='#71c8b3';ctx.strokeStyle='#263c3a';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.moveTo(20,0);ctx.quadraticCurveTo(10,-4,1,-5);ctx.lineTo(-8,-19);ctx.quadraticCurveTo(-13,-22,-13,-18);ctx.lineTo(-10,-5);ctx.lineTo(-19,-3);ctx.lineTo(-25,-9);ctx.quadraticCurveTo(-28,-10,-27,-6);ctx.lineTo(-23,2);ctx.lineTo(-27,8);ctx.quadraticCurveTo(-28,12,-24,10);ctx.lineTo(-18,5);ctx.lineTo(-10,6);ctx.lineTo(-13,18);ctx.quadraticCurveTo(-12,22,-8,18);ctx.lineTo(1,6);ctx.quadraticCurveTo(11,5,20,0);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#f4f0cf';ctx.beginPath();ctx.ellipse(4,0,8,3.8,0,0,TAU);ctx.fill();ctx.strokeStyle='#345455';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#4c7f7a';ctx.beginPath();ctx.arc(4,0,2,0,TAU);ctx.fill();
    ctx.fillStyle='#ee7958';ctx.beginPath();ctx.arc(-16,0,2.4,0,TAU);ctx.fill();
    ctx.strokeStyle='#4b4a32';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-25,-15);ctx.lineTo(-25,15);ctx.stroke();ctx.restore();
  }
  function drawEnemy(e){ctx.save();ctx.translate(e.x,e.y+Math.sin(e.phase)*2);const squish=1+Math.sin(e.phase*2)*.07;ctx.scale(squish,1/squish);
    ctx.fillStyle='#39342633';ctx.beginPath();ctx.ellipse(0,e.r*.75,e.r*1.1,e.r*.38,0,0,TAU);ctx.fill();
    if(e.type==='moth'){ctx.fillStyle=e.hit?'#fff':e.color;ctx.beginPath();ctx.ellipse(-8,0,11,7,Math.sin(e.phase)*.7,0,TAU);ctx.ellipse(8,0,11,7,-Math.sin(e.phase)*.7,0,TAU);ctx.fill();ctx.fillStyle='#413657';ctx.beginPath();ctx.ellipse(0,1,7,10,0,0,TAU);ctx.fill();ctx.fillStyle='#fff2d6';ctx.beginPath();ctx.arc(-2,-2,2,0,TAU);ctx.arc(3,-2,2,0,TAU);ctx.fill();}
    else{ctx.fillStyle=e.hit?'#fff':e.color;ctx.beginPath();ctx.roundRect(-e.r,-e.r*.82,e.r*2,e.r*1.7,6);ctx.fill();ctx.fillStyle='#f8eaca';ctx.beginPath();ctx.arc(-4,-2,2.4,0,TAU);ctx.arc(4,-2,2.4,0,TAU);ctx.fill();ctx.strokeStyle='#332c25';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(0,3,4,.2,Math.PI-.2);ctx.stroke();ctx.fillStyle='#ffffff22';ctx.fillRect(-e.r+2,-e.r*.75,3,e.r*1.35)}
    if(e.hp<e.maxHp){rounded(-e.r,-e.r-8,e.r*2,3,2,'#26291e99');rounded(-e.r,-e.r-8,e.r*2*clamp(e.hp/e.maxHp,0,1),3,2,'#f5d276')}
    ctx.restore();}
  function drawHud(){
    // Dark glass strips deliberately avoid covering the playfield.
    rounded(24,22,224,59,9,'#171c19df','#ffffff21');text('HULL',40,40,9,'#b7b99d',800,'left','DM Mono');rounded(40,52,190,10,5,'#080d0c');rounded(40,52,190*player.hp/player.maxHp,10,5,player.hp/player.maxHp<.3?'#fb795b':'#d7e875');text(`${Math.ceil(player.hp)} / ${player.maxHp}`,235,40,10,'#edebd8',700,'right','DM Mono');
    rounded(W/2-125,22,250,59,9,'#171c19df','#ffffff21');text(`ROOM ${String(floor).padStart(2,'0')}  /  10`,W/2,39,12,'#f0e9ca',900,'center','DM Mono');text(zones[(floor-1)%zones.length],W/2,59,9,'#c7c89e',500,'center','DM Mono');
    rounded(W-247,22,223,59,9,'#171c19df','#ffffff21');text('THINGS TAMED',W-228,40,9,'#b7b99d',800,'left','DM Mono');text(String(totalKills).padStart(3,'0'),W-42,48,22,'#d7ed77',900,'right','DM Mono');
    const xpW=Math.min(300,W*.48),xpX=(W-xpW)/2;rounded(xpX,H-42,xpW,8,5,'#101511cc');rounded(xpX,H-42,xpW*player.xp/player.nextXp,8,5,'#95d4c2');text(`LV ${player.level}`,xpX-10,H-38,10,'#ebead6',800,'right','DM Mono');text(`${player.xp} / ${player.nextXp}`,xpX+xpW+10,H-38,10,'#d2d3b5',500,'left','DM Mono');
    const remaining=Math.max(0,52-floorTime);text(`WAVE ${wave}  ·  ${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(Math.floor(remaining%60)).padStart(2,'0')}`,W-30,H-35,10,'#e9e5d1',700,'right','DM Mono');
    if(player.shield){text('◈ '.repeat(player.shield),35,96,12,'#b5e9e9',900)}
    if(player.dashCd>0){rounded(26,H-75,72,4,2,'#151916aa');rounded(26,H-75,72*(1-player.dashCd/2.1),4,2,'#e5a56a');text('DASH',26,H-85,8,'#c7c8ad',700,'left','DM Mono')}
  }
  function draw(){
    shell.classList.toggle('in-game',game!=='title');ctx.save();if(shake)ctx.translate(rand(-shake,shake),rand(-shake,shake));drawBackground(performance.now()/1000);
    for(const p of pickups){ctx.save();ctx.translate(p.x,p.y+Math.sin(p.phase)*3);ctx.fillStyle=p.type==='xp'?'#d8f36a':'#ff8294';ctx.strokeStyle='#4d5331';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,p.r+Math.sin(p.phase)*.8,0,TAU);ctx.fill();ctx.stroke();text(p.type==='xp'?'✦':'+',0,0,10,'#343c2c',900,'center');ctx.restore()}
    for(const b of bullets){ctx.fillStyle=b.crit?'#fff17a':'#fff0c1';ctx.beginPath();ctx.ellipse(b.x,b.y,6,3,Math.atan2(b.vy,b.vx),0,TAU);ctx.fill();}
    for(const b of enemyShots){ctx.fillStyle='#ce8df0';ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,TAU);ctx.fill();ctx.strokeStyle='#f5c5ee';ctx.lineWidth=2;ctx.stroke()}
    for(const e of enemies)drawEnemy(e);
    for(const q of particles){ctx.globalAlpha=clamp(q.life*2,0,1);ctx.fillStyle=q.color;ctx.beginPath();ctx.arc(q.x,q.y,q.size*clamp(q.life*2,0,1),0,TAU);ctx.fill()}ctx.globalAlpha=1;
    if(player){if(player.invuln<=0||Math.floor(performance.now()/80)%2===0){if(player.shield){ctx.strokeStyle='#a5e8e8aa';ctx.lineWidth=2;ctx.beginPath();ctx.arc(player.x,player.y,29,0,TAU);ctx.stroke()}drawPlane(player.x,player.y,player.angle,1,player.invuln>0)}drawHud()}
    ctx.restore();if(flash){ctx.fillStyle=`rgba(255,93,65,${flash*.23})`;ctx.fillRect(0,0,W,H)}
    if(game==='title')drawTitle();if(game==='upgrade')drawUpgrade();if(game==='exit')drawExit();if(game==='over')drawOver();if(game==='paused')drawPause();if(game==='win')drawWin();
  }
  function panel(w,h){ctx.fillStyle='#101612c9';ctx.fillRect(0,0,W,H);const x=(W-w)/2,y=(H-h)/2;rounded(x,y,w,h,16,'#202722f5','#ffffff28');return{x,y,w,h}}
  function drawTitle(){
    const p=panel(Math.min(650,W-36),Math.min(460,H-36)),cx=W/2,top=p.y;
    ctx.save();ctx.translate(cx,top+96);ctx.rotate(-.08);drawPlane(-172,9,-.08,1.35);ctx.restore();
    text('PLANE',cx-118,top+73,56,'#f5f0d7',1000,'left');text('TAME',cx-118,top+124,56,'#d7f06c',1000,'left');
    rounded(cx+118,top+88,93,26,13,'#e58c58');text('BACKROOMS SURVIVOR',cx+164,top+101,8,'#251e18',900,'center','DM Mono');
    text('A tiny pilot. A very big maze.',cx,top+180,16,'#d7d4be',700,'center');
    text('TAME THE THINGS. FIND THE WAY OUT.',cx,top+206,10,'#aeb397',500,'center','DM Mono');
    const bw=196,bh=49,bx=cx-bw/2,by=top+247;rounded(bx,by,bw,bh,8,'#d9ef77');text('START FLYING',cx,by+24,14,'#263027',1000,'center');
    text('10 ROOMS  ·  AUTO-FIRE  ·  UPGRADES',cx,top+320,9,'#c7c7aa',600,'center','DM Mono');
    const cy=top+361;text('WASD / ARROWS',cx-107,cy,9,'#f0edda',700,'center','DM Mono');text('MOVE',cx-107,cy+18,8,'#9b9f88',500,'center','DM Mono');text('SPACE',cx,cy,9,'#f0edda',700,'center','DM Mono');text('DASH',cx,cy+18,8,'#9b9f88',500,'center','DM Mono');text('P / ESC',cx+107,cy,9,'#f0edda',700,'center','DM Mono');text('PAUSE',cx+107,cy+18,8,'#9b9f88',500,'center','DM Mono');
  }
  function drawUpgrade(){
    const p=panel(Math.min(690,W-28),Math.min(430,H-26)),cx=W/2,top=p.y;
    text('PICK A PATCH',cx,top+48,25,'#eff0d4',1000,'center');text('THE QUIET MOMENT NEVER LASTS',cx,top+76,9,'#b7bda0',500,'center','DM Mono');
    const gap=12,cw=Math.min(190,(p.w-40-gap*2)/3),ch=208,total=cw*3+gap*2,start=cx-total/2,cy=top+112;
    upgradeChoices.forEach((u,i)=>{const x=start+i*(cw+gap);rounded(x,cy,cw,ch,'10','#303a32','#d7ec7844');rounded(x+cw/2-22,cy+18,44,44,12,'#d7ef7724','#d7ef7755');text(u.icon,x+cw/2,cy+40,25,'#d7ef77',900,'center');text(`0${i+1}`,x+cw-17,cy+18,9,'#aeb79b',600,'right','DM Mono');text(u.tag,x+cw/2,cy+83,8,'#b5c29a',800,'center','DM Mono');text(u.name,x+cw/2,cy+109,12,'#f0eed9',1000,'center');ctx.fillStyle='#d5d5c1';ctx.font=`600 10px 'Nunito',sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';const words=u.desc.split(' ');let line='',lines=[];for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width>cw-24){lines.push(line);line=word}else line=test}lines.push(line);lines.forEach((l,j)=>text(l,x+cw/2,cy+142+j*14,10,'#c1c4ad',600,'center'));rounded(x+15,cy+ch-34,cw-30,24,5,'#d7ef77');text('CHOOSE  '+(i+1),x+cw/2,cy+ch-22,9,'#29312b',900,'center','DM Mono')});
    text('PRESS 1, 2, OR 3',cx,top+p.h-20,9,'#aeb397',600,'center','DM Mono');
  }
  function drawExit(){const p=panel(Math.min(500,W-36),Math.min(330,H-36)),cx=W/2,top=p.y;text('THE EXIT IS REAL?',cx,top+69,24,'#eff0d4',1000,'center');text('A suspiciously normal door hums nearby.',cx,top+106,12,'#c6c8ae',600,'center');rounded(cx-73,top+135,146,69,8,'#a29a5a','#f0df8a');rounded(cx-62,top+145,124,48,5,'#d6c778');rounded(cx+38,top+169,5,5,3,'#574d30');text('ROOM '+String(floor).padStart(2,'0'),cx,top+227,10,'#c8c8a9',600,'center','DM Mono');rounded(cx-105,top+249,210,47,7,'#d7ef77');text('STEP THROUGH  →',cx,top+272,12,'#29312b',1000,'center');}
  function drawOver(){const p=panel(Math.min(470,W-36),330),cx=W/2,top=p.y;text('PAPER DOWN.',cx,top+64,29,'#ff9779',1000,'center');text('The maze keeps your little plane.',cx,top+103,13,'#d1cbb4',600,'center');text(`ROOM ${String(floor).padStart(2,'0')}   ·   THINGS TAMED ${totalKills}`,cx,top+145,10,'#bcc09f',600,'center','DM Mono');rounded(cx-102,top+190,204,49,7,'#d7ef77');text('TRY AGAIN',cx,top+214,13,'#29312b',1000,'center');text('PRESS ENTER TO RESTART',cx,top+265,9,'#aeb397',500,'center','DM Mono')}
  function drawWin(){const p=panel(Math.min(510,W-36),350),cx=W/2,top=p.y;text('YOU FOUND THE OUTSIDE!',cx,top+70,24,'#d7ef77',1000,'center');text('10 rooms tamed. The sky is wonderfully weird.',cx,top+111,12,'#dbd9c2',600,'center');ctx.save();ctx.translate(cx,top+174);drawPlane(0,0,-.12,1.8);ctx.restore();text(`THINGS TAMED  ${totalKills}   ·   PILOT LEVEL  ${player.level}`,cx,top+232,10,'#c9c9ad',600,'center','DM Mono');rounded(cx-101,top+264,202,48,7,'#d7ef77');text('FLY AGAIN',cx,top+288,13,'#29312b',1000,'center')}
  function drawPause(){const p=panel(360,190),cx=W/2,top=p.y;text('ON THE GROUND',cx,top+54,22,'#eff0d4',1000,'center');text('Take a breath. The hum is still there.',cx,top+89,11,'#c6c8ae',600,'center');rounded(cx-82,top+120,164,42,7,'#d7ef77');text('RESUME',cx,top+141,12,'#29312b',1000,'center')}
  function point(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();const p=point(e);pointer.x=p.x;pointer.y=p.y;pointer.down=true;pointer.startX=p.x;pointer.startY=p.y;canvas.setPointerCapture?.(e.pointerId);if(game==='title')startGame();else if(game==='upgrade'){const panelW=Math.min(690,W-28),cw=Math.min(190,(panelW-40-24)/3),gap=12,start=W/2-(cw*3+gap*2)/2,cy=(H-Math.min(430,H-26))/2+112;if(p.y>=cy&&p.y<=cy+208){const i=Math.floor((p.x-start)/(cw+gap));if(i>=0&&i<3)chooseUpgrade(i)}}else if(game==='exit'){if(floor>=10)game='win';else beginFloor()}else if(game==='over')startGame();else if(game==='win')startGame();else if(game==='paused')game='playing';});
  canvas.addEventListener('pointermove',e=>{const p=point(e);pointer.x=p.x;pointer.y=p.y});
  canvas.addEventListener('pointerup',e=>{pointer.down=false;pointer.startX=null;pointer.startY=null});canvas.addEventListener('pointercancel',()=>{pointer.down=false});
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();keys[k]=true;if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(k==='m'){soundOn=!soundOn;document.getElementById('sound-toggle').innerHTML=soundOn?'♫ <span>SOUND ON</span>':'♫ <span>SOUND OFF</span>';if(soundOn)beep(640,.08,'triangle',.03)}if(k==='p'||k==='escape'){if(game==='playing')game='paused';else if(game==='paused')game='playing'}if(game==='title'&&(k==='enter'||k===' '))startGame();if(game==='upgrade'&&['1','2','3'].includes(k))chooseUpgrade(Number(k)-1);if(game==='exit'&&(k==='enter'||k===' ')){if(floor>=10)game='win';else beginFloor()}if((game==='over'||game==='win')&&(k==='enter'||k===' '))startGame()});window.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
  document.getElementById('sound-toggle').addEventListener('click',()=>{soundOn=!soundOn;document.getElementById('sound-toggle').innerHTML=soundOn?'♫ <span>SOUND ON</span>':'♫ <span>SOUND OFF</span>';if(soundOn)beep(640,.08,'triangle',.03)});
  function frame(now){const dt=(now-last)/1000||0;last=now;update(dt);draw();requestAnimationFrame(frame)}requestAnimationFrame(frame);
})();
