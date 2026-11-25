/* WESTPORT city world, procedural architecture and simulation. Native game adapter lives in g-westport-runtime.js. */

/* buildings.js */
/* HANQ / WESTHAVEN — authored procedural architecture, metres, Y up.
 * No network dependencies. Geometry records can be instanced, merged, or
 * exported as glTF. Complete floor layouts are supplied by CityInteriors.
 * Original assets, 2026. */
(function (root) {
  'use strict';
  const PI = Math.PI;
  const defs = [
    ['skyline','아스트라 타워','업무',52,46,152,38,'office'],
    ['stepped_office','테라스 오피스','업무',48,40,102,25,'office'],
    ['round_office','오션 글라스 타워','업무',46,46,80,20,'office'],
    ['hotel','마리나 호텔','숙박',58,44,55,13,'hotel'],
    ['apartment','스카이코트 아파트','주거',50,34,39,10,'home'],
    ['brick_apartment','브릭 코트 주택','주거',40,32,27,7,'home'],
    ['shop_row','아케이드 상점가','상업',66,28,14,3,'retail'],
    ['market','센트럴 실내시장','상업',72,52,16,2,'market'],
    ['mall','웨스트 갤러리아','상업',72,58,25,5,'retail'],
    ['civic_hall','시청과 시민회관','공공',66,48,34,4,'civic'],
    ['hospital','해안 종합병원','공공',64,50,42,10,'medical'],
    ['police','도시 경찰서','공공',46,36,21,5,'police'],
    ['fire_station','항만 소방서','공공',54,38,23,3,'fire'],
    ['school','도시 학교','교육',70,54,20,4,'school'],
    ['station','웨스트 중앙역','교통',74,48,23,3,'station'],
    ['museum','해양 현대미술관','문화',62,48,28,3,'museum'],
    ['restaurant','피어 7 레스토랑','상업',38,30,13,2,'restaurant'],
    ['ferry_terminal','해협 여객터미널','교통',66,42,20,3,'terminal'],
    ['warehouse','부두 물류창고','항만',66,46,17,2,'warehouse'],
    ['fbi_hq','FBI 웨스트포트 본부','공공',72,46,54,12,'fbi']
  ].map(a=>({id:a[0],name:a[1],category:a[2],width:a[3],depth:a[4],height:a[5],floors:a[6],interiorStyle:a[7]}));
  const palettes = {
    concrete:['#d5d5c9','#cbcbbf','#bbc3c2'], stone:'#d4d0c1', trim:'#e8e5d8', dark:'#243941',
    glass:'#376471', glass2:'#5c8b92', glass3:'#27505f', lit:'#d9b875', metal:'#5e6c6e', roof:'#59646a',
    brick:'#a97559', brickDark:'#815e4d', wood:'#91714f', blue:'#327182', foliage:'#59816b'
  };
  function footprint(parts,meta){
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(const p of parts){
      const a=p.rx||0,b=p.ry||0,c=p.rz||0,c1=Math.cos(a),c2=Math.cos(b),c3=Math.cos(c),s1=Math.sin(a),s2=Math.sin(b),s3=Math.sin(c);
      const rows=[[c2*c3,-c2*s3,s2],[c1*s3+s1*s2*c3,c1*c3-s1*s2*s3,-s1*c2],[s1*s3-c1*s2*c3,s1*c3+c1*s2*s3,c1*c2]];
      const v=[p.x,p.y,p.z],size=[p.sx,p.sy,p.sz];
      for(let i=0;i<3;i++){const e=rows[i].reduce((sum,k,j)=>sum+Math.abs(k)*size[j]/2,0);min[i]=Math.min(min[i],v[i]-e);max[i]=Math.max(max[i],v[i]+e);}
    }
    return {width:Math.ceil(Math.max(meta.width,2*Math.max(-min[0],max[0]))*10)/10,depth:Math.ceil(Math.max(meta.depth,2*Math.max(-min[2],max[2]))*10)/10,height:Math.ceil(Math.max(meta.height,max[1])*10)/10,bounds:{min,max}};
  }
  function rand(seed){let s=(seed>>>0)||1;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
  function kit(seed) {
    const parts=[], R=rand(seed);
    function add(shape,x,y,z,sx,sy,sz,color,material='concrete',extra){
      const p={shape,x,y,z,sx,sy,sz,color,material};if(extra)Object.assign(p,extra);parts.push(p);return p;
    }
    const B=(x,y,z,sx,sy,sz,c,m,e)=>add('box',x,y,z,sx,sy,sz,c,m,e);
    const C=(x,y,z,sx,sy,sz,c,m,e)=>add('cylinder',x,y,z,sx,sy,sz,c,m,e);
    const S=(x,y,z,sx,sy,sz,c,m,e)=>add('sphere',x,y,z,sx,sy,sz,c,m,e);
    function hvac(x,y,z,scale=1){
      B(x,y+.65*scale,z,3.7*scale,1.3*scale,2.4*scale,'#788184','metal',{role:'roof'});
      for(let i=-1;i<=1;i++)B(x+i*scale,y+1.32*scale,z,.12*scale,.06*scale,2*scale,'#344a52','metal',{role:'roof'});
      C(x+1.1*scale,y+1.6*scale,z,.8*scale,.5*scale,.8*scale,'#a1aaa7','metal',{role:'roof'});
    }
    function roof(x,y,z,w,d,color=palettes.roof){
      B(x,y,z,w,0.55,d,color,'concrete',{role:'roof'});
      B(x,y+.7,z-d/2+.2,w,1.1,.4,palettes.trim,'concrete',{role:'roof'});
      B(x,y+.7,z+d/2-.2,w,1.1,.4,palettes.trim,'concrete',{role:'roof'});
      B(x-w/2+.2,y+.7,z,.4,1.1,d,palettes.trim,'concrete',{role:'roof'});
      B(x+w/2-.2,y+.7,z,.4,1.1,d,palettes.trim,'concrete',{role:'roof'});
    }
    function door(x,z,w=3,h=3.5,y=0){
      B(x,y+h/2,z,w,h,.18,palettes.glass3,'glass',{role:'window'});
      B(x,y+h/2,z+.13,.10,h,.11,palettes.trim,'metal');
      B(x,y+h+.15,z,w+.35,.3,.35,palettes.trim,'concrete');
      B(x+.22,y+1.3,z+.25,.07,.5,.08,'#c8b48d','metal');
    }
    function stripFacades(x,z,w,d,y,h,nRows,nCols,color=palettes.glass,trim=palettes.trim){
      // Glass ribbons + vertical mullions create a readable curtain wall with
      // substantially fewer instances than separate windows on tall towers.
      const floor=h/nRows;
      for(let row=0;row<nRows;row++){
        const yy=y+floor*(row+.5);
        const c=(row+Math.floor(seed))%9===0?palettes.glass2:color;
        B(x,yy,z+d/2+.04,w-.8,floor*.71,.12,c,'glass',{role:'window'});
        B(x,yy,z-d/2-.04,w-.8,floor*.71,.12,c,'glass',{role:'window'});
        B(x+w/2+.04,yy,z,.12,floor*.71,d-.8,c,'glass',{role:'window'});
        B(x-w/2-.04,yy,z,.12,floor*.71,d-.8,c,'glass',{role:'window'});
      }
      for(let j=0;j<=nCols;j++){
        const xx=x-w/2+.3+(w-.6)*j/nCols,zz=z-d/2+.3+(d-.6)*j/nCols;
        B(xx,y+h/2,z+d/2+.12,.18,h,.3,trim,'metal');
        B(xx,y+h/2,z-d/2-.12,.18,h,.3,trim,'metal');
        B(x+w/2+.12,y+h/2,zz,.3,h,.18,trim,'metal');
        B(x-w/2-.12,y+h/2,zz,.3,h,.18,trim,'metal');
      }
    }
    function windows(x,z,w,d,y,h,rows,cols,c=palettes.glass,side=true){
      for(let r=0;r<rows;r++)for(let k=0;k<cols;k++){
        const xx=x-w/2+(k+.5)*w/cols, yy=y+(r+.5)*h/rows, ww=w/cols*.65,hh=h/rows*.65;
        const cc=R()>.9?palettes.glass2:c;
        B(xx,yy,z+d/2+.08,ww,hh,.15,cc,'glass',{role:'window'});
        B(xx,yy,z-d/2-.08,ww,hh,.15,cc,'glass',{role:'window'});
      }
      if(side)for(let r=0;r<rows;r++)for(let k=0;k<Math.max(2,cols-1);k++){
        const n=Math.max(2,cols-1),zz=z-d/2+(k+.5)*d/n,yy=y+(r+.5)*h/rows;
        B(x+w/2+.08,yy,zz,.15,h/rows*.65,d/n*.65,c,'glass',{role:'window'});
        B(x-w/2-.08,yy,zz,.15,h/rows*.65,d/n*.65,c,'glass',{role:'window'});
      }
    }
    function planter(x,y,z,w=4,d=2){
      B(x,y+.4,z,w,.8,d,'#bcbca8');B(x,y+.85,z,w-.35,.2,d-.35,'#4a6551','foliage');
      for(let i=0;i<3;i++)S(x+(i-1)*w*.25,y+1.25,z,w*.33,1.0,d*.9,'#68896c','foliage');
    }
    function steps(x,z,w=8,n=4,dy=.2,dz=.6,y0=0){for(let i=0;i<n;i++)B(x,y0+(i+1)*dy/2,z-i*dz,w,(i+1)*dy,dz,'#c6c5b9');}
    function posts(x,z,w,d,h=4,cols=5){for(let i=0;i<cols;i++)B(x-w/2+(i+.5)*w/cols,h/2,z,.45,h,d,palettes.trim);}
    function bench(x,z,ry=0,y=0){
      B(x,y+.55,z,3.4,.22,.9,palettes.wood,'wood',{ry});
      const dx=Math.sin(ry)*.4,dz=Math.cos(ry)*.4;
      B(x+dx,y+1,z+dz,3.4,.75,.15,palettes.wood,'wood',{ry});
      B(x-1.2*Math.cos(ry),y+.25,z+1.2*Math.sin(ry),.2,.5,.7,palettes.metal,'metal',{ry});
      B(x+1.2*Math.cos(ry),y+.25,z-1.2*Math.sin(ry),.2,.5,.7,palettes.metal,'metal',{ry});
    }
    return {parts,R,B,C,S,hvac,roof,door,stripFacades,windows,planter,steps,posts,bench};
  }
  function build(id,seed=1) {
    if(root.CityInteriors)return root.CityInteriors.buildShell(id,seed);
    const meta=defs.find(t=>t.id===id);if(!meta)throw new Error('Unknown city building: '+id);
    const K=kit(seed),{B,C,S,hvac,roof,door,stripFacades,windows,planter,steps,posts,bench}=K;
    const P=palettes,con=P.concrete[Math.abs(seed)%P.concrete.length];
    switch(id) {
      case 'fbi_hq': {
        B(0,24,0,70,48,44,'#bfc3bc');stripFacades(0,0,70,44,1,47,12,10,'#355563','#b4bbb8');roof(0,48.5,0,72,46);
        B(0,5,23,20,.65,5,'#bdc5c0');door(0,22.2,7,4.4);
        B(-28,52,-14,10,5,14,'#606f71','metal',{role:'roof'});break;
      }
      case 'skyline': {
        B(0,4,0,50,8,44,P.stone);stripFacades(0,0,50,44,1,6,1,9);
        B(0,56,0,35,96,31,'#47727b');stripFacades(0,0,35,31,8,96,24,7,P.glass3,'#9bafb0');
        B(0,119,0,27,30,25,'#6f9399');stripFacades(0,0,27,25,104,30,7,5,P.glass,'#b9c4bf');
        B(0,139,0,17,10,17,'#afbbb7','metal',{role:'roof'});
        for(let i=-2;i<=2;i++)B(i*3.5,144,0,.5,9,17,'#d7d8cb','metal',{role:'roof'});
        C(0,149,0,.5,6,.5,'#ced2ca','metal',{role:'roof'});
        for(let x of [-19,19]){planter(x,8,0,6,30);hvac(x,8,-15,.9);}
        B(0,4.1,23,15,.35,2.8,P.trim);door(0,22.16,7,6);steps(0,24.6,12,3,.16,.48);
        break;
      }
      case 'stepped_office': {
        let widths=[46,39,31,23],ys=[0,28,55,80],hs=[28,27,25,18];
        for(let i=0;i<4;i++){
          const z=-i*1.5; B(i*2.2,ys[i]+hs[i]/2,z,widths[i],hs[i],36-i*5,con);
          stripFacades(i*2.2,z,widths[i],36-i*5,ys[i]+1,hs[i]-2,Math.round(hs[i]/4),6,P.glass3,'#7c9094');
          roof(i*2.2,ys[i]+hs[i],z,widths[i]+.5,36-i*5+.5);
          if(i<3){planter(-widths[i]/2+5,ys[i]+hs[i],7-i*2,5,9);hvac(widths[i]/2-4,ys[i]+hs[i],-10,.8);}
        }
        B(0,5,19.3,18,.5,3.0,P.trim);door(0,18.15,5,4);break;
      }
      case 'round_office': {
        C(0,3.5,0,45,7,45,'#d3d1c3');C(0,40,0,34,66,34,P.glass,'glass');
        for(let y=8;y<74;y+=3.5)C(0,y,0,34.5,.35,34.5,'#95aaac','metal');
        for(let i=0;i<16;i++){
          let t=i*PI/8;B(Math.sin(t)*17.1,40,Math.cos(t)*17.1,.4,66,.45,'#d2dbd5','metal',{ry:t});
        }
        C(0,75,0,36,3,36,'#d5d9cf','metal',{role:'roof'});C(0,77.2,0,19,1.4,19,P.roof,'metal',{role:'roof'});
        C(0,79,0,7,2,7,'#8ca5aa','metal',{role:'roof'});door(0,22.5,5,5);
        for(let x of [-13,13])planter(x,7,0,4,9);break;
      }
      case 'hotel': {
        B(0,4,0,56,8,42,P.stone);stripFacades(0,0,56,42,1,6,1,8);
        B(-4,27,-3,43,38,32,'#e0d6c1');stripFacades(-4,-3,43,32,9,36,9,7,P.glass,'#e5dbca');
        for(let y=12;y<=44;y+=4)B(-4,y,14.2,44,.35,4,'#c4b59c');
        for(let x=-23;x<18;x+=6)B(x,28,15.6,.25,33,.22,'#8b9a98','metal');
        B(-8,49,-5,29,6,24,'#dfd3bb');windows(-8,-5,29,24,47,4,1,5);
        roof(-8,52.3,-5,30,25);hvac(-17,53,-9,.75);
        B(17,8.55,4,15,.6,23,'#aa9b81');B(17,9,2,9,.4,12,'#328599','water',{role:'roof'});
        for(let z of [-8,12])planter(17,8.6,z,11,2);door(-4,21.1,6,5);
        B(-4,5,23,15,.45,3.5,'#9a8060','metal');posts(-4,23.5,14,.35,5,4);break;
      }
      case 'apartment': {
        B(0,2,0,48,4,31,'#c3c4b5');B(0,20,0,44,32,27,con);
        windows(0,0,44,27,4,31,8,6,P.glass,false);
        for(let s of [-1,1])for(let row=0;row<8;row++)for(let col=0;col<4;col++){
          const x=(col-1.5)*10.5,y=4+row*4,z=s*14.8;
          B(x,y,z,8.7,.28,3.0,'#dad9cd');
          B(x,y+.8,z+s*1.35,8.5,1.25,.13,'#6d9096','glass');
          B(x,y+1.45,z+s*1.35,8.6,.09,.16,'#d2d8d0','metal');
        }
        for(let x of [-22,22])B(x,20,0,.4,32,27,'#e3e1d4');
        roof(0,36.5,0,45,28);hvac(-12,37,-5,.8);hvac(10,37,-5,.8);door(0,15.65,3,3.4);
        B(0,4,16,9,.4,2,P.trim);break;
      }
      case 'brick_apartment': {
        B(0,2,0,38,4,30,'#b8b6a5');B(0,14.5,0,37,21,29,seed%2?P.brick:P.brickDark);
        windows(0,0,37,29,4,20,5,5,P.glass3);
        for(let y of [4,12,20,25])B(0,y,0,38.4,.35,30.3,'#d2c5ab');
        roof(0,25.3,0,39,31,'#747068');door(-9,15.1,3,3.5);door(9,15.1,3,3.5);
        B(0,12,15.4,3,.3,2.0,'#4e605e','metal');B(0,19,15.4,3,.3,2,'#4e605e','metal');
        for(let y=5;y<=22;y+=1.5)B(1.1,y,16.25,2.3,.1,.16,'#344d4e','metal');
        B(2.2,13.5,16.3,.16,20,.16,'#344d4e','metal');hvac(10,25.6,-7,.65);break;
      }
      case 'shop_row': {
        const colors=['#d3c7b2','#ba9982','#b1b8a9','#d8cbb2'];
        for(let i=0;i<4;i++){
          const x=(i-1.5)*16; B(x,6,0,15.5,12,25,colors[(i+seed)%4]);
          windows(x,0,15.5,25,6,5,1,3,P.glass3,false);
          B(x,3,12.6,12,5,.18,'#4c7074','glass',{role:'window'});door(x+4,12.8,2,3);
          B(x,5.5,14,14,.28,3,'#526f6b','metal',{rx:.10});
          B(x,7,12.9,13,.9,.25,'#e4d0a3','wood');
          B(x,12.4,0,16,.5,26,'#d9d4c2','concrete',{role:'roof'});hvac(x,12.7,-6,.5);
          B(x-6.2,2.5,14.5,.12,5,.12,'#676f65','metal');
        }
        for(let x of [-26,26])planter(x,0,13.5,4,2);break;
      }
      case 'market': {
        B(0,.5,0,70,1,50,'#c8bca7');B(0,3,-24,70,6,1,'#a98a69');
        B(-34,3,0,1,6,49,'#a98a69');B(34,3,0,1,6,49,'#a98a69');
        for(let x=-30;x<=30;x+=10){B(x,6.5,-21,.65,13,.65,'#5b716f','metal');B(x,6.5,21,.65,13,.65,'#5b716f','metal');}
        B(0,12.9,-11,71,.6,24,'#9caaa0','metal',{rx:.17,role:'roof'});
        B(0,12.9,11,71,.6,24,'#9caaa0','metal',{rx:-.17,role:'roof'});
        B(0,15,0,63,.35,4.5,'#82aeb0','glass',{role:'roof'});
        for(let x=-30;x<=30;x+=10)B(x,14,0,.25,.25,46,'#e3dfcb','metal',{role:'roof'});
        for(let x=-24;x<=24;x+=12)for(let z of [-15,15]){
          B(x,1.8,z,8,2,5,'#927650','wood');B(x,4.2,z,9,.25,6,((x+24)/12)%2?'#e2c1a0':'#607f77','wood');
          for(let xx of [-3.8,3.8])B(x+xx,2.3,z,.12,4.1,.12,'#505b52','metal');
        }
        B(0,7,24.4,34,2,.4,'#8c7354','wood');break;
      }
      case 'mall': {
        B(0,8,0,70,16,56,'#d0c6b3');B(-19,19,-3,28,6,44,'#b3bbaa');B(19,19,-3,28,6,44,'#b3bbaa');
        B(0,10,28.2,33,12,.22,P.glass,'glass',{role:'window'});
        for(let x=-15;x<=15;x+=5)B(x,10,28.5,.25,12,.35,'#e2dbca','metal');
        stripFacades(0,0,70,56,3,10,2,8,P.glass3,'#d8d4c3');
        B(0,16.4,0,12,.65,45,'#81a9a8','glass',{role:'roof'});
        for(let z=-20;z<=20;z+=5)B(0,17,z,12,.3,.25,'#d1d2bf','metal',{role:'roof'});
        roof(-19,22.4,-3,29,45);roof(19,22.4,-3,29,45);
        for(let x of [-24,24]){hvac(x,22.7,-12,1);planter(x,22.7,10,12,3);}
        B(0,6,29,39,.45,3,P.trim);door(0,28.4,10,5);steps(0,30,35,3,.18,.5);break;
      }
      case 'civic_hall': {
        B(0,1.2,0,64,2.4,46,'#bcb7a3');B(0,10.3,-2,58,16,38,'#d3c9ae');
        windows(0,-2,58,38,5,11,2,8,P.glass3);
        for(let x=-22;x<=22;x+=5.5){C(x,8.5,20.4,1.3,13,1.3,'#e4dfca');B(x,2.5,20.4,1.9,.7,1.9,'#c5baa0');}
        B(0,15.4,20,54,1.3,7,'#e2d9bc');B(0,17.1,20,56,1.6,8,'#cbc1a7');
        roof(0,19,-2,60,40,'#9c9d87');
        C(0,23,-2,19,7,19,'#d4d2bc');C(0,28,-2,20,3,20,'#68958e','metal',{role:'roof'});
        C(0,30.5,-2,10,2,10,'#517b76','metal',{role:'roof'});C(0,32.5,-2,.5,3,.5,'#d3d2b6','metal');
        door(0,17.3,6,7,2.4);steps(0,24,45,6,.3,.4);break;
      }
      case 'hospital': {
        B(0,4,0,62,8,48,'#d9ddd2');B(-15,23,-3,25,30,34,'#d9ddd2');B(15,23,-3,25,30,34,'#d9ddd2');
        B(0,17,-3,8,18,28,'#7b9ca0');stripFacades(-15,-3,25,34,9,28,7,4);stripFacades(15,-3,25,34,9,28,7,4);
        roof(-15,38.4,-3,26,35);roof(15,38.4,-3,26,35);hvac(-15,39,-10);hvac(17,39,-10);
        B(0,8.5,16,19,1,14,'#6b8c8c');B(0,4.2,24.5,17,.4,6,'#8bb1ad','metal');
        for(let x of [-7,7])B(x,2,26,.3,4,.3,'#d6dbcb','metal');door(0,24.1,9,4);
        B(-15,30,14.2,7,2,.3,'#bb594e');B(-15,30,14.3,2,7,.3,'#bb594e');
        B(15,39.1,5,19,.2,19,'#5a7d75');B(15,39.25,5,10,.1,1,'#e5e0ba');
        B(11,39.25,5,1,.1,8,'#e5e0ba');B(19,39.25,5,1,.1,8,'#e5e0ba');break;
      }
      case 'police': {
        B(0,3,0,44,6,34,'#cbd2cb');B(-4,12,-3,34,12,25,'#cbd2cb');
        windows(-4,-3,34,25,7,10,3,5,P.glass3);B(0,5.4,17.2,43,.9,.4,'#355f74');
        roof(-4,18.4,-3,35,26);hvac(-14,19,-8,.6);
        B(0,4.1,18.5,14,.35,3.6,'#537382','metal');door(0,17.2,6,3.5);
        for(let x of [-19,19])B(x,6,19,.15,12,.15,'#d5d6c4','metal');
        B(-17.5,10.7,19,3,1.6,.08,'#4382a2');B(19,10.7,19,2.8,1.6,.08,'#ddded1');
        C(10,19.5,-5,.25,3,.25,'#b8c7bd','metal');break;
      }
      case 'fire_station': {
        B(2,5,0,48,10,34,'#b66f51');B(-18,9,-3,14,18,28,'#c8b7a0');
        for(let x of [-4,10,24]){
          B(x,4,17.1,10,7,.22,'#566b6e','metal');
          for(let y=1;y<7;y+=1.15)B(x,y,17.25,9.6,.08,.08,'#b4bdb1','metal');
          B(x,5.2,17.3,8,1.3,.1,'#73999b','glass');
        }
        windows(-18,-3,14,28,5,12,3,2,P.glass3);roof(3,10.5,-1,48,34);roof(-18,18.5,-3,15,29);
        B(23,15,-11,7,10,8,'#b87556');B(23,21,-11,8,2,9,'#dad1ba');
        for(let y of [13,17])B(23,y,-6.9,3,2,.1,'#3c5555','glass');
        B(2,9.2,17.4,43,.6,.3,'#d2bf91');door(-19,11.15,3,3.5);break;
      }
      case 'school': {
        B(0,7.5,-15,67,15,19,'#d5c6a7');B(-26,7.5,8,15,15,31,'#d5c6a7');B(26,7.5,8,15,15,31,'#d5c6a7');
        windows(0,-15,67,19,2,12,3,10,P.glass3,false);
        windows(-26,8,15,31,2,12,3,2,P.glass3);windows(26,8,15,31,2,12,3,2,P.glass3);
        roof(0,15.4,-15,68,20);roof(-26,15.4,8,16,32);roof(26,15.4,8,16,32);
        B(0,9.5,-14,14,19,20,'#cb9c71');B(0,18,-3.8,7,2,.2,'#ece3c6');
        C(0,15,-3.65,3,.2,3,'#e9e6d1','concrete',{rx:PI/2});
        B(0,15,-3.48,.12,1.3,.08,'#526462');B(.45,15,-3.47,.9,.1,.08,'#526462');
        door(0,-3.7,5,4);B(0,.1,10,31,.2,22,'#8caba0');
        for(let x of [-11,11])planter(x,0,20,7,3);bench(0,21);break;
      }
      case 'station': {
        B(0,1,0,72,2,46,'#b7b6a4');B(0,7,-5,68,12,33,'#c2cbbf');
        B(0,9,11.7,59,12,.2,'#50858c','glass');
        for(let x=-30;x<=30;x+=6)B(x,9,12,.35,13,.4,'#d9ddcd','metal');
        B(0,18,-5,70,.7,35,'#a9bcb6','metal',{role:'roof'});
        B(0,20,-3,62,.6,12,'#7da9a6','glass',{role:'roof'});
        for(let x=-30;x<=30;x+=5)B(x,19.8,-3,.25,.9,12,'#dce0cf','metal',{role:'roof'});
        B(0,7.5,18,73,.4,9,'#687d77','metal');posts(0,20,66,.3,7.5,9);
        for(let x of [-18,0,18]){door(x,12,8,5,1);bench(x,19,0,1);}
        B(0,12.8,13,14,1.7,.3,'#3d5d60');steps(0,23.5,68,4,.3,.5);break;
      }
      case 'museum': {
        B(0,2,0,60,4,46,'#d3cdb9');B(-14,9,-3,30,14,35,'#c4b89c');
        B(14,13,-2,28,22,33,'#e1ddcd','concrete',{ry:.12});
        B(-9,12,13,25,13,.2,'#557b80','glass',{ry:-.12,role:'window'});
        B(10,25,0,30,2,36,'#d1d4c9','concrete',{ry:.12,role:'roof'});
        B(-14,17,-3,32,1,37,'#9aaca7','metal',{role:'roof'});
        for(let i=0;i<6;i++)B(15+i*1.8,13,16,0.45,19,1.7,'#a5b5ae','metal',{ry:.12});
        for(let i=0;i<9;i++)B(-27+i*3.2,10,-20.65,.12,11,.16,'#9d9e8d','metal');
        for(let y of [5.5,10,14.5])B(-28.95,y,-3,.16,.15,33,'#999c8d','metal');
        for(let z of [-13,9])B(25,3,z,.5,4,.5,'#8b9e95','metal');
        B(-9,5.4,13.25,25,.25,.35,'#dddccb','metal',{ry:-.12});
        B(-9,18.4,13.25,25,.25,.35,'#dddccb','metal',{ry:-.12});
        B(-17,7,20,7,10,2.6,'#ad8062','metal',{rz:.18});
        C(-17,12,20,8,1.2,8,'#8fa29b','metal',{rx:.4});
        door(0,23.2,8,4);steps(0,25,14,5,.25,.4);break;
      }
      case 'restaurant': {
        B(-3,3,0,28,6,23,'#a58a65');stripFacades(-3,0,28,23,1,4,1,5,P.glass,'#d9c4a1');
        B(-6,8.5,-2,22,5,19,'#d3c6a9');B(-6,11.4,-2,25,.45,22,'#6d7a6a','metal',{role:'roof'});
        for(let x=-14;x<=14;x+=7)B(x,4.3,13.5,.16,8.6,.16,'#d7ceb2','metal');
        B(0,8.7,13.5,34,.3,4,'#c4ba97','wood',{role:'roof'});
        for(let x of [-12,-4,4,12]){C(x,1.15,12,2.6,.15,2.6,'#d7c9a4','wood');C(x,.6,12,.18,1.2,.18,'#495b55','metal');}
        B(0,.3,12,36,.6,5,'#b49a73','wood');planter(-16,0,12,3,3);planter(16,0,12,3,3);
        door(-2,11.6,3.4,3.4);hvac(-10,11.8,-6,.4);break;
      }
      case 'ferry_terminal': {
        B(0,.8,0,64,1.6,40,'#b8bdb0');B(0,6,0,59,10,32,'#87a9a7');
        stripFacades(0,0,59,32,2,8,2,10,P.glass,'#cedacf');
        B(0,12,-5,65,.65,20,'#d4dfd3','metal',{rx:.19,role:'roof'});
        B(0,12,10,65,.65,14,'#d4dfd3','metal',{rx:-.21,role:'roof'});
        B(21,14,-9,12,6,11,'#f0e8d2');stripFacades(21,-9,12,11,12,4.5,1,3,P.glass);
        B(21,18,-9,14,.5,13,'#6d8b88','metal',{role:'roof'});C(21,19.2,-9,.18,2,.18,'#b9c9bb','metal');
        for(let x of [-22,0,22])door(x,16.2,6,4,1.6);
        for(let x of [-24,-12,12,24])bench(x,17.7,0,1.6);
        B(0,6.8,18,65,.3,4,'#9fb2a9','metal');posts(0,19,60,.25,6.8,9);break;
      }
      case 'warehouse': {
        B(0,6,0,64,12,43,'#929e91');B(0,12.9,-10.5,66,.65,22.6,'#b2b7a4','metal',{rx:.19,role:'roof'});
        B(0,12.9,10.5,66,.65,22.6,'#b2b7a4','metal',{rx:-.19,role:'roof'});
        for(let x=-30;x<=30;x+=6){B(x,6,21.7,.3,12,.3,'#c1c5b1','metal');B(x,6,-21.7,.3,12,.3,'#c1c5b1','metal');}
        for(let x of [-21,0,21]){
          B(x,4.5,21.9,12,8,.2,'#5e6c61','metal');B(x,1.1,23,15,2.2,3,'#777f70');
          for(let y=2;y<=8;y+=1.2)B(x,y,22.05,11.6,.09,.1,'#aeb3a1','metal');
          B(x,9.4,22.6,14,.35,2,'#79867b','metal');
        }
        for(let x of [-21,0,21])B(x,10,-21.7,15,1.5,.12,'#769692','glass');
        for(let z of [-10,4])B(-30,15.3,z,3,.3,9,'#688584','glass',{role:'roof'});
        C(28,14,-15,1.5,4,1.5,'#c4c8b7','metal');break;
      }
    }
    return {...meta,...footprint(K.parts,meta),parts:K.parts,seed,interiorNote:'대표 층 내부 모델 · 실제 게임 이동 및 충돌 연결 전'};
  }

  function buildInterior(id,seed=1) {
    if(root.CityInteriors){const f=root.CityInteriors.buildFloor(id,seed,1);return {...f,parts:f.parts.filter(p=>p.role!=='ceiling'),isRepresentativeFloor:false,interiorNote:'전 층 이동 가능한 1층 실내'};}
    const meta=defs.find(t=>t.id===id);if(!meta)throw new Error('Unknown city building: '+id);
    const K=kit(seed),{B,C,S,door,bench,planter}=K,P=palettes;
    const w=Math.min(meta.width-6,62),d=Math.min(meta.depth-6,44),H=4.5;
    B(0,-.18,0,w,.36,d,'#c9c4b6');
    // The front has a real 4 m opening, with wall fragments on either side.
    B(0,H/2,-d/2,w,H,.35,'#ded9c9');B(-w/2,H/2,0,.35,H,d,'#ded9c9');B(w/2,H/2,0,.35,H,d,'#ded9c9');
    B(-(w+4)/4,H/2,d/2,(w-4)/2,H,.35,'#ded9c9');B((w+4)/4,H/2,d/2,(w-4)/2,H,.35,'#ded9c9');
    B(0,H-.25,d/2,4,.5,.35,'#ded9c9');
    for(let x=-w/2+4;x<w/2-2;x+=6)B(x,2.4,-d/2+.21,3.6,2.1,.12,'#94b9bb','glass',{role:'window'});
    for(let z=-d/2+4;z<d/2-2;z+=6)B(-w/2+.21,2.4,z,.12,2.1,3.6,'#94b9bb','glass',{role:'window'});
    // Small stair/elevator core, open on the circulation side.
    const coreX=w/2-4,coreZ=-d/2+4;
    B(coreX-3,2.1,coreZ,.25,4.2,6,'#b9b8a9');B(coreX,2.1,coreZ-3,6,4.2,.25,'#b9b8a9');
    for(let j=0;j<10;j++)B(coreX, .15*(j+1),coreZ+2.5-j*.5,2.8,.3*(j+1),.5,'#a5aaa2');
    B(coreX-1.6,1.8,coreZ,.12,3.4,5.7,'#7f9c9b','glass');
    function chair(x,z,ry=0){B(x,.55,z,.9,.15,.9,'#667b74','wood',{ry});B(x,.95,z-.4,.9,.8,.15,'#667b74','wood',{ry});B(x,.26,z,.12,.5,.12,'#5d6860','metal');}
    function desk(x,z,ww=3,dd=1.5){B(x,.85,z,ww,.18,dd,'#b29b77','wood');for(let xx of [-ww/2+.2,ww/2-.2])B(x+xx,.4,z,.15,.8,dd-.2,'#6b7c75','metal');}
    function screen(x,z){B(x,1.4,z,.9,.65,.12,'#345359','glass');B(x,1.05,z,.12,.3,.1,'#6d8179','metal');}
    function shelf(x,z,ww=4,dd=.8){for(let y of [.35,1.2,2.05])B(x,y,z,ww,.16,dd,'#a6926f','wood');for(let xx of [-ww/2,ww/2])B(x+xx,1.2,z,.16,2.6,dd,'#6e7c70','metal');}
    function sofa(x,z,ww=4,ry=0){B(x,.6,z,ww,.6,1.5,'#708b7e','wood',{ry});B(x,.85,z-.6,ww,1.05,.25,'#708b7e','wood',{ry});}
    function roomWall(x,z,ww,dd){B(x,2,z,ww,4,dd,'#d7d2c1');}
    function bed(x,z){B(x,.45,z,2.1,.7,3.8,'#b6ae98','wood');B(x,.87,z,2,.25,3.6,'#eee8d6');B(x,1.06,z-1.1,1.6,.18,.65,'#cbd5c7');B(x,1,z-1.9,2.2,1.5,.18,'#a38b66','wood');}
    function counter(x,z,ww=6){B(x,.65,z,ww,1.3,1.7,'#b4a281','wood');B(x,1.36,z,ww+.2,.14,1.9,'#e0dac7');}
    function divider(x,z,ww){roomWall(x,z,ww,.18);B(x,2.6,z+.12,ww-.4,1.8,.1,'#9fb6b1','glass');}
    function simplePlants(){planter(-w/2+2.2,0,d/2-3,2,2);planter(w/2-2.2,0,d/2-3,2,2);}
    simplePlants();
    switch(meta.interiorStyle){
      case 'office':
        for(let x=-w/2+6;x<w/2-8;x+=7)for(let z=-d/2+7;z<d/2-6;z+=6){desk(x,z);screen(x,z-.3);chair(x,z+1.6);}
        divider(0,d/2-7,w-13);desk(-w/4,d/2-3,5,2);chair(-w/4-3,d/2-3,PI/2);chair(-w/4+3,d/2-3,-PI/2);break;
      case 'home':
      case 'hotel': {
        const count=meta.interiorStyle==='hotel'?3:2, span=(w-7)/count;
        for(let i=0;i<count;i++){
          const x=-w/2+span*(i+.5)+1;
          if(i>0)roomWall(x-span/2, -2,.2,d-8);
          bed(x-span*.18,-d/2+6);desk(x+span*.2,0,2.4,1.2);chair(x+span*.2,1.5);
          sofa(x,5,span*.55);B(x,1.6,-1,2.4,1.4,.15,'#3a5353','glass');
          roomWall(x-span*.1,2,span*.5,.2);
          B(x+span*.28,-.0,-d/2+2,span*.35,.12,3.6,'#869e91');
        }
        B(0,.02,d/2-3,w-1,.08,4,'#b6a486');break;
      }
      case 'retail':
        for(let x=-w/2+7;x<w/2-6;x+=8)for(let z=-d/2+7;z<d/2-5;z+=7){shelf(x,z,4,1.5);for(let j=0;j<4;j++)B(x+(j-1.5)*.8,1.6,z,.65,.6,1.1,['#bd8f68','#8aaca1','#d3bd8f','#929d96'][j],'wood');}
        counter(-w/4,d/2-4,8);screen(-w/4,d/2-4);break;
      case 'market':
        for(let x=-w/2+8;x<w/2-7;x+=12)for(let z of [-d/4,d/4]){
          counter(x,z,8);B(x,3.1,z,9,.2,3,'#a99a73','wood');for(let xx of [-4,4])B(x+xx,1.55,z,.1,3.1,.1,'#777d6e','metal');
          for(let i=0;i<5;i++)B(x+(i-2)*1.25,1.6,z,1,.35,.8,['#80966b','#b5a267','#b98765','#6c8f69','#b9aa75'][i],'foliage');
        }break;
      case 'civic':
        counter(0,-d/2+7,w*.6);for(let i=-2;i<=2;i++){screen(i*4,-d/2+7);chair(i*4,-d/2+5);}
        for(let z of [0,5,10])for(let x of [-w/4,w/4])bench(x,z);break;
      case 'medical':
        for(let x=-w/2+5;x<w/2-7;x+=8){bed(x,-d/2+6);roomWall(x+3.5,-d/2+6,.12,7);B(x+2,1.3,-d/2+5,1.1,1.2,.9,'#8ca8a0');screen(x+2,-d/2+5);}
        counter(-w/4,2,7);screen(-w/4,2);for(let x=-w/2+5;x<w/2-4;x+=6)bench(x,d/2-5);break;
      case 'police':
        counter(0,d/2-5,w*.65);for(let x of [-w/4,0,w/4]){desk(x,-2);screen(x,-2);chair(x,-.4);}
        roomWall(-w/2+6,-d/2+5,11,.2);for(let x=-w/2+1;x<-w/2+11;x+=.7)B(x,2,-d/2+5,.08,4,.08,'#6e8079','metal');break;
      case 'fire':
        for(let x=-w/2+4;x<w/2-7;x+=3){B(x,1.1,-d/2+2,2.2,2.2,1.2,'#a97859','metal');B(x,1.3,-d/2+2.65,.12,.45,.08,'#dfd9b6','metal');}
        for(let x of [-w/4,w/4]){B(x,.02,2,9,.04,14,'#b3b799');for(let xx of [-4.5,4.5])B(x+xx,.05,2,.12,.05,14,'#d6c27c');}
        C(-w/2+3,2.25,0,.2,4.5,.2,'#b1a478','metal');shelf(0,-d/2+4,6,1.2);break;
      case 'school':
        for(let x=-w/2+6;x<w/2-6;x+=6)for(let z=-d/2+11;z<d/2-4;z+=5){desk(x,z,2.3,1.2);chair(x,z+1.5);}
        B(0,2.5,-d/2+.3,w*.7,2,.18,'#41675d');desk(0,-d/2+5,4,1.8);break;
      case 'station':
      case 'terminal':
        counter(-w/4,-d/2+5,w*.32);for(let x=-w/2+5;x<0;x+=4)B(x,2.5,-d/2+5,.12,2.4,.15,'#d5d8c3','metal');
        for(let z of [-2,5,12])for(let x of [-w/4,w/4])bench(x,z);
        B(w/4,3.6,-d/2+1,8,1.5,.2,'#385b5b','glass');
        for(let x=-3;x<=3;x+=3){B(x,1.1,d/2-4,.5,2.2,2.6,'#9baaa1','metal');B(x+.7,1.1,d/2-4,1,1,.1,'#a9c3bc','glass');}break;
      case 'museum':
        for(let x of [-w/4,w/4])for(let z of [-d/4,d/4]){
          B(x,.6,z,3.8,1.2,3.8,'#dedbc8');C(x,2.1,z,1.7,2.0,1.7,'#a28569','metal',{rz:.22});S(x+.3,3,z,1.7,1.1,1.4,'#889e93','metal');
        }
        for(let x=-w/2+6;x<w/2-5;x+=9){B(x,2.4,-d/2+.25,5,2.6,.18,'#927d63','wood');B(x,2.4,-d/2+.4,4.6,2.2,.08,['#839d8b','#b4a17e','#738e94'][Math.abs(Math.round(x))%3]);}break;
      case 'restaurant':
        counter(0,-d/2+3,w-6);for(let x=-w/2+5;x<w/2-3;x+=6)for(let z=0;z<d/2-2;z+=6){C(x,.9,z,2.7,.17,2.7,'#c0aa82','wood');C(x,.4,z,.18,.8,.18,'#61736a','metal');chair(x-2,z,PI/2);chair(x+2,z,-PI/2);}break;
      case 'warehouse':
        for(let x=-w/2+7;x<w/2-6;x+=10)for(let z=-d/2+8;z<d/2-4;z+=9){
          shelf(x,z,6,3.5);for(let yy of [.7,1.6,2.5])for(let xx of [-1.6,1.6])B(x+xx,yy,z,2.6,.7,2.8,'#b19a71','wood');
        }break;
    }
    return {...meta,parts:K.parts,width:w,depth:d,height:H,floors:meta.floors,seed,isRepresentativeFloor:true,interiorNote:'대표 층 내부 · 지붕 없는 관찰 모델'};
  }
  root.CityBuildings={types:defs.map(t=>{const b=build(t.id,1);return {...t,width:b.width,depth:b.depth,height:b.height};}),build,buildInterior,version:'2.0.0'};
})(typeof window!=='undefined'?window:globalThis);


/* interiors.js */
/* WESTPORT 2 — authored, deterministic floor-by-floor architecture.
 * Metres, Y up; floors are 1-based. Interior geometry uses floor-local y=0.
 * This is a fictional game environment, including the FBI-themed headquarters.
 * No textures, fonts, network requests or external runtime dependencies. */
(function(root){
'use strict';
const C={wall:'#d7d7cd',edge:'#aebbb7',floor:'#b7beb4',dark:'#334b53',glass:'#669ca8',wood:'#a78e69',metal:'#697d7c',gold:'#d5bb7e',light:'#f0e9c9'};
const SPEC={
 skyline:{w:50,d:44,h:3.65,n:38,color:'#a3b7b5',family:'office'},
 stepped_office:{w:46,d:36,h:3.8,n:25,color:'#b7bfb7',family:'office'},
 round_office:{w:44,d:44,h:3.8,n:20,color:'#a8beb8',family:'office'},
 hotel:{w:56,d:42,h:4,n:13,color:'#d9ceb6',family:'hotel'},
 apartment:{w:48,d:31,h:3.65,n:10,color:'#d4d4c5',family:'home'},
 brick_apartment:{w:38,d:30,h:3.6,n:7,color:'#aa7c63',family:'home'},
 shop_row:{w:64,d:26,h:4,n:3,color:'#cab79d',family:'retail'},
 market:{w:70,d:50,h:6,n:2,color:'#b7a58c',family:'market'},
 mall:{w:70,d:56,h:4.4,n:5,color:'#d0c9b8',family:'retail'},
 civic_hall:{w:64,d:46,h:6.2,n:4,color:'#d4d2c3',family:'civic'},
 hospital:{w:62,d:48,h:3.9,n:10,color:'#cadbd4',family:'medical'},
 police:{w:44,d:34,h:3.8,n:5,color:'#aebfc2',family:'police'},
 fire_station:{w:52,d:36,h:5.4,n:3,color:'#bd9481',family:'fire'},
 school:{w:68,d:52,h:4.4,n:4,color:'#d5c4a2',family:'school'},
 station:{w:72,d:46,h:5.8,n:3,color:'#b7c6bb',family:'station'},
 museum:{w:60,d:46,h:7.6,n:3,color:'#ddd9c9',family:'museum'},
 restaurant:{w:36,d:28,h:4.8,n:2,color:'#c7b292',family:'restaurant'},
 ferry_terminal:{w:64,d:40,h:5.4,n:3,color:'#b7c7c4',family:'terminal'},
 warehouse:{w:64,d:44,h:6.8,n:2,color:'#a9b6a8',family:'warehouse'},
 fbi_hq:{w:72,d:46,h:4.2,n:12,color:'#b8c3bf',family:'fbi'}
};
function spec(id){if(!SPEC[id])throw Error('Unknown interior type '+id);return SPEC[id];}
function profile(id,floor=1){const s=spec(id);floor=Math.max(1,Math.min(s.n,Math.trunc(floor)));let w=s.w,d=s.d;
 if(id==='skyline'){if(floor>28){w=floor>36?22:27;d=floor>36?22:25;}else if(floor>2){w=35;d=31;}}
 if(id==='stepped_office'){const t=Math.min(3,Math.floor((floor-1)/7));w=46-t*7.5;d=36-t*5;}
 if(id==='round_office'&&floor>2){w=32;d=32;}
 if(id==='hotel'&&floor>2){w=floor>11?29:43;d=floor>11?24:32;}
 if(id==='apartment'&&floor>1){w=44;d=27;}
 if(id==='hospital'&&floor>2){w=52;d=40;}
 if(id==='fbi_hq'&&floor>2){w=floor>10?54:64;d=floor>10?38:42;}
 return {width:w,depth:d,baseY:(floor-1)*s.h,storyH:s.h,floor,floors:s.n};
}
const P=(name,...rooms)=>({name,program:rooms});
const fixed={
 fbi_hq:[
  P('방문자 로비 · 안내','방문 안내|lobby','민원 상담|office','방문 대기|waiting','공공 전시|art','시설 관리|security','직원 카페|dining'),
  P('대외 협력 · 민원','민원 접수|office','협력 사무실|office','상담실|conference','자료 열람|library','대외 브리핑|briefing','직원 휴게|lounge'),
  P('증거물 관리','인수 기록실|office','분류 작업실|lab','물품 보관|archive','기록 보관|archive','지원 사무실|office','검수 대기|waiting'),
  P('기록 · 자료실','문서 자료실|archive','디지털 열람|library','기록 정리|office','보존 자료실|archive','팀 회의실|conference','휴게실|lounge'),
  P('분석 사무층','분석 사무실|office','정보 시각화|command','사건 검토|conference','공동 업무|office','자료 조사|library','휴게실|lounge'),
  P('현장 업무 지원','업무 사무실|office','팀 브리핑|briefing','장비 보관|storage','지원 사무실|office','회의실|conference','직원 휴게|lounge'),
  P('교육 · 브리핑','대강의실|classroom','소규모 강의|classroom','브리핑실|briefing','연수 자료실|library','강사 사무실|office','휴게 라운지|lounge'),
  P('감식 연구층','시료 작업실|lab','관찰 실험실|lab','분석 사무실|office','기록실|archive','회의실|conference','직원 휴게|lounge'),
  P('디지털 연구 · 교육','컴퓨터 실습|server','연구 사무실|office','협업 스튜디오|office','디지털 자료실|library','교육실|classroom','휴게실|lounge'),
  P('기관 협업층','통합 상황실|command','공동 브리핑|briefing','기관 협력|office','지원 회의실|conference','자료 분석|office','휴게실|lounge'),
  P('본부 운영층','본부장 집무실|executive','운영 사무실|office','운영 회의실|conference','행정 기록실|archive','수행 업무실|office','응접 라운지|lounge'),
  P('전망 · 지휘 지원','도시 상황실|command','전망 라운지|lounge','합동 회의실|conference','지원 사무실|office','직원 식당|dining','휴게실|lounge')
 ],
 police:[P('민원 · 안내','접수 데스크|lobby','민원 상담|office','대기실|waiting','직원 사무실|office'),P('도시 순찰 업무','순찰 사무실|office','상황실|command','브리핑실|briefing','물품 보관|storage'),P('조사 · 기록','조사 사무실|office','상담실|conference','기록실|archive','자료실|library'),P('교육 · 지원','교육실|classroom','팀 회의실|conference','지원 사무실|office','휴게실|lounge'),P('운영 · 복지','운영 사무실|executive','회의실|conference','직원 식당|dining','휴게 라운지|lounge')],
 fire_station:[P('차고 · 출동 지원','차고 A|garage','차고 B|garage','장비 보관|storage','출동 대기|dispatch'),P('상황 · 교육','상황실|command','교육실|classroom','훈련 사무실|office','물품 정비|lab'),P('생활 · 휴게','휴게실|lounge','생활실|bedroom','공동 식당|dining','체력단련실|gym')],
 school:[P('행정 · 공동 시설','교무실|office','행정실|office','보건실|medical','도서관|library','음악실|art','급식실|dining'),P('일반 교실','교실 201|classroom','교실 202|classroom','교실 203|classroom','교실 204|classroom','학습실|library','교사 연구실|office'),P('과학 · 예술','과학실|lab','컴퓨터실|server','미술실|art','기술 실습|lab','교실 305|classroom','상담실|conference'),P('체육 · 자율 학습','실내 체육|gym','자율학습실|library','동아리실|lounge','다목적실|briefing','프로젝트실|office','교사 휴게실|lounge')],
 civic_hall:[P('시민 민원층','시민 안내|lobby','민원 창구|office','상담실|conference','자료 열람|library','시민 대기|waiting','생활 전시|art'),P('행정 업무층','행정 사무실|office','도시 계획|office','주민 협력|conference','자료 보관|archive','공용 회의실|conference','직원 휴게|lounge'),P('의회 · 공청회','회의장|briefing','공청회실|briefing','의정 사무실|office','시민 협력|conference','기록실|archive','대기 라운지|lounge'),P('행사 · 전망','시민 행사실|dining','도시 전시실|art','다목적 회의|conference','전망 라운지|lounge','운영실|office','자료실|library')],
 market:[P('신선식품 시장','청과 구역|market','수산 구역|market','식료품 구역|market','제과 구역|market','꽃 시장|market','시장 사무실|office'),P('식당가 · 공방','공동 식당|dining','카페|dining','지역 공방|art','생활 상점|shop','상인 회의실|conference','고객 휴게실|lounge')],
 mall:[P('안내 · 생활 상점','안내 라운지|lobby','식료품점|shop','생활용품|shop','플라워숍|market','서비스 센터|office','카페|dining'),P('패션 · 잡화','의류 매장 A|shop','의류 매장 B|shop','잡화점|shop','신발 매장|shop','피팅 라운지|lounge','매장 사무실|office'),P('전자 · 도서','전자기기|server','서점|library','취미 상점|shop','게임 라운지|lounge','가구 전시|apartment','고객 상담|office'),P('문화 · 체험','문화 전시|art','공방|lab','체험 강의|classroom','이벤트홀|briefing','휴게 라운지|lounge','운영실|office'),P('식당가 · 전망','푸드코트|dining','레스토랑|dining','카페|dining','전망 라운지|lounge','주방|kitchen','직원 휴게|lounge')],
 station:[P('대합실 · 발권','안내소|lobby','발권 창구|office','대합실 A|waiting','대합실 B|waiting','편의점|shop','교통 전시|art'),P('환승 · 여행 시설','환승 대기|waiting','여행 안내|office','카페|dining','여행 상점|shop','수하물 보관|cargo','운영실|command'),P('관제 · 직원 시설','관제실|command','운영 사무실|office','교육실|classroom','직원 식당|dining','기록실|archive','휴게실|lounge')],
 ferry_terminal:[P('발권 · 승선 안내','발권 창구|lobby','승선 대기 A|waiting','승선 대기 B|waiting','수하물 보관|cargo','여행 상점|shop','관광 안내|office'),P('여행 라운지','여객 라운지|lounge','선박 전시|art','카페|dining','해양 서점|library','여행 상담|office','직원 대기|waiting'),P('항만 운영','항만 상황실|command','운영 사무실|office','선원 휴게실|lounge','회의실|conference','자료실|archive','직원 식당|dining')],
 museum:[P('안내 · 상설 전시','전시 안내|lobby','해양 전시|art','조각 전시|art','기념품점|shop','뮤지엄 카페|dining','운영실|office'),P('기획 전시 · 교육','기획 전시 A|art','기획 전시 B|art','어린이 전시|art','교육 공방|lab','강의실|classroom','작가 라운지|lounge'),P('보존 · 연구','소장품 보관|archive','보존 작업|lab','연구실|office','미술 자료실|library','큐레이터 회의|conference','전망 휴게|lounge')],
 restaurant:[P('메인 다이닝','메인 홀|dining','예약 다이닝|dining','주방|kitchen','식료품 보관|storage'),P('바 · 프라이빗 다이닝','해안 라운지|lounge','프라이빗 다이닝|dining','이벤트 다이닝|dining','직원 휴게실|lounge')],
 warehouse:[P('입출고 · 물류','입고 구역|cargo','출고 구역|cargo','분류 작업|storage','포장 구역|lab','현장 사무실|office','직원 대기|waiting'),P('보관 · 관리','제품 보관 A|storage','제품 보관 B|storage','장기 보관|archive','물류 관리|office','교육실|classroom','직원 휴게실|lounge')],
 shop_row:[P('거리 상점','제과점|market','생활 상점|shop','해안 카페|dining','서점|library'),P('공방 · 사무실','디자인 공방|art','수선 공방|lab','소규모 사무실|office','상인 회의실|conference'),P('주거 · 스튜디오','주거 스튜디오 A|apartment','주거 스튜디오 B|apartment','작업실|office','공용 라운지|lounge')]
};
function program(id,seed,floor){const s=spec(id);if(fixed[id])return fixed[id][floor-1];
 if(s.family==='office'){
  if(floor===1)return P('로비 · 방문 안내','입주사 안내|lobby','방문 라운지|waiting','카페|dining','시설 사무실|office','비즈니스 서점|library','접견실|conference');
  if(floor===2)return P('컨퍼런스 센터','대회의실|conference','교육실|classroom','브리핑실|briefing','협업 공간|office','작은 회의실|conference','커피 라운지|lounge');
  if(floor===s.n)return P('최상층 · 전망','대표 집무실|executive','도시 전망|lounge','이사회실|conference','임원 사무실|office','응접실|lounge','작은 도서관|library');
  const kinds=[P('금융 · 상담','재무 사무실|office','고객 상담|conference','자료 분석|office','기록 보관|archive','회의실|conference','직원 휴게|lounge'),P('개발 · 연구','개발 스튜디오|office','시제품 작업|lab','서버 작업실|server','협업실|office','프로젝트 회의|conference','휴게실|lounge'),P('디자인 · 제작','디자인 사무실|office','모형 제작|art','공동 작업|office','자료 도서실|library','회의실|conference','휴게실|lounge'),P('일반 사무','공용 사무실 A|office','공용 사무실 B|office','관리 사무실|office','문서 보관|archive','회의실|conference','직원 식당|dining')];
  const p=kinds[(floor+seed)%kinds.length];return {...p,name:p.name+' · '+floor+'층'};
 }
 if(s.family==='home'){
  if(floor===1)return P('입주 로비 · 생활 시설','입주 라운지|lobby','관리 사무실|office','주민 도서관|library','공동 작업실|office','생활 체육|gym','택배 보관|storage');
  if(floor===s.n)return P('펜트하우스','펜트하우스 거실|apartment','펜트하우스 침실|bedroom','다이닝|dining','서재|library','게스트룸|bedroom','휴게 라운지|lounge');
  return P('주거 '+floor+'층',floor+'01호|apartment',floor+'02호|apartment',floor+'03호|apartment',floor+'04호|apartment',floor+'05호|apartment',floor+'06호|apartment');
 }
 if(s.family==='hotel'){
  if(floor===1)return P('호텔 로비','컨시어지|lobby','체크인 라운지|waiting','로비 카페|dining','호텔 사무실|office','수하물 보관|storage','컨퍼런스 접수|office');
  if(floor===2)return P('레스토랑 · 연회','메인 레스토랑|dining','연회장|dining','주방|kitchen','프라이빗 다이닝|dining','행사 회의실|conference','직원 휴게실|lounge');
  if(floor===3)return P('웰니스 · 비즈니스','체력단련실|gym','웰니스 라운지|lounge','비즈니스 센터|office','미팅룸|conference','독서 라운지|library','관리실|office');
  if(floor===12)return P('스카이 라운지','해안 라운지|lounge','스카이 바|dining','프라이빗 다이닝|dining','VIP 미팅룸|conference');
  if(floor===13)return P('스위트 객실','오션 스위트|apartment','마리나 스위트|apartment','게스트 침실|bedroom','전망 라운지|lounge');
  return P('객실 '+floor+'층',floor+'01 객실|bedroom',floor+'02 객실|bedroom',floor+'03 객실|bedroom',floor+'04 객실|bedroom',floor+'05 객실|bedroom','객실 관리|storage');
 }
 if(s.family==='medical'){
  const p=[P('접수 · 외래','종합 접수|lobby','외래 대기|waiting','진료실 A|medical','진료실 B|medical','약제 업무|lab','병원 안내|office'),P('검사 · 진단','검사실 A|lab','검사실 B|lab','검사 대기|waiting','상담실|conference','진단 사무실|office','기록실|archive'),P('치료 · 회복','처치실|medical','회복실 A|medical','회복실 B|medical','스태프 스테이션|office','대기실|waiting','물품 보관|storage')];
  if(floor<=3)return p[floor-1];
  if(floor===9)return P('재활 · 교육','재활 운동실|gym','재활 상담|medical','교육실|classroom','직원 연구실|office','자료실|library','휴게실|lounge');
  if(floor===10)return P('병원 운영 · 휴게','운영 사무실|office','의료진 회의|conference','직원 식당|dining','교육실|classroom','병원 자료실|library','옥상 휴게실|lounge');
  return P('입원 병동 '+floor+'층',floor+'01 병실|medical',floor+'02 병실|medical',floor+'03 병실|medical',floor+'04 병실|medical','간호 업무|office','환자 라운지|lounge');
 }
 return P('일반 층','업무실|office','회의실|conference','자료실|library','휴게실|lounge');
}
function roomPlan(id,seed,floor){const q=profile(id,floor),p=program(id,seed,floor),hall=4.8,front=6.2,back=-q.depth/2+.5,end=q.depth/2-front;
 const rows=Math.max(2,Math.min(4,Math.round((q.depth-front)/12))),span=(end-back)/rows,wing=(q.width-hall)/2;
 const rooms=[];for(let row=0;row<rows;row++)for(let side=0;side<2;side++){
  const index=row*2+side,token=p.program[(index+(floor>1?(seed%2):0))%p.program.length].split('|'),sign=side?1:-1;
  rooms.push({id:floor+'-'+(index+1),name:token[0],kind:token[1],x:sign*(hall/2+wing/2),z:back+(row+.5)*span,w:wing-.55,d:span-.45,door:{x:sign*hall/2,z:back+(row+.5)*span,width:2.3},row,side});
 }
 return {rooms,rows,hall,front,back,end,span,wing,program:p};
}
function kit(){const parts=[],colliders=[],windows=[],officeSeats=[];
 function add(shape,x,y,z,sx,sy,sz,color,material='concrete',extra){const p={shape,x,y,z,sx,sy,sz,color,material,...extra};parts.push(p);return p;}
 function box(x,y,z,sx,sy,sz,color=C.wall,role='detail',kind){const p=add('box',x,y,z,sx,sy,sz,color,'concrete',{role});if(kind)solid(x,y,z,sx,sy,sz,kind);return p;}
 function solid(x,y,z,sx,sy,sz,kind='wall'){colliders.push({min:[x-sx/2,y-sy/2,z-sz/2],max:[x+sx/2,y+sy/2,z+sz/2],kind});}
 return {parts,colliders,windows,officeSeats,add,box,solid};
}
function boundary(K,id,floor,includeSlab=true){const q=profile(id,floor),s=spec(id),w=q.width,d=q.depth,H=q.storyH,{box,add,windows}=K;
 if(includeSlab)box(0,-.16,0,w,.32,d,C.floor,'floor');
 const sill=1.04,top=Math.min(3.18,H-.46),gh=top-sill;
 for(const side of ['north','south','west','east']){
  const horizontal=side==='north'||side==='south',L=horizontal?w:d,sign=(side==='north'||side==='west')?-1:1;
  const segments=side==='south'&&floor===1?[[-L/2,-1.9],[1.9,L/2]]:[[-L/2,L/2]];let pane=0;
  const wall=(center,y,length,h)=>horizontal?box(center,y,sign*d/2,length,h,.32,s.color,'wall','wall'):box(sign*w/2,y,center,.32,h,length,s.color,'wall','wall');
  for(const [a,b] of segments){
   const n=Math.ceil((b-a)/6.6),step=(b-a)/n;
   wall((a+b)/2,sill/2,b-a,sill);wall((a+b)/2,(top+H)/2,b-a,H-top);
   for(let k=0;k<=n;k++)wall(a+k*step,(sill+top)/2,.26,gh);
   for(let k=0;k<n;k++){
    const c=a+(k+.5)*step,win={id:floor+':'+side+':'+pane++,floor,side,x:horizontal?c:sign*w/2,y:(sill+top)/2,z:horizontal?sign*d/2:c,sx:horizontal?step-.29:.075,sy:gh-.06,sz:horizontal?.075:step-.29};
    windows.push(win);add('box',win.x,win.y,win.z,win.sx,win.sy,win.sz,C.glass,'glass',{role:'breakable-window',windowId:win.id,floor,opacity:.32});
   }
  }
  if(side==='south'&&floor===1){wall(0,(3.1+H)/2,3.8,H-3.1);for(const x of [-1.98,1.98])box(x,1.55,d/2,.14,3.1,.44,C.dark,'door-frame');}
 }
 return q;
}
function floorTitle(id,seed,floor){return program(id,seed,floor).name;}
function furnish(K,r,seed,H){const {box,add,solid}=K;const x=r.x,z=r.z,ww=r.w,dd=r.d;let accent=['#718f8d','#87977f','#a98c73','#7e91a2'][(seed+r.row+r.side)%4];
 const F=(xx,yy,zz,sx,sy,sz,c=C.wood,m='wood',collision=false)=>{const p=add('box',xx,yy,zz,sx,sy,sz,c,m,{role:'furniture',roomId:r.id});if(collision)solid(xx,yy,zz,sx,sy,sz,'furniture');return p;};
 const cyl=(xx,yy,zz,sx,sy,sz,c=C.metal)=>add('cylinder',xx,yy,zz,sx,sy,sz,c,'metal',{role:'furniture',roomId:r.id});
 const chair=(xx,zz,back=-1)=>{F(xx,.48,zz,.68,.14,.68,accent);F(xx,.84,zz+back*.29,.68,.7,.1,accent);F(xx,.23,zz,.13,.46,.13,C.metal,'metal');};
 const desk=(xx,zz,width=2.5,depth=1.25,screen=true)=>{F(xx,.79,zz,width,.14,depth,C.wood,'wood',true);for(const a of [-1,1])F(xx+a*(width/2-.13),.37,zz,.12,.74,depth-.12,C.metal,'metal');if(screen){F(xx,1.27,zz-.23,.87,.58,.09,'#345761','glass');F(xx,1,zz-.23,.09,.24,.1,C.metal,'metal');F(xx,.9,zz+.23,.65,.04,.22,'#5a6e6e');}chair(xx,zz+1.1,1);
 if(['office','executive','command','dispatch','server','security'].includes(r.kind))K.officeSeats.push({id:r.id+'-desk-'+K.officeSeats.length,roomId:r.id,roomKind:r.kind,x:xx,z:zz+1.1,heading:Math.PI,seatHeight:.55,deskHeight:.86,desk:{x:xx,z:zz},stands:[{x:xx-.95,z:zz+1.1},{x:xx+.95,z:zz+1.1},{x:xx,z:zz+2.05}]});
 };
 const shelf=(xx,zz,width=3,deep=.7,files=false)=>{F(xx,1.27,zz,width,2.54,deep,'#8d9e95','wood',true);for(let i=0;i<3;i++){F(xx,.5+i*.75,zz+deep*.51,width-.2,.56,.08,'#b9b8a3');for(let j=0;j<5;j++)F(xx+(j-2)*width*.16,.5+i*.75,zz+deep*.56,width*.1,.51,.14,files?['#bfb29a','#8da3a0','#a7a58c'][j%3]:['#9d7e60','#6b8980','#c0ac7c'][j%3]);}};
 const sofa=(xx,zz,width=3.4)=>{F(xx,.47,zz,width,.68,1.16,accent,'wood',true);F(xx,.89,zz-.48,width,.88,.2,accent);for(let a of [-1,1])F(xx+a*(width/2-.1),.75,zz,.2,.7,1.15,accent);};
 const bed=(xx,zz,medical=false)=>{F(xx,.38,zz,medical?1.35:1.95,.65,3.1,medical?'#94aaa4':'#9a8c75','wood',true);F(xx,.79,zz,medical?1.27:1.86,.2,2.97,'#e7e4d6');F(xx,.94,zz-.9,medical?1.0:1.5,.16,.6,'#c4d0c8');F(xx,.95,zz-1.56,medical?1.4:2.02,1.2,.16,C.wood);if(medical){F(xx+1.25,1.2,zz-1.1,.65,1.25,.55,'#96aaa3');F(xx+1.25,1.88,zz-1.16,.6,.44,.1,'#3c6571','glass');}else F(xx+1.45,.44,zz-1.0,.6,.85,.65,'#b4a27f');};
 const table=(xx,zz,width=3,depth=1.5)=>{F(xx,.78,zz,width,.16,depth,'#bca585','wood',true);for(const a of [-1,1])F(xx+a*(width*.35),.36,zz,.12,.72,depth*.7,C.metal,'metal');};
 const wallBoard=(label=false)=>{F(x,2.05,z-dd/2+.14,Math.min(ww-1.6,5.2),1.4,.12,label?'#496e72':'#4a655d','glass');};
 const plant=(xx,zz)=>{cyl(xx,.36,zz,.7,.72,.7,'#b2b49b');add('sphere',xx,1.13,zz,.9,1.2,.9,'#6a9272','foliage',{role:'furniture',roomId:r.id});};
 // Furniture stays inside each room; a clear strip at the hall-side door
 // connects the doorway to a transverse aisle through the room centre.
 const outer=x+(r.side?1:-1)*Math.max(0,ww/2-2.8),back=z-dd/2+2.2,front=z+dd/2-2.0;
 switch(r.kind){
 case 'lobby':F(outer,.65,z,Math.min(4.4,ww-2.5),1.3,1.4,'#a39273','wood',true);F(outer,1.37,z,Math.min(4.5,ww-2.4),.14,1.55,'#d9d6bd');sofa(x,front,Math.min(3.2,ww-3));wallBoard(true);break;
 case 'office':case 'executive':{
  const cols=Math.max(1,Math.min(3,Math.floor((ww-2.6)/4.4))),rows=dd>10?2:1;
  for(let i=0;i<cols;i++)for(let j=0;j<rows;j++)desk(x+(i-(cols-1)/2)*4.1,z+(j-(rows-1)/2)*4.6-1.2,r.kind==='executive'?3.4:2.5);
  shelf(x,front,Math.min(3.2,ww-3),.7,true);if(r.kind==='executive')sofa(outer,front,2.8);break;}
 case 'conference':case 'briefing':table(x,z,Math.min(5,ww-3),Math.min(2.3,dd-4));for(let a of [-1,1])for(let i=-1;i<=1;i++)chair(x+i*1.2,z+a*1.9,a<0?1:-1);wallBoard(true);break;
 case 'command':case 'dispatch':wallBoard(true);for(let i=-1;i<=1;i++){const xx=x+i*Math.min(2.8,(ww-3)/3);desk(xx,z-1.2,2.3);F(xx,1.55,z-dd/2+.24,2.15,1.05,.1,['#3e6d7a','#527b7d','#687f6b'][i+1],'glass');}shelf(x,front,Math.min(3.8,ww-3),.65,true);break;
 case 'server':for(let a of [-1,1]){F(x+a*Math.min(2,ww*.23),1.3,back,1.25,2.6,1.1,'#41565c','metal',true);for(let k=0;k<6;k++){F(x+a*Math.min(2,ww*.23),.3+k*.37,back+.57,1.06,.23,.05,'#81968d');F(x+a*Math.min(2,ww*.23)+.4,.3+k*.37,back+.62,.05,.05,.04,'#b9d99d','lit');}}desk(x,front-.8,Math.min(3.5,ww-3));break;
 case 'archive':case 'library':case 'storage':case 'cargo':{
  const nx=Math.max(1,Math.min(3,Math.floor((ww-2)/4.7))),nz=dd>10?2:1;
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const xx=x+(i-(nx-1)/2)*4.3,zz=z+(j-(nz-1)/2)*4.2-1;shelf(xx,zz,Math.min(3.3,ww-3),r.kind==='cargo'?1.8:.75,r.kind==='archive');if(r.kind==='cargo')F(xx,.3,zz,3.5,.2,2,'#8a7f61');}
  if(r.kind==='library')table(x,front,Math.min(3.4,ww-3),1.2);break;}
 case 'waiting':case 'lounge':sofa(x,back,Math.min(4.3,ww-3));sofa(x,front,Math.min(3.4,ww-3));table(x,z,2.1,.9);plant(outer,z);if(r.kind==='lounge')shelf(outer,front,1.7,.5);break;
 case 'bedroom':bed(x,back+1);desk(x,front-.5,2.2,1,false);F(outer,1.3,z,1.1,2.6,2.2,'#a1967a','wood',true);break;
 case 'apartment':bed(x,back+1);sofa(x,front,Math.min(3.2,ww-3));table(outer,z,1.9,1.1);F(outer,1,z-dd*.17,1.0,2.0,.85,'#d6d7c7','metal',true);break;
 case 'medical':bed(x,back+1,true);if(ww>13)bed(x+3.6,back+1,true);F(outer,.8,front,2.3,1.6,.7,'#d4dfd1','metal',true);desk(x,front-1,2.1,1,false);break;
 case 'lab':table(x,z,Math.min(4.8,ww-3),1.6);for(let i=-1;i<=1;i++){F(x+i*1.1,1.13,z,.55,.5,.65,'#b8c9be','metal');cyl(x+i*1.1,1.54,z,.15,.4,.15,'#e5dac1');}shelf(x,back,Math.min(4.5,ww-3),.8,true);F(outer,.72,front,1.4,1.4,.8,'#c4d1c9','metal',true);break;
 case 'classroom':wallBoard();for(let i=-1;i<=1;i++)for(let j=0;j<(dd>10?3:2);j++){const xx=x+i*Math.min(2.5,(ww-2.4)/3);desk(xx,z-1.8+j*2.4,1.65,.85,false);}break;
 case 'dining':case 'kitchen':{
  if(r.kind==='kitchen'){F(x,.85,back,Math.min(ww-2.8,7),1.7,1.25,'#b9c5bf','metal',true);for(let i=-1;i<=1;i++)cyl(x+i*1.1,1.75,back,.7,.12,.7,'#495c5a');F(outer,1.2,front,1.4,2.4,1.1,'#d1d8cb','metal',true);table(x,z,Math.min(4.5,ww-3),1.5);}
  else for(let i=0;i<(ww>13?2:1);i++)for(let j=0;j<(dd>10?2:1);j++){const xx=x+(i-(ww>13?.5:0))*4.8,zz=z+(j-(dd>10?.5:0))*4.5;table(xx,zz,2.0,1.35);chair(xx,zz-1.1,1);chair(xx,zz+1.1,-1);}
  break;}
 case 'market':case 'shop':for(let i=0;i<(dd>10?2:1);i++){const zz=z+(i-(dd>10?.5:0))*4.2;F(x,.65,zz,Math.min(5,ww-3),1.3,1.5,'#9f8c6b','wood',true);for(let j=-2;j<=2;j++)F(x+j*.8,1.5,zz,.65,.38,.8,['#a99661','#789775','#b88761','#8ba391','#c4ae7a'][j+2]);}shelf(x,back,Math.min(4.4,ww-3),.65);break;
 case 'art':for(const a of [-1,1]){F(x+a*Math.min(2,ww*.2),.6,z,1.9,1.2,1.9,'#d7d5c4','concrete',true);add(a<0?'sphere':'cone',x+a*Math.min(2,ww*.2),1.92,z,1.5,1.5,1.5,a<0?'#8a9d8f':'#ba9b73','metal',{role:'furniture',roomId:r.id});}wallBoard(true);break;
 case 'gym':for(let i=-1;i<=1;i++){const xx=x+i*Math.min(2.7,(ww-3)/3);F(xx,.25,z,1.4,.5,2.7,'#5d7473','metal',true);F(xx,.52,z,1.22,.08,2.3,'#3a4e51');F(xx,1.05,z-1,.12,1.0,.12,'#a7b8ac','metal');F(xx,1.55,z-1,1.2,.12,.12,'#a7b8ac','metal');}F(x,.06,front,Math.min(5,ww-3),.1,1.8,'#8aa099');break;
 case 'garage':F(x,.8,z,Math.min(3.1,ww-3),1.6,Math.min(5.5,dd-3),'#a9664f','metal',true);F(x,1.9,z-1,2.6,.9,2.5,'#a9664f','metal');F(x,2.05,z+.28,2.3,.6,.1,'#557d86','glass');for(let a of [-1,1])for(let b of [-1,1])cyl(x+a*1.6,.6,z+b*1.6,.7,1.0,.7,'#3c4847');break;
 case 'security':desk(x,z,Math.min(3.8,ww-3));shelf(x,back,Math.min(4,ww-3),.85,true);wallBoard(true);break;
 default:desk(x,z);shelf(x,back,Math.min(3.2,ww-3));break;
 }
 // Universal room details and a ceiling luminaire make every room authored.
 F(x,Math.min(H-.28,3.55),z,Math.min(ww-2.0,3.7),.09,.34,C.light,'lit');
 F(outer,2.1,z+dd/2-.12,Math.min(2.1,ww*.25),1.0,.08,accent,'wood');
}
function buildFloor(id,seed=1,floor=1){const s=spec(id);if(!Number.isInteger(floor)||floor<1||floor>s.n)throw Error('Floor out of range '+id+' '+floor);
 const K=kit(),q=boundary(K,id,floor),layout=roomPlan(id,seed,floor),{box,add}=K,H=q.storyH,w=q.width,d=q.depth;
 box(0,H-.14,0,w,.28,d,'#d4d9cd','ceiling');
 // The long centre aisle never changes location between floors.
 box(0,.025,-2,4.35,.05,d-4,'#809690','corridor');
 box(0,.04,d/2-3.2,w-.65,.06,5.6,'#c5b99f','lobby-floor');
 for(const r of layout.rooms){
  const xx=(r.side?1:-1)*layout.hall/2,z=r.z,len=r.d+.45,door=2.3,wallH=H-.28;
  for(const sign of [-1,1])box(xx,wallH/2,z+sign*(len+door)/4,.20,wallH,(len-door)/2,'#d8d9ce','wall','wall');
  box(xx,(3.1+wallH)/2,z,.2,Math.max(.08,wallH-3.1),door,'#d8d9ce','wall','wall');
  for(const sign of [-1,1])box(xx,1.55,z+sign*(door/2+.04),.28,3.1,.09,'#8d9c93','door-frame');
  box(xx+(r.side?-.13:.13),2.26,z, .045,.24,1.25,['#9eb69f','#b7b38f','#9eb4b6'][(floor+r.row)%3],'room-sign');
  if(r.row===layout.rows-1)box(r.x,wallH/2,layout.end,r.w+.55,wallH,.20,'#d8d9ce','wall','wall');
  if(r.row>0)box(r.x,wallH/2,r.z-layout.span/2,r.w+.55,wallH,.20,'#d8d9ce','wall','wall');
  furnish(K,r,seed+floor*17,H);
 }
 const ex=w/2-3.2,ez=d/2-3.1,ew=4.2,ed=3.8;
 box(ex,.06,ez,ew,.12,ed,'#687b79','elevator-floor');
 box(ex+ew/2,1.48,ez,.18,2.96,ed,'#778a88','wall','wall');
 for(const a of [-1,1])box(ex,1.48,ez+a*ed/2,ew,2.96,.18,'#778a88','wall','wall');
 box(ex,3.01,ez,ew,.15,ed,'#b5c3b9','detail');
 for(const a of [-1,1])add('box',ex-ew/2-.02,1.35,ez+a*.78,.08,2.7,1.53,'#8ea2a0','metal',{role:'elevator-door'});
 box(ex-ew/2-.1,2.94,ez,.12,.24,2.8,'#456267','elevator-display');
 box(ex-ew/2-.13,1.25,ez+2.16,.16,.55,.24,'#cfb980','elevator-button');
 box(-w/2+3.2,.7,d/2-2.6,3.2,1.4,1.35,'#9e987c','reception','furniture');
 for(let z=-d/2+3;z<d/2-6;z+=7)box(0,H-.27,z,.3,.09,3,'#f0e9c9','light');
 const rooms=layout.rooms.map(({row,side,...r})=>r);
 return {id,name:root.CityBuildings?.types.find(t=>t.id===id)?.name||id,parts:K.parts,width:w,depth:d,height:H,baseY:q.baseY,storyH:H,floor,floors:s.n,seed,floorName:layout.program.name,rooms,colliders:K.colliders,windows:K.windows,officeSeats:K.officeSeats,
  spawn:{x:0,y:0,z:d/2-3.1},elevator:{x:ex,z:ez,width:ew,depth:ed,facing:'west',interact:{x:ex-ew/2-1.1,z:ez}},exit:{x:0,z:d/2+.9},floorPlans:rooms,
  isRepresentativeFloor:false,interiorNote:'모든 층은 개별 용도 · 방 · 가구 · 엘리베이터를 갖춘 이동 가능한 실내입니다.'};
}
function buildShell(id,seed=1){const s=spec(id),K=kit(),{box,add}=K;let maxW=s.w,maxD=s.d;
 for(let f=1;f<=s.n;f++){
  const F=kit(),q=boundary(F,id,f);for(const p of F.parts){p.y+=q.baseY;p.floor=f;K.parts.push(p);}for(const a of F.windows)K.windows.push({...a,y:a.y+q.baseY});maxW=Math.max(maxW,q.width);maxD=Math.max(maxD,q.depth);
  if(id==='apartment'&&f>1){for(const sign of [-1,1]){box(0,q.baseY+.1,sign*(q.depth/2+1),q.width,.2,2,'#c9cdbd','balcony');box(0,q.baseY+.78,sign*(q.depth/2+1.9),q.width,1.2,.10,'#8baca8','balcony-rail');}maxD=Math.max(maxD,q.depth+4);}
  if(id==='round_office'&&f>2){add('cylinder',0,q.baseY-.08,0,Math.max(q.width,q.depth)*1.25,.16,Math.max(q.width,q.depth)*1.25,'#9fb5af','metal',{role:'floor-ring'});maxW=Math.max(maxW,40);maxD=Math.max(maxD,40);}
  if(f<s.n){const next=profile(id,f+1);if(next.width<q.width-.5||next.depth<q.depth-.5){box(0,q.baseY+q.storyH+.05,0,q.width,.15,q.depth,'#748b80','terrace');for(const sign of [-1,1]){box(sign*(q.width/2-.5),q.baseY+q.storyH+.48,0,.65,.85,q.depth-1,'#718776','roof');}}}
 }
 const q=profile(id,s.n),roofY=s.n*s.h;
 box(0,roofY+.08,0,q.width+.4,.4,q.depth+.4,'#778d87','roof');
 for(const z of [-q.depth/2,q.depth/2])box(0,roofY+.62,z,q.width+.5,.75,.26,'#b7c1b4','roof');
 for(const x of [-q.width/2,q.width/2])box(x,roofY+.62,0,.26,.75,q.depth,'#b7c1b4','roof');
 for(const x of [-q.width*.25,q.width*.25]){box(x,roofY+.85,-q.depth*.23,3.6,1.4,2.4,'#687e7a','roof');for(let n=-1;n<=1;n++)box(x+n,roofY+1.58,-q.depth*.23,.13,.08,2.15,'#a9b7aa','roof');}
 box(0,3.05,s.d/2+1.2,Math.min(16,s.w*.35),.3,2.8,s.color,'canopy');
 maxD=Math.max(maxD,s.d+2.8);
 let height=roofY+2;
 if(id==='skyline'){box(0,roofY+4.2,0,15,6.4,15,'#91aaa5','roof');for(let x=-6;x<=6;x+=3)box(x,roofY+8.8,0,.35,9,12,'#cbd4c5','roof');add('cylinder',0,roofY+12.1,0,.5,6,.5,'#d6d9c7','metal',{role:'roof'});height=roofY+15.1;}
 if(id==='civic_hall'){add('cylinder',0,roofY+1.9,0,18,3,18,'#b6c0ad','metal',{role:'roof'});add('sphere',0,roofY+3.7,0,17,7,17,'#889b8f','metal',{role:'roof'});height=roofY+7.2;}
 if(id==='museum'){for(const a of [-1,1])add('box',a*12,roofY+1.8,0,28,.6,q.depth+1,'#cad2c4','metal',{role:'roof',rz:a*.12});height=roofY+4;}
 if(id==='fbi_hq'){
  // A fictional civic headquarters: shaded stone entrance, an abstract crest,
  // roof service core, stepped volume and a flag mast distinguish the model.
  for(const x of [-28,-20,20,28])box(x,4.15,s.d/2+.25,1.15,8.3,1.25,'#9aa9a6','colonnade');
  box(0,6.1,s.d/2+.45,18,2.5,.42,'#304d59','fbi-sign');
  add('cylinder',0,6.1,s.d/2+.72,1.9,.16,1.9,'#c1ae75','metal',{role:'badge',rx:Math.PI/2});
  box(-q.width/2+7,roofY+1.7,-7,9,3.4,10,'#829791','roof');
  add('cylinder',q.width/2-5,roofY+3.1,8,.18,6.2,.18,'#c9d0bc','metal',{role:'roof'});
  box(q.width/2-3.7,roofY+5.3,8,2.6,1.3,.08,'#8babad','flag');height=roofY+6.3;
 }
 const meta=root.CityBuildings.types.find(t=>t.id===id)||{};
 return {...meta,parts:K.parts,width:Math.max(maxW,meta.width||0),depth:Math.max(maxD,meta.depth||0),height:Math.max(height,meta.height||0),floors:s.n,seed,windows:K.windows,interiorStyle:s.family,interiorNote:'전 층 실내 · 실제 창 개구부 · 층별 엘리베이터',bounds:{min:[-maxW/2,-.32,-maxD/2],max:[maxW/2,height,maxD/2]},isHollowShell:true};
}
function describeFloors(id,seed=1){const s=spec(id);return Array.from({length:s.n},(_,i)=>{const floor=i+1,q=profile(id,floor),p=roomPlan(id,seed,floor);return {floor,name:p.program.name,baseY:q.baseY,storyH:q.storyH,width:q.width,depth:q.depth,rooms:p.rooms.map(({row,side,...r})=>r)};});}
root.CityInteriors={version:'2.0.0',floorCount:id=>spec(id).n,profile,describeFloors,buildFloor,buildShell,floorTitle};
})(typeof window!=='undefined'?window:globalThis);


/* maritime.js */
/* HanQ Westport · original procedural maritime assets.
 * All dimensions are metres. Boats face +X and float at Y=0.
 * BuildPier is centered on {x,z}; its boarding end is the +axis end.
 * Parts use THREE.Euler order XYZ, or custom indexed mesh vertices.
 */
(function (root) {
  'use strict';
  const C = { white:'#e4e9e5', ivory:'#d8dbd2', navy:'#173648', blue:'#2a708b', dark:'#162d36', glass:'#4c7c89', metal:'#89999a', black:'#243038', orange:'#d66c39', red:'#a44c3b', deck:'#b4b5a5', wood:'#8c795c', concrete:'#a1a9a3', road:'#39434a', yellow:'#d6b969', light:'#ffe6ad' };
  function writer() {
    const parts=[];
    function part(shape,x,y,z,sx,sy,sz,color,material,extra) {
      const p=Object.assign({shape,x,y,z,sx,sy,sz,color,material:material||'metal'},extra||{}); parts.push(p); return p;
    }
    function box(x,y,z,sx,sy,sz,c,m,e){return part('box',x,y,z,sx,sy,sz,c,m,e);}
    function cyl(x,y,z,d,h,c,m,e){return part('cylinder',x,y,z,d,h,d,c,m,e);}
    function beam(a,b,d,c,m,role){
      const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],len=Math.hypot(dx,dy,dz);
      if(len<1e-5)return;
      return part('cylinder',(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,d,len,d,c,m,{rx:Math.atan2(dz,dy),rz:-Math.asin(Math.max(-1,Math.min(1,dx/len))),role:role||'detail'});
    }
    function mesh(vertices,indices,c,m,e){return part('mesh',0,0,0,1,1,1,c,m,Object.assign({vertices,indices},e||{}));}
    return {parts,part,box,cyl,beam,mesh};
  }
  function hull(w, stations, draft, deckY, color) {
    const vertices=[],indices=[],n=7;
    for(const [x,b] of stations){
      const ring=[[deckY,b],[deckY-.65,b*.985],[-draft*.55,b*.74],[-draft,0],[-draft*.55,-b*.74],[deckY-.65,-b*.985],[deckY,-b]];
      for(const [y,z] of ring)vertices.push(x,y,z);
    }
    for(let s=0;s<stations.length-1;s++)for(let j=0;j<n;j++){
      const a=s*n+j,b=s*n+(j+1)%n,c=(s+1)*n+j,d=(s+1)*n+(j+1)%n;
      indices.push(a,b,c,b,d,c);
    }
    for(let j=1;j<n-1;j++)indices.push(0,j+1,j);
    const end=(stations.length-1)*n;for(let j=1;j<n-1;j++)indices.push(end,end+j,end+j+1);
    w.mesh(vertices,indices,color,'metal',{role:'hull'});
    // A separate deck plate follows the tapered hull outline.
    const poly=[];for(const [x,b] of stations)poly.push([x,b]);for(let i=stations.length-1;i>=0;i--)poly.push([stations[i][0],-stations[i][1]]);
    plate(w,poly,deckY+.045,.1,C.deck,'metal');
  }
  function plate(w,poly,y,t,c,m){
    const v=[],ix=[],n=poly.length;
    for(const h of [y-t/2,y+t/2])for(const [x,z] of poly)v.push(x,h,z);
    // All hull deck outlines are convex; cap fans have consistent normals.
    for(let i=1;i<n-1;i++){ix.push(n,n+i,n+i+1);ix.push(0,i+1,i);}
    for(let i=0;i<n;i++){const j=(i+1)%n;ix.push(i,j,n+i,j,n+j,n+i);}
    return w.mesh(v,ix,c,m,{role:'detail'});
  }
  function rail(w, path, y, height=1.1, color=C.white, spacing=2.5) {
    for(let k=0;k<path.length-1;k++){
      const a=path[k],b=path[k+1],dist=Math.hypot(b[0]-a[0],b[1]-a[1]),count=Math.max(1,Math.ceil(dist/spacing));
      for(let i=0;i<count;i++){
        const t=i/count,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
        w.cyl(x,y+height/2,z,.065,height,color,'metal',{role:'detail'});
      }
      for(const h of [height*.46,height])w.beam([a[0],y+h,a[1]],[b[0],y+h,b[1]],.065,color,'metal');
    }
  }
  function torus(w,x,y,z,R,r,c,rotation){
    const v=[],ix=[],N=16,M=6;
    for(let i=0;i<N;i++)for(let j=0;j<M;j++){
      const a=i/N*Math.PI*2,b=j/M*Math.PI*2;
      v.push((R+r*Math.cos(b))*Math.cos(a),(R+r*Math.cos(b))*Math.sin(a),r*Math.sin(b));
    }
    for(let i=0;i<N;i++)for(let j=0;j<M;j++){
      const a=i*M+j,b=((i+1)%N)*M+j,c1=i*M+(j+1)%M,d=((i+1)%N)*M+(j+1)%M;
      ix.push(a,b,c1,b,d,c1);
    }
    return w.mesh(v,ix,c,'metal',Object.assign({x,y,z,role:'detail'},rotation||{}));
  }
  function cabinWindows(w,x0,x1,y,z,step=1.6,h=1.2){
    for(let x=x0;x<=x1+.01;x+=step){
      w.box(x,y,z,.99,h,.075,C.dark,'metal',{role:'window'});
      w.box(x,y+.02,z+(z>=0?.045:-.045),.84,h-.14,.035,C.glass,'glass',{role:'window'});
    }
  }
  function mast(w,x,y,z,height=3){
    w.cyl(x,y+height/2,z,.13,height,C.white,'metal');
    w.box(x,y+height*.72,z,2.7,.1,.1,C.white,'metal');
    w.cyl(x-1.25,y+height*.84,z,.06,.8,C.black,'metal');
    w.cyl(x+1.25,y+height*.78,z,.06,.65,C.black,'metal');
    w.box(x,y+height+.08,z,2.1,.17,.4,C.ivory,'metal');
    w.box(x-1.25,y+height*.55,z-.13,.22,.17,.2,'#dc725a','lit');
    w.box(x+1.25,y+height*.55,z+.13,.22,.17,.2,'#79b4a3','lit');
  }
  function ferry() {
    const w=writer();
    hull(w,[[-18,4.5],[-15,5.15],[7,5.15],[12,4.7],[16,2.8],[18,.15]],2.65,1,C.navy);
    // Blue lower belt, raised full-length promenade and cut back upper deck.
    w.box(-2,1.35,0,27.2,.5,9.7,C.ivory,'metal');
    w.box(-2.4,2.85,0,25,2.6,8.25,C.white,'metal');
    w.box(-2.4,2.05,0,25.05,.38,8.32,C.blue,'metal');
    w.box(-2.3,4.27,0,27.2,.28,9.6,C.white,'metal',{role:'roof'});
    w.box(-3.8,5.62,0,19.8,2.4,7.3,C.white,'metal');
    w.box(-3.8,6.94,0,20.7,.26,8.05,C.ivory,'metal',{role:'roof'});
    cabinWindows(w,-13.4,8.7,3.0,4.16,1.7,1.3);
    cabinWindows(w,-13.4,8.7,3.0,-4.16,1.7,1.3);
    cabinWindows(w,-12.4,4.3,5.67,3.7,1.6,1.28);
    cabinWindows(w,-12.4,4.3,5.67,-3.7,1.6,1.28);
    // Wheelhouse bows outward on the upper deck, with panoramic glazing.
    w.box(7.35,5.72,0,4.7,2.45,6.8,C.white,'metal');
    w.box(7.5,7.03,0,5.8,.24,7.55,C.white,'metal',{role:'roof'});
    w.box(9.75,5.95,0,.09,1.22,5.8,C.glass,'glass',{rz:-.13,role:'window'});
    for(const z of [-2.9,-1.45,0,1.45,2.9])w.box(9.82,5.95,z,.12,1.35,.085,C.white,'metal');
    for(const z of [-3.45,3.45])w.box(7.65,5.97,z,3.4,1.15,.055,C.glass,'glass',{role:'window'});
    rail(w,[[-17.3,-4.35],[-17.3,4.35],[-14.7,4.8],[7.5,4.8],[12.1,4.3],[15.7,2.5],[17.35,0],[15.7,-2.5],[12.1,-4.3],[7.5,-4.8],[-14.7,-4.8],[-17.3,-4.35]],1.2,1.05,C.white,3.0);
    rail(w,[[-15.5,-4.5],[-15.5,4.5],[-12.5,4.5]],4.45,1,C.white,2.5);
    rail(w,[[7.1,-4.5],[11, -4.5],[11,4.5],[7.1,4.5]],4.45,1,C.white,2.3);
    // Open aft sun deck: compact benches and companionway stair.
    for(const x of [-16,-14])for(const z of [-2.7,0,2.7]){
      w.box(x,1.8,z,.6,.18,1.55,C.wood,'wood');w.box(x-.23,2.15,z,.13,.7,1.55,C.white,'metal');
    }
    for(let i=0;i<10;i++)w.box(-15.4+i*.3,1.55+i*.29,-3.3,.32,.16,1.05,C.white,'metal');
    w.beam([-15.6,2.2,-3.9],[-12.55,5.1,-3.9],.075,C.white,'metal');
    for(const z of [-4.9,4.9])for(const x of [-11,0,11])torus(w,x,2.25,z,.42,.105,C.orange);
    // Twin enclosed rescue rafts, ventilators and working radar mast.
    for(const z of [-2.5,2.5]){
      w.box(-7.4,7.2,z,4.3,.16,1.05,C.metal,'metal');
      w.cyl(-7.4,7.57,z,.76,3.8,C.white,'metal',{rz:Math.PI/2});
      for(const x of [-8.4,-6.4])w.box(x,7.55,z,.1,.83,.85,C.navy,'metal');
    }
    w.box(-1.7,7.7,0,1.4,1.35,1.65,C.blue,'metal');
    w.box(-1.7,8.43,0,1.5,.13,1.75,C.black,'metal');
    mast(w,6.5,7.18,0,3.15);
    w.cyl(15.1,1.25,0,.8,.3,C.metal,'metal');
    w.box(14.9,1.48,0,1.2,.2,.55,C.black,'metal');
    for(const x of [-16.4,14])for(const z of [-3.3,3.3])w.cyl(x,1.4,z,.19,.6,C.black,'metal');
    for(const z of [-2.5,2.5])w.cyl(-18.2,-1.1,z,.42,1.0,C.metal,'metal',{rz:Math.PI/2});
    return {name:'웨스트포트 여객 페리',parts:w.parts,width:36,depth:10.3,height:13.2,speedMps:9.5,capacity:48,waterline:0,type:'ferry'};
  }
  function speedboat() {
    const w=writer();
    hull(w,[[-5,1.4],[-3.9,1.68],[1.4,1.75],[3.65,1.0],[5,.08]],.85,.55,C.white);
    // Side accents follow the hull rather than covering it with a solid box.
    for(const z of [-1.67,1.67])w.box(-.8,.3,z,5.8,.26,.08,C.blue,'metal');
    plate(w,[[.9,-1.5],[.9,1.5],[3.6,.9],[4.6,0],[3.6,-.9]],.76,.16,C.ivory,'metal');
    w.box(-1.7,.64,0,5.6,.12,2.45,C.wood,'wood');
    for(const z of [-1.4,1.4])w.box(-1.9,.98,z,5.5,.67,.22,C.white,'metal');
    w.box(-3.7,.98,0,1.7,.18,2.5,C.white,'metal');
    w.box(-4.2,1.29,0,.2,.56,2.5,C.navy,'metal');
    // Angled front windshield with two side wings and bright metal frame.
    w.box(1.25,1.43,0,.055,1.14,2.55,C.glass,'glass',{rz:-.35,role:'window'});
    for(const z of [-1.3,1.3]){
      w.box(.63,1.4,z,1.26,1.04,.045,C.glass,'glass',{role:'window'});
      w.beam([.05,1.97,z],[1.08,1.97,z],.055,C.metal,'metal');
    }
    w.beam([1.06,1.98,-1.3],[1.06,1.98,1.3],.055,C.metal,'metal');
    w.box(.65,1.0,0,.55,.78,2.4,C.navy,'metal');
    for(const z of [-.7,.7]){
      w.box(-.45,1.02,z,.74,.24,.7,C.ivory,'metal');
      w.box(-.8,1.36,z,.17,.8,.7,C.ivory,'metal',{rz:-.12});
      w.cyl(-.45,.78,z,.14,.35,C.metal,'metal');
    }
    torus(w,.43,1.4,-.7,.19,.035,C.black,{ry:Math.PI/2,rz:.25});
    for(const z of [-.75,.75]){
      w.box(-5.14,.4,z,.65,.9,.55,C.black,'metal');
      w.box(-5.28,-.35,z,.28,.8,.24,C.metal,'metal');
      w.cyl(-5.4,-.6,z,.18,.36,C.black,'metal',{rz:Math.PI/2});
      w.box(-5.63,-.6,z,.09,.15,.7,C.metal,'metal',{rx:.3});
    }
    rail(w,[[1.9,-1.35],[3.6,-.8],[4.65,0],[3.6,.8],[1.9,1.35]],.9,.45,C.metal,1.7);
    for(const z of [-1.47,1.47])w.box(-3.1,1.46,z,.35,.12,.11,C.metal,'metal');
    w.box(3.6,.9,0,.42,.12,.3,C.metal,'metal');
    w.box(1.9,1.1,-1.3,.14,.11,.17,'#d97764','lit');
    w.box(1.9,1.1,1.3,.14,.11,.17,'#7db4a2','lit');
    return {name:'해협 고속 모터보트',parts:w.parts,width:10.8,depth:3.5,height:3.0,speedMps:18,capacity:6,waterline:0,type:'speedboat'};
  }
  function workboat() {
    const w=writer();
    hull(w,[[-10,2.6],[-8,3.5],[5.5,3.5],[8.5,2.4],[10,.4]],1.9,1.15,C.navy);
    w.box(-2.3,1.3,0,11.5,.15,6.35,C.wood,'wood');
    // Rugged wheelhouse and two-tier forward superstructure.
    w.box(3.0,2.65,0,6.7,2.8,5.4,C.ivory,'metal');
    w.box(3.05,4.18,0,7.3,.26,5.95,C.orange,'metal',{role:'roof'});
    w.box(3.45,5.35,0,4.7,2.1,4.9,C.white,'metal');
    w.box(3.45,6.51,0,5.35,.25,5.45,C.ivory,'metal',{role:'roof'});
    w.box(5.85,5.55,0,.06,1.0,4.1,C.glass,'glass',{role:'window'});
    for(const z of [-2.12,-.7,.7,2.12])w.box(5.9,5.55,z,.1,1.12,.08,C.white,'metal');
    cabinWindows(w,1.7,4.9,5.5,-2.49,1.45,1.0);cabinWindows(w,1.7,4.9,5.5,2.49,1.45,1.0);
    for(const z of [-2.74,2.74]){
      w.box(1.4,2.65,z,.95,2.1,.07,C.orange,'metal');
      w.box(1.4,3.1,z+(z>0?.05:-.05),.66,.6,.04,C.glass,'glass',{role:'window'});
      w.box(3.5,2.85,z,1.35,.9,.055,C.glass,'glass',{role:'window'});
    }
    // Aft working deck: towing winch, coiled cable, storage, crane.
    w.box(-3.1,1.55,0,2.8,.35,2.5,C.black,'metal');
    w.cyl(-3.1,2.0,0,1.7,2.3,C.metal,'metal',{rx:Math.PI/2});
    for(const z of [-1.2,1.2])w.cyl(-3.1,2.0,z,1.95,.13,C.black,'metal',{rx:Math.PI/2});
    for(let i=0;i<5;i++)torus(w,-6.5,1.5+i*.085,.8,.67,.07,C.wood,{rx:Math.PI/2});
    w.box(-7.1,1.8,-1.8,2.5,1.15,1.2,C.orange,'metal');
    w.cyl(-1.4,1.8,-2.5,.65,1.25,C.orange,'metal');
    w.beam([-1.4,2.3,-2.5],[-4.0,5.2,-2.5],.28,C.orange,'metal');
    w.beam([-4,5.2,-2.5],[-7,4.6,-2.5],.24,C.orange,'metal');
    w.beam([-7,4.6,-2.5],[-7,2.4,-2.5],.045,C.black,'metal');
    w.box(-7,2.3,-2.5,.3,.22,.3,C.metal,'metal');
    // Heavy tire fenders, bow push pad, stern guard and open rail.
    for(const z of [-3.5,3.5])for(const x of [-7,-3,1,6]){
      torus(w,x,.85,z,.59,.18,C.black);
      w.beam([x,1.8,z],[x,1.15,z],.07,C.metal,'metal');
    }
    w.box(9.45,1.1,0,.55,1.3,2.8,C.black,'metal');
    rail(w,[[-9.5,-2.6],[-9.5,2.6],[-7.6,3.2],[-.3,3.2]],1.4,1.1,C.ivory,2.5);
    rail(w,[[-7.6,-3.2],[-.3,-3.2]],1.4,1.1,C.ivory,2.5);
    rail(w,[[6.8,-2.9],[8.6,-1.9],[9.25,0],[8.6,1.9],[6.8,2.9]],1.4,1.05,C.ivory,1.8);
    for(const z of [-1.9,1.9]){
      w.cyl(7.4,1.62,z,.28,.65,C.black,'metal');
      w.box(7.4,1.98,z,.7,.12,.22,C.black,'metal');
    }
    w.cyl(-.1,5.2,1.5,.6,2.1,C.orange,'metal');
    w.cyl(-.1,6.29,1.5,.65,.18,C.black,'metal');
    mast(w,3.3,6.7,0,2.75);
    torus(w,1.1,3.25,-2.85,.38,.095,C.orange);torus(w,1.1,3.25,2.85,.38,.095,C.orange);
    return {name:'항만 작업선',parts:w.parts,width:20,depth:7.4,height:11.5,speedMps:6.5,capacity:8,waterline:0,type:'workboat'};
  }
  function buildBoat(type='ferry') {
    if(type==='ferry')return ferry();if(type==='speedboat')return speedboat();if(type==='workboat')return workboat();
    throw new Error('Unknown boat type: '+type);
  }
  function buildPier(o={}) {
    const x=o.x||0,z=o.z||0,length=o.length||80,width=o.width||20,y=o.y==null?7.5:o.y,axis=o.axis||'x';
    const w=writer(),a=axis==='z'?-Math.PI/2:0,co=Math.cos(a),si=Math.sin(a);
    const point=(u,v,h)=>[x+u*co+v*si,h,z-u*si+v*co];
    const box=(u,h,v,sx,sy,sz,c,m,e)=>{const q=point(u,v,h);return w.box(q[0],q[1],q[2],sx,sy,sz,c,m,Object.assign({ry:a},e||{}));};
    const cyl=(u,h,v,d,ht,c,m)=>{const q=point(u,v,h);return w.cyl(q[0],q[1],q[2],d,ht,c,m);};
    const beam=(u1,h1,v1,u2,h2,v2,d,c)=>w.beam(point(u1,v1,h1),point(u2,v2,h2),d,c,'metal');
    box(0,y-.6,0,length,1.2,width,C.concrete,'concrete');
    box(0,y+.03,0,length-.5,.05,width-.5,'#c1c3b8','concrete');
    for(let u=-length/2+3;u<length/2;u+=10)for(const v of [-width*.36,width*.36]){
      cyl(u,(y-1)/2,v,1.1,y-1,C.concrete,'concrete');
      box(u,y-.95,v,3,.7,2.8,C.concrete,'concrete');
    }
    for(let u=-length/2+4;u<length/2-2;u+=9){
      box(u,y+.045,0,.08,.025,width-.7,'#a1a89e','concrete');
      for(const v of [-width/2+.7,width/2-.7]){
        box(u,y+.15,v,1.1,.2,.8,C.black,'metal');
        cyl(u,y+.5,v,.24,.62,C.metal,'metal');
        box(u,y+.82,v,.7,.13,.22,C.metal,'metal');
      }
    }
    for(const v of [-width/2+.28,width/2-.28]){
      box(0,y+.09,v,length-.5,.08,.22,C.yellow,'road');
      for(let u=-length/2+6;u<length/2;u+=7){
        box(u,y-1.1,v+(v>0?.42:-.42),.55,1.6,.45,C.black,'metal');
      }
    }
    // Low promenade lamps; no tall object obstructs the boarding edge.
    for(let u=-length/2+6;u<length/2-8;u+=18)for(const v of [-width/2+1.5,width/2-1.5]){
      cyl(u,y+1.5,v,.13,3,C.navy,'metal');
      box(u,y+3.06,v,.6,.17,.6,C.white,'metal');
      box(u,y+2.95,v,.42,.12,.42,C.light,'lit');
    }
    // Stairs down to a tide-level boarding pontoon at the outer end.
    const count=Math.max(4,Math.ceil((y-1.3)/.32)),step=.56,start=length/2-1,low=1.3;
    for(let i=0;i<count;i++){
      const h=y-(i+1)*(y-low)/count;
      box(start+(i+.5)*step,h-.12,0,step+.025,.24,3.2,C.ivory,'concrete');
    }
    const end=start+count*step;
    box(end+3.0,low-.25,0,6.2,.5,6.8,C.wood,'wood');
    for(const v of [-1.75,1.75])beam(start,y+1,v,end,low+1,v,.07,C.metal);
    box(end+3,low-.6,0,5.6,.4,6,C.black,'metal');
    for(const v of [-3.4,3.4])for(let u=end+1;u<end+6;u+=2)cyl(u,1.8,v,.18,1.0,C.metal,'metal');
    const boarding=point(end+3,0,low),boat=point(end+3,width/2+5,0);
    return {name:'연안 여객 부두',parts:w.parts,width:axis==='x'?length+count*step+6:width,depth:axis==='x'?width:length+count*step+6,height:y+3.2,boardingPoint:{x:boarding[0],y:boarding[1],z:boarding[2]},boatPoint:{x:boat[0],y:boat[1],z:boat[2]},axis};
  }
  function buildBridge(o={}) {
    const x0=o.x0==null?-500:o.x0,x1=o.x1==null?500:o.x1,z=o.z||0,gy=o.groundY==null?8:o.groundY,dy=o.deckY==null?28:o.deckY,width=o.width||26;
    if(x1<=x0)throw new Error('Bridge x1 must be greater than x0');
    const w=writer(),L=x1-x0,approach=Math.min(180,L*.22),a=x0+approach,b=x1-approach,deckThickness=1.8;
    const profile=x=>x<a?gy+(dy-gy)*(x-x0)/approach:x>b?dy-(dy-gy)*(x-b)/approach:dy;
    const slope=x=>x<a?(dy-gy)/approach:x>b?-(dy-gy)/approach:0;
    function slab(xa,xb,zz,ww,h,c,m,lift=0){
      const ya=profile(xa)+lift,yb=profile(xb)+lift,dx=xb-xa,angle=Math.atan2(yb-ya,dx);
      return w.box((xa+xb)/2,(ya+yb)/2,zz,Math.hypot(dx,yb-ya),h,ww,c,m,{rz:angle,role:'bridge'});
    }
    for(const [xa,xb] of [[x0,a],[a,b],[b,x1]]){
      slab(xa,xb,z,width,deckThickness,C.concrete,'concrete',-deckThickness/2);
      slab(xa,xb,z,width-5,.08,C.road,'road',.055);
      for(const side of [-1,1])slab(xa,xb,z+side*(width/2-1.1),2.1,.24,'#bec3b8','concrete',.12);
      slab(xa,xb,z,.5,.42,C.concrete,'concrete',.21);
      for(const offset of [-.39,.39])slab(xa,xb,z+offset,.08,.03,C.yellow,'road',.09);
      for(const side of [-1,1])slab(xa,xb,z+side*(width/2-2.55),.1,.03,'#dce0d5','road',.105);
    }
    // Four lanes, broken lane stripes, two barrier lines and pedestrian rails.
    for(let x=x0+4;x<x1-5;x+=14){
      const xe=Math.min(x+6,x1-2);
      for(const offset of [-5.2,5.2])slab(x,xe,z+offset,.13,.025,'#e3e2d5','road',.108);
    }
    for(const side of [-1,1]){
      const zz=z+side*(width/2-.2);
      for(let x=x0;x<x1;x+=18){
        const nx=Math.min(x+18,x1);
        w.cyl(x,profile(x)+.65,zz,.12,1.3,C.metal,'metal',{role:'bridge-rail'});
        w.beam([x,profile(x)+1.25,zz],[nx,profile(nx)+1.25,zz],.11,C.metal,'metal','bridge-rail');
        w.beam([x,profile(x)+.59,zz],[nx,profile(nx)+.59,zz],.085,C.metal,'metal','bridge-rail');
      }
      for(let x=x0+24;x<x1-15;x+=58){
        const h=profile(x),zz=z+side*(width/2-1.2);
        w.cyl(x,h+4.8,zz,.23,9.6,C.navy,'metal',{role:'bridge-pole'});
        w.beam([x,h+9.5,zz],[x,h+10,z+side*(width/2-3.2)],.16,C.navy,'metal','bridge');
        w.box(x,h+9.95,z+side*(width/2-3.4),1.4,.16,.65,C.white,'metal',{role:'bridge'});
        w.box(x,h+9.82,z+side*(width/2-3.4),1.1,.08,.4,C.light,'lit',{role:'bridge'});
      }
    }
    // Twin portals stand outside the road carriageway. Centre shipping span is clear.
    const p1=a+(b-a)*.24,p2=a+(b-a)*.76,top=dy+Math.min(88,Math.max(42,L*.12)),legZ=width/2+1.6;
    for(const px of [p1,p2]){
      w.box(px,-1.5,z,18,3,width+12,'#899794','concrete',{role:'bridge'});
      for(const side of [-1,1]){
        w.box(px,(top-2)/2,z+side*legZ,5.3,top+2,4.5,'#c4c9be','concrete',{role:'bridge'});
        w.box(px,dy-3,z+side*legZ,7,3,6,'#a5b1a8','concrete',{role:'bridge'});
        w.box(px+.02,dy+(top-dy)*.58,z+side*(legZ+2.28),2.1,top-dy-8,.12,C.navy,'metal',{role:'detail'});
      }
      w.box(px,top-2,z,5.4,4.3,legZ*2+5,'#c4c9be','concrete',{role:'bridge'});
      w.box(px,dy+16,z,4.9,3.0,legZ*2+4.9,'#b7c0b4','concrete',{role:'bridge'});
      for(const side of [-1,1])for(let n=1;n<=9;n++){
        const spread=(b-a)*.22*n/9;
        for(const dir of [-1,1]){
          const end=px+spread*dir;
          w.beam([px,top-6-n*.65,z+side*legZ],[end,dy+.45,z+side*(width/2+.05)],.16,'#d8d9c8','metal','cable');
          w.box(end,dy+.45,z+side*(width/2+.05),1.2,.65,.7,C.metal,'metal',{role:'detail'});
        }
      }
      for(const side of [-1,1])w.box(px,top+.3,z+side*legZ,.45,.45,.45,'#eea27e','lit',{role:'detail'});
    }
    // Approach piers terminate before the navigable central span.
    for(const side of [0,1]){
      const base=side?b:x0;
      for(let i=1;i<4;i++){
        const px=base+approach*i/4,h=profile(px)-deckThickness;
        w.box(px,h/2,z,4.8,Math.max(.5,h),width-5,'#94a49c','concrete',{role:'bridge'});
        w.box(px,h-.8,z,8,1.5,width-1,'#adb8ac','concrete',{role:'bridge'});
      }
    }
    const roadSamples=[];for(let i=0;i<=80;i++){const x=x0+L*i/80;roadSamples.push({x,y:profile(x)+.11,z});}
    return {name:'웨스트포트 해협대교',parts:w.parts,width:L,depth:width+12,height:top+2,roadSamples,ends:[{x:x0,y:gy,z},{x:x1,y:gy,z}],clearance:dy-deckThickness,deckY:dy,pylons:[p1,p2],length:L,lanes:4};
  }
  root.CityMaritime={buildBoat,buildPier,buildBridge,boatTypes:['ferry','speedboat','workboat']};
})(typeof window!=='undefined'?window:globalThis);


/* world.js */
/* WESTPORT / HanQ. Deterministic urban expansion, metres, Y up, north=-Z.
 * New land area is half of sampled original land, excluding offshore piers.
 * Geometry is authored locally. This file never reads or writes game saves.
 */
(function(root){
'use strict';
const PI=Math.PI;
function area(P){let a=0;for(let i=0;i<P.length;i++){let b=P[(i+1)%P.length];a+=P[i][0]*b[1]-b[0]*P[i][1];}return Math.abs(a)/2;}
function inside(x,z,P){let r=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if(((a[1]>z)!==(b[1]>z))&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])r=!r;}return r;}
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function transform(parts,x,y,z,scale=1,ry=0,group='city'){
  const c=Math.cos(ry),s=Math.sin(ry);
  return parts.map(p=>{const q={...p,x:x+((p.x||0)*c+(p.z||0)*s)*scale,y:y+(p.y||0)*scale,z:z+(-(p.x||0)*s+(p.z||0)*c)*scale,sx:(p.sx||1)*scale,sy:(p.sy||1)*scale,sz:(p.sz||1)*scale,group};
    // Building instances only rotate in Y; their primitives are authored axis aligned.
    if(ry)q.ry=(p.ry||0)+ry;return q;});
}
function create(terrain,reference){
 const rng=random(885202611),parts=[],buildings=[],roads=[],trees=[],labels=[],features=[];
 const basePoly=[[-600,-430],[-510,-570],[360,-570],[550,-420],[550,430],[420,550],[-450,550],[-600,380]];
 const originalArea=terrain.landArea,scale=Math.sqrt(originalArea*.5/area(basePoly)),cx=-860,cz=1040,ground=8;
 const world=(u,v)=>[cx+u*scale,cz+v*scale];
 const coastline=basePoly.map(p=>world(...p));
 function add(shape,x,y,z,sx,sy,sz,color,material='concrete',extra={}){let p={shape,x,y,z,sx,sy,sz,color,material,group:'city',...extra};parts.push(p);return p;}
 const box=(x,y,z,sx,sy,sz,c,m,e)=>add('box',x,y,z,sx,sy,sz,c,m,e);
 function line(a,b,width,height,color,y,mat='concrete',group='city'){
   const dx=b[0]-a[0],dz=b[1]-a[1];return box((a[0]+b[0])/2,y,(a[1]+b[1])/2,Math.hypot(dx,dz),height,width,color,mat,{ry:-Math.atan2(dz,dx),group});
 }
 function tree(x,z,h=8,group='city',base=ground){
   add('cylinder',x,base+h*.28,z,.55,h*.55,.55,'#70624e','wood',{group,role:'tree'});
   add('sphere',x,base+h*.73,z,h*.65,h*.71,h*.63,['#627a4b','#6d8453','#7b8b58'][Math.floor(rng()*3)],'foliage',{group,role:'tree'});
   trees.push({x,z,h,group});
 }
 function lamp(x,z,ry=0){
   box(x,ground+4.6,z,.16,9.2,.16,'#586267','metal',{role:'streetlight'});
   box(x+Math.cos(ry)*.8,ground+9.1,z-Math.sin(ry)*.8,1.7,.16,.2,'#68757a','metal',{ry,role:'streetlight'});
   box(x+Math.cos(ry)*1.45,ground+9.0,z-Math.sin(ry)*1.45,.58,.09,.34,'#ffedc5','lit',{ry,role:'streetlight'});
 }
 function car(x,z,ry=0,color='#d9d6ca',kind='sedan',group='city',base=ground+.3){
   const local=[{shape:'box',x:0,y:.75,z:0,sx:4.6,sy:1.05,sz:1.95,color,material:'metal'},
    {shape:'box',x:-.3,y:1.45,z:0,sx:2.45,sy:.7,sz:1.7,color:'#46626b',material:'glass'},
    {shape:'box',x:-.3,y:1.85,z:0,sx:2.35,sy:.08,sz:1.73,color,material:'metal'}];
   for(const xx of [-1.45,1.45])for(const zz of [-.98,.98])local.push({shape:'cylinder',x:xx,y:.45,z:zz,sx:.72,sy:.25,sz:.72,rx:PI/2,color:'#222c30',material:'road'});
   local.push({shape:'box',x:2.32,y:.9,z:0,sx:.05,sy:.17,sz:1.5,color:'#eae4c9',material:'lit'});
   parts.push(...transform(local,x,base,z,kind==='bus'?1.8:1,ry,group));
 }
 function street(a,b,width=16,primary=false){
   roads.push({a,b,width,primary});line(a,b,width, .25,'#444d51',ground+.13,'road');
   const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),nx=-dz/L,nz=dx/L;
   for(let d=6;d<L-4;d+=12){const t=d/L,x=a[0]+dx*t,z=a[1]+dz*t;
     if(roads.slice(0,-1).some(r=>Math.abs((x-r.a[0])*(r.b[1]-r.a[1])-(z-r.a[1])*(r.b[0]-r.a[0]))/Math.hypot(r.b[0]-r.a[0],r.b[1]-r.a[1])<r.width*.6))continue;
     line([x-dx/L*2,z-dz/L*2],[x+dx/L*2,z+dz/L*2],.24,.04,primary?'#dbc17a':'#c8ccc5',ground+.29,'road');
   }
   for(const side of [-1,1])line([a[0]+nx*(width/2-.5)*side,a[1]+nz*(width/2-.5)*side],[b[0]+nx*(width/2-.5)*side,b[1]+nz*(width/2-.5)*side],.16,.04,'#b6bfba',ground+.28,'road');
 }
 function place(type,u,v,s=1,district='',customName){
   const model=root.CityBuildings.build(type,buildings.length+29),[x,z]=world(u,v),ss=scale*s;
   const b={id:'W-'+String(buildings.length+1).padStart(3,'0'),type,name:customName||model.name,district,x,z,y:ground+.37,scale:ss,rotation:0,width:model.width*ss,depth:model.depth*ss,height:model.height*ss,floors:model.floors,seed:buildings.length+29,interiorStyle:model.interiorStyle};
   parts.push(...transform(model.parts,x,b.y,z,ss,0,'buildings').map(p=>({...p,buildingId:b.id})));buildings.push(b);return b;
 }
 function plaza(u,v,w=90,d=90,green=false){const[x,z]=world(u,v);box(x,ground+.28,z,w*scale,.55,d*scale,green?'#7b8a63':'#b8b5a5','concrete',{role:'plaza'});
   if(green){line([x-w*scale/2,z],[x+w*scale/2,z],5,.12,'#cbc7b5',ground+.62);line([x,z-d*scale/2],[x,z+d*scale/2],5,.12,'#cbc7b5',ground+.62);}
   for(const dx of [-w*.34,w*.34])for(const dz of [-d*.34,d*.34])tree(x+dx*scale,z+dz*scale,9);
   for(const dx of [-15,15]){box(x+dx,ground+.85,z+18,5,.25,1.3,'#9d825e','wood',{role:'bench'});box(x+dx,ground+1.2,z+18.7,5,.65,.15,'#9d825e','wood',{role:'bench'});}
 }
 // A deliberately urban, chamfered shoreline, with the exact area relationship.
 const verts=[],inds=[];for(const y of [-7,ground])for(const p of coastline)verts.push(p[0],y,p[1]);const N=coastline.length;
 for(let i=1;i<N-1;i++)inds.push(N,N+i+1,N+i);for(let i=0;i<N;i++){const j=(i+1)%N;inds.push(i,N+i,j,j,N+i,N+j);}
 add('mesh',0,0,0,1,1,1,'#a6a28e','concrete',{vertices:verts,indices:inds,role:'land'});
 for(let i=0;i<N;i++){const a=coastline[i],b=coastline[(i+1)%N];line(a,b,5,ground+3,'#8f968a',ground/2-1.5);line(a,b,7,.45,'#c1bcaa',ground+.23);}
 // Street grid: central two boulevards and smaller cross streets.
 const grid=[-480,-360,-240,-120,0,120,240,360,480];
 for(const u of grid)street(world(u,u===480?-360:-480),world(u,480),u===0?25:15,u===0);
 for(const v of grid)street(world(-480,v),world(v===-480?360:480,v),v===120||v===-120?25:15,v===120||v===-120);
 // Clear crosswalks and junction lamps.
 for(const u of grid)for(const v of grid){if(u===480&&v===-480)continue;const [x,z]=world(u,v),ww=(u===0?25:15),hh=(v===120||v===-120?25:15);
   for(const sign of [-1,1])for(let q=-5;q<=5;q+=2){box(x+q,ground+.31,z+sign*(hh/2+3),1.1,.04,4.3,'#deddd0','road');box(x+sign*(ww/2+3),ground+.32,z+q,4.3,.04,1.1,'#deddd0','road');}
   lamp(x+ww/2+5,z+hh/2+5,PI);
 }
 const districts=[
 {id:'finance',name:'스카이라인 금융지구',en:'SKYLINE',u:110,v:-105,color:'#b1c9cc',desc:'단차형 타워 · 유리 오피스 · 중앙광장'},
 {id:'residential',name:'노스 코트 주거지구',en:'NORTH COURT',u:-180,v:-380,color:'#c7c0a1',desc:'발코니 아파트 · 중정 · 생활 상가'},
 {id:'oldtown',name:'브릭 레인 상업가',en:'BRICK LANE',u:-370,v:0,color:'#d2a17f',desc:'벽돌 건물 · 아케이드 · 골목형 상권'},
 {id:'civic',name:'시민·의료지구',en:'CIVIC QUARTER',u:345,v:-365,color:'#bdcfb5',desc:'종합병원 · 학교 · 경찰서 · 시민회관'},
 {id:'marina',name:'마리나 워터프런트',en:'MARINA',u:405,v:90,color:'#a4d4cd',desc:'테라스 호텔 · 해양 미술관 · 해안 산책로'},
 {id:'market',name:'사우스 마켓',en:'SOUTH MARKET',u:-335,v:370,color:'#d5bc8f',desc:'실내시장 · 대형 상가 · 음식점'},
 {id:'transit',name:'센트럴 역세권',en:'CENTRAL STATION',u:20,v:380,color:'#bdc6d0',desc:'중앙역 · 버스 광장 · 환승 거리'},
 {id:'harbor',name:'이스트 포트',en:'EAST PORT',u:370,v:360,color:'#9fc6d1',desc:'여객터미널 · 물류창고 · 컨테이너 야드'}
 ].map(d=>{const[x,z]=world(d.u,d.v);return{...d,x,z};});
 const featureLot=new Map([
  ['5,0',['school','civic']],['6,0',['hospital','civic']],['7,0',['police','civic']],['6,1',['civic_hall','civic']],['7,1',['school','civic']],
  ['4,3',['skyline','finance']],['3,3',['park','finance']],['5,3',['round_office','finance']],['2,4',['mall','finance']],
  ['6,2',['museum','marina']],['7,2',['hotel','marina']],['6,4',['hotel','marina']],
  ['0,6',['market','market']],['2,7',['mall','market']],['3,6',['station','transit']],['4,6',['plaza','transit']],['5,6',['fire_station','transit']],
  ['6,6',['ferry_terminal','harbor']],['7,6',['yard','harbor']],['6,7',['warehouse','harbor']],['7,7',['warehouse','harbor']]
 ]);
 for(let j=0;j<8;j++)for(let i=0;i<8;i++){
   const u=-420+120*i,v=-420+120*j,[x,z]=world(u,v),lot=104*scale;
   if(!inside(x,z,coastline))continue;
   box(x,ground+.15,z,lot,.3,lot,'#b4b3a5','concrete',{role:'sidewalk'});
   const feat=featureLot.get(i+','+j);
   if(feat){const[type,zone]=feat;if(type==='park'||type==='plaza'){plaza(u,v,100,100,type==='park');
       if(type==='park'){add('cylinder',x,ground+.8,z,22,1.2,22,'#a2a698','concrete',{role:'fountain'});add('cylinder',x,ground+1.43,z,19,.1,19,'#6eaaa5','water');add('cylinder',x,ground+3,z,1.2,4,1.2,'#cbcec2','concrete',{role:'fountain'});}
       else {for(let n=0;n<4;n++)car(x-30+n*19,z+16,PI/2,'#548a8e','bus');}
     }else if(type==='yard'){for(let a=0;a<4;a++)for(let b=0;b<5;b++)for(let k=0;k<(a+b)%3+1;k++)box(x-31+a*18,ground+1.6+k*3.1,z-30+b*13,12,3,5.8,['#758b8d','#a3664d','#c3b48f','#5b787b'][(a+b)%4],'metal',{role:'cargo-container'});
        for(let a=0;a<2;a++){box(x+23*a-10,ground+16,z+35,1.2,32,1.2,'#d1b66d','metal',{role:'crane-solid'});box(x+23*a-10,ground+31,z+16,2,2,44,'#c4a15f','metal',{role:'crane-solid'});}
     }else {const b=place(type,u,v-7,1,zone);if(['skyline','round_office'].includes(type)){
         const small=place('restaurant',u,v+35,.68,zone);small.name='타워 플라자 카페';
       }else{for(let a=-2;a<=2;a++){car(x+a*8,z+lot*.37,PI/2,['#bec8c4','#475861','#ac735a'][(a+3)%3]);}}
       if(type==='school'){box(x,ground+.38,z+32*scale,62*scale,.1,24*scale,'#6e8b70','road');for(const d of [-28,28])box(x+d*scale,ground+1.8,z+32*scale,.3,3,8,'#d8ded4','metal',{role:'court-screen'});}
       if(type==='ferry_terminal')b.name='웨스트포트 여객터미널';
     }
   }else if(j<2){
     place('apartment',u-24,v-24,.82,'residential');place('apartment',u+24,v-24,.82,'residential');place(j%2?'brick_apartment':'shop_row',u,v+25,j%2?.94:.98,'residential');
   }else if(i<2&&j<6){
     place('brick_apartment',u-24,v-24,.93,'oldtown');place('brick_apartment',u+24,v-24,.93,'oldtown');place('shop_row',u,v+26,1,'oldtown');
   }else if(j>=6&&i<3){place('shop_row',u,v-25,1.1,'market');place('restaurant',u-24,v+25,.95,'market');place('brick_apartment',u+24,v+25,.92,'market');
   }else if(j>=6&&i<6){place('stepped_office',u-24,v-24,.82,'transit');place('brick_apartment',u+24,v-24,.85,'transit');place('shop_row',u,v+27,.96,'transit');
   }else if(i>=6){place((j+i)%2?'hotel':'round_office',u,v-20,1,'marina');place('restaurant',u,v+30,.9,'marina');
   }else{
     const t=(i+j)%3===0?'skyline':(i+j)%3===1?'stepped_office':'round_office';place(t,u-23,v-23,.85,'finance');place('stepped_office',u+25,v+24,.82,'finance');
   }
   for(const dx of [-44,44]){tree(x+dx*scale,z+46*scale,7+rng()*2);tree(x+dx*scale,z-46*scale,7+rng()*2);}
   if((i+j)%2===0){car(x+38*scale,z,PI/2,['#c5bba8','#476a75','#ad6c54'][Math.floor(rng()*3)]);}
 }
 // A new headquarters on its own northern civic parcel. All earlier lots stay.
 const fbi=place('fbi_hq',300,-528,1,'civic','FBI 웨스트포트 본부');
 const fbiDoor=[fbi.x,fbi.z+23*fbi.scale];
 line(fbiDoor,world(300,-480),6,.16,'#b8b7a8',ground+.34,'concrete');
 features.push({id:'fbi',name:'FBI 본부',x:fbi.x,z:fbi.z,height:fbi.height,distance:190});
 // Seawall promenade around the edge; an uninterrupted outer road loop.
 const ring=basePoly.map(([u,v])=>world(u*.955,v*.955));
 for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length];line(a,b,12,.22,'#50595b',ground+.13,'road');
   const L=Math.hypot(a[0]-b[0],a[1]-b[1]);for(let d=15;d<L;d+=38){const t=d/L,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,tx=x+(b[1]-a[1])/L*9,tz=z-(b[0]-a[0])/L*9;if(tx>cx+480*scale&&Math.abs(tz-(cz+120*scale))<18)continue;tree(tx,tz,7);}
 }
 // Hook the grid ends into the perimeter boulevard.
 function ringIntersect(fixed,axis,far){const pp=basePoly.map(p=>p.map(v=>v*.955)),hits=[];for(let i=0;i<pp.length;i++){const a=pp[i],b=pp[(i+1)%pp.length],q=1-axis;if((a[q]<=fixed&&b[q]>=fixed)||(b[q]<=fixed&&a[q]>=fixed)){if(Math.abs(b[q]-a[q])>.0001)hits.push(a[axis]+(b[axis]-a[axis])*(fixed-a[q])/(b[q]-a[q]));}}return far?Math.max(...hits):Math.min(...hits);}
 for(const v of [-360,0,360]){street(world(-480,v),world(ringIntersect(v,0,false),v),13);street(world(480,v),world(ringIntersect(v,0,true),v),13);}
 for(const u of [-360,0,360]){street(world(u,-480),world(u,ringIntersect(u,1,false)),13);street(world(u,480),world(u,ringIntersect(u,1,true)),13);}
 const bridgeZ=cz+120*scale,bridgeX0=cx+480*scale,bridgeX1=370;
 const bridge=root.CityMaritime.buildBridge({x0:bridgeX0,x1:bridgeX1,z:bridgeZ,groundY:ground+.25,deckY:24,width:26});
 parts.push(...bridge.parts.map(p=>({...p,group:'bridge'})));
 features.push({id:'bridge',name:'웨스트포트 해협대교',x:(bridgeX0+bridgeX1)/2,z:bridgeZ,height:70,description:'4차로 사장교 · 보행로 · 선박 통항 구간',distance:850});
 // New mainland junction only. This is an expansion connection, not a live game edit.
 const connection=[[bridgeX1,bridgeZ],[500,bridgeZ],[610,1165],[736,1176]];
 function drapedLink(points,width,firstY){for(let k=0;k<points.length-1;k++){const A=points[k],B=points[k+1],L=Math.hypot(B[0]-A[0],B[1]-A[1]),n=Math.ceil(L/7);for(let i=0;i<n;i++){const a=[A[0]+(B[0]-A[0])*i/n,A[1]+(B[1]-A[1])*i/n],b=[A[0]+(B[0]-A[0])*(i+1)/n,A[1]+(B[1]-A[1])*(i+1)/n],ya=k===0&&i===0&&firstY!==undefined?firstY:height(...a)+.45,yb=height(...b)+.45,dx=b[0]-a[0],dz=b[1]-a[1],dy=yb-ya;box((a[0]+b[0])/2,(ya+yb)/2-.15,(a[1]+b[1])/2,Math.hypot(dx,dy,dz)+.06,.3,width,'#596367','road',{ry:-Math.atan2(dz,dx),rz:Math.atan2(dy,Math.hypot(dx,dz)),group:'connection'});}}}
 drapedLink(connection,25,8.36);
 const portZ=cz+360*scale,coastX=cx+550*scale;
 const westPier=root.CityMaritime.buildPier({x:coastX+33,z:portZ,length:90,width:18,y:ground,axis:'x'});
 parts.push(...westPier.parts.map(p=>({...p,group:'ports'})));
 line(world(420,360),[coastX+4,portZ],18,.3,'#999e93',ground+.15,'concrete','ports');
 // The original east coast rises above 18m here. A 20m quay/apron keeps
 // the terminal and pier above the sampled terrain instead of burying them.
 const eastQuayY=20;
 const eastPierRaw=root.CityMaritime.buildPier({x:0,z:0,length:120,width:18,y:eastQuayY,axis:'x'});
 const eastCenter=[261,portZ+12];
 parts.push(...transform(eastPierRaw.parts,eastCenter[0],0,eastCenter[1],1,PI,'ports'));
 box(352.5,10,portZ+12,105,20,100,'#939d92','concrete',{group:'referencePort',role:'graded-apron'});
 box(352.5,20.035,portZ+12,105,.07,100,'#b5b8a9','concrete',{group:'referencePort',role:'apron-surface'});
 const eastLandPort=root.CityBuildings.build('ferry_terminal',91);
 parts.push(...transform(eastLandPort.parts,355,eastQuayY+.37,portZ+12,.9,0,'referencePort'));
 // A smooth raised approach joins the quay to the mainland bridge junction.
 // Sampling across its full width also prevents the road edges entering a hill.
 const rampStart=portZ-38,rampEnd=bridgeZ,rampCount=Math.ceil((rampStart-rampEnd)/5),ramp=[];
 const rampEndY=height(375,rampEnd)+.45;
 for(let i=0;i<=rampCount;i++){
   const t=i/rampCount,z=rampStart+(rampEnd-rampStart)*t,linear=20.07+(rampEndY-20.07)*t;
   let terrainY=-Infinity;for(const x of [367,371,375,379,383])terrainY=Math.max(terrainY,height(x,z));
   ramp.push({x:375,y:Math.max(linear,terrainY+.30),z});
 }
 function portSlab(a,b,width,thickness,color,material='concrete',role='port-link',group='ports'){
   const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,horizontal=Math.hypot(dx,dz);
   box((a.x+b.x)/2,(a.y+b.y)/2-thickness/2,(a.z+b.z)/2,Math.hypot(horizontal,dy)+.025,thickness,width,color,material,{ry:-Math.atan2(dz,dx),rz:Math.atan2(dy,horizontal),group,role});
 }
 for(let i=0;i<ramp.length-1;i++){
   const a=ramp[i],b=ramp[i+1];portSlab(a,b,16,.3,'#5c6669','road','port-ramp','connection');
   if(i%3===0){const mid={x:375,y:(a.y+b.y)/2+.015,z:(a.z+b.z)/2};box(mid.x,mid.y,mid.z,.2,.025,2.6,'#d5c393','road',{group:'connection',role:'port-ramp-marking'});}
   if(i%5===0){const z=(a.z+b.z)/2,h=(a.y+b.y)/2-.4,base=height(375,z);if(h-base>.7)box(375,(h+base)/2,z,12,h-base,1.5,'#a5ada2','concrete',{group:'connection',role:'ramp-pier'});}
 }
 // Pontoon positions come from the authored pier, including stair length.
 const W={...westPier.boardingPoint};
 const E={x:eastCenter[0]-eastPierRaw.boardingPoint.x,y:eastPierRaw.boardingPoint.y,z:eastCenter[1]-eastPierRaw.boardingPoint.z};
 function floatingDocks(P,dir){
   box(P.x,1.175,P.z-51,4,.25,102,'#ac9878','wood',{group:'ports',role:'floating-spine'});
   for(const dx of [-1.22,1.22])box(P.x+dx,.4,P.z-51,.75,1.4,102,'#344449','metal',{group:'ports',role:'dock-float'});
   for(let z=P.z-4;z>P.z-102;z-=3)box(P.x,1.307,z,3.95,.012,.045,'#7f725d','wood',{group:'ports',role:'dock-plank'});
   // A rail only along the shore-facing side leaves all fingers accessible.
   for(let dz=-7;dz>=-100;dz-=15)box(P.x-dir*1.75,1.82,P.z+dz,.07,1.05,.07,'#c0c8c0','metal',{group:'ports',role:'dock-rail'});
   box(P.x-dir*1.75,2.33,P.z-53.5,.08,.08,93,'#c0c8c0','metal',{group:'ports',role:'dock-rail'});
   for(const dz of [-30,-65,-100]){
     const x=P.x+dir*12,z=P.z+dz;
     box(x,1.175,z,24,.25,4,'#b6a181','wood',{group:'ports',role:'finger-pier'});
     box(x,.4,z,23.7,1.4,2.6,'#344449','metal',{group:'ports',role:'dock-float'});
     for(let n=3;n<24;n+=3)box(P.x+dir*n,1.307,z,.045,.012,3.95,'#81745e','wood',{group:'ports',role:'dock-plank'});
     for(const n of [4,22]){
       box(P.x+dir*n,1.5,z+1.5,.18,.38,.18,'#748582','metal',{group:'ports',role:'dock-cleat'});
       box(P.x+dir*n,1.69,z+1.5,.6,.09,.14,'#748582','metal',{group:'ports',role:'dock-cleat'});
     }
     box(P.x+dir*22,2.1,z-1.6,.1,1.6,.1,'#687b7b','metal',{group:'ports',role:'dock-lamp'});
     box(P.x+dir*22,2.94,z-1.6,.38,.12,.38,'#ffe4ad','lit',{group:'ports',role:'dock-lamp'});
   }
 }
 floatingDocks(W,1);floatingDocks(E,-1);
 const westDock={x:W.x+6,y:0,z:W.z+9},eastDock={x:E.x-6,y:0,z:E.z+9};
 // Short removable gangways span the remaining 0.25–0.45m side gap.
 function gangway(P,boat,type){
   const ferry=type==='ferry',work=type==='workboat',halfBeam=ferry?5.15:work?3.7:1.75;
   const x=ferry?P.x:boat.x+(work?-4:0),edge=ferry?P.z+3.4:boat.z-halfBeam-.25;
   portSlab({x,y:1.31,z:edge-.20},{x,y:ferry?1.2:work?1.38:1.31,z:boat.z-halfBeam+.025},ferry?2:1.3,.09,'#c8bea4','wood','boarding-gangway');
   return {x,y:1.3,z:edge-.5};
 }
 features.push({id:'harbor',name:'해협 여객부두',x:coastX+20,z:portZ,height:25,distance:330,description:'여객 페리 · 고속정 · 항만 작업선'});
 const boats=[
  {id:'ferry-1',type:'ferry',name:'웨스트 링크 페리',x:westDock.x,z:westDock.z,ry:0,scale:1,from:westDock,to:eastDock,speed:17},
  {id:'speed-1',type:'speedboat',name:'고속정 W-01',x:W.x+14,z:W.z-26,ry:0,scale:1,from:{x:W.x+14,y:0,z:W.z-26},to:{x:E.x-14,y:0,z:E.z-26},speed:29},
  {id:'work-1',type:'workboat',name:'포트 서비스 03',x:W.x+14,z:W.z-59.05,ry:0,scale:1,from:{x:W.x+14,y:0,z:W.z-59.05},to:{x:E.x-14,y:0,z:E.z-59.05},speed:11},
  {id:'speed-2',type:'speedboat',name:'고속정 E-02',x:E.x-14,z:E.z-96,ry:PI,scale:1,from:{x:E.x-14,y:0,z:E.z-96},to:{x:W.x+14,y:0,z:W.z-96},speed:29}
 ];
 for(const b of boats){
   const model=root.CityMaritime.buildBoat(b.type);b.width=model.width;b.depth=model.depth;b.height=model.height;
   const direction=Math.sign(b.to.x-b.from.x);
   b.waypoints=[{...b.from},{x:b.from.x+direction*50,y:0,z:b.from.z},{x:b.to.x-direction*50,y:0,z:b.to.z},{...b.to}];
   b.boardingFrom=gangway(direction>0?W:E,b.from,b.type);
   b.boardingTo=gangway(direction>0?E:W,b.to,b.type);
 }
 // A precise sampled old landform is kept as a quiet reference to the right.
 function height(x,z){const n=terrain.grid,st=terrain.step;let fx=Math.max(0,Math.min(n-.001,x/st)),fz=Math.max(0,Math.min(n-.001,z/st)),ix=Math.floor(fx),iz=Math.floor(fz),u=fx-ix,v=fz-iz,a=iz*(n+1)+ix,H=terrain.heights;return(H[a]*(1-u)+H[a+1]*u)*(1-v)+(H[a+n+1]*(1-u)+H[a+n+2]*u)*v;}
 const terrainVertices=[],terrainIndices=[],terrainColors=[];
 for(let j=0;j<=terrain.grid;j++)for(let i=0;i<=terrain.grid;i++){let x=i*terrain.step,z=j*terrain.step,y=terrain.heights[j*(terrain.grid+1)+i];terrainVertices.push(x,y,z);}
 for(let j=0;j<terrain.grid;j++)for(let i=0;i<terrain.grid;i++){const a=j*(terrain.grid+1)+i;terrainIndices.push(a,a+terrain.grid+1,a+1,a+1,a+terrain.grid+1,a+terrain.grid+2);}
 const originalMesh={shape:'mesh',x:0,y:0,z:0,sx:1,sy:1,sz:1,vertices:terrainVertices,indices:terrainIndices,color:'#879577',material:'foliage',group:'original',role:'original-terrain'};parts.push(originalMesh);
 for(const r of reference.roads||[]){const L=Math.hypot(r.x2-r.x1,r.y2-r.y1),steps=Math.ceil(L/18);for(let i=0;i<steps;i++){const t0=i/steps,t1=(i+1)/steps,a=[r.x1+(r.x2-r.x1)*t0,r.y1+(r.y2-r.y1)*t0],b=[r.x1+(r.x2-r.x1)*t1,r.y1+(r.y2-r.y1)*t1];line(a,b,r.primary?10:7,.28,'#9c9f88',(height(...a)+height(...b))/2+.25,'road','original');}}
 for(const b of [...(reference.buildings||[]),...(reference.houses||[]),...(reference.skies||[])]){
   const x=b.x+b.w/2,z=b.y+b.h/2,h=b.hgt||b.top||9,y=b.gy||height(x,z);box(x,y+h/2,z,b.w,h,b.h,'#a7ad9d','concrete',{group:'original',role:'reference-building'});box(x,y+h+.3,z,b.w+1,.6,b.h+1,'#747e75','concrete',{group:'original'});
 }
 for(let i=0;i<420;i++){const x=350+rng()*1280,z=420+rng()*1150,h=height(x,z);if((x>=298&&x<=408&&z>=portZ-40&&z<=portZ+64)||h<3||h>105||x>1000&&z>1050||x>700&&x<1025&&z>850&&z<1180)continue;tree(x,z,9+rng()*7,'original',h);}
 labels.push(...districts.map(d=>({id:d.id,name:d.name,x:d.x,z:d.z,y:80,color:d.color,kind:'district'})),...features.map(d=>({...d,y:70,color:'#d3b778',kind:'feature'})));
 labels.push({id:'mainland',name:'기존 대륙',x:1080,z:1020,y:150,color:'#d2d5bb',kind:'reference'});
 return {name:'lagi Westport',version:'2.0.0',seed:885202611,units:'metres',north:'-Z',ground,center:{x:cx,z:cz},scale,coastline,basePoly,area:area(coastline),originalArea,areaRatio:area(coastline)/originalArea,originalAreaMethod:'4m midpoint grid; original seed 8852026, worldGen 3, land height > 0',source:terrain.source,
  parts,buildings,roads,trees,districts,features,labels,boats,bridge:{...bridge,parts:undefined,x0:bridgeX0,x1:bridgeX1,z:bridgeZ},ports:{west:westDock,east:eastDock},bounds:{xMin:Math.min(...coastline.map(p=>p[0])),xMax:Math.max(...coastline.map(p=>p[0])),zMin:Math.min(...coastline.map(p=>p[1])),zMax:Math.max(...coastline.map(p=>p[1]))},stats:{buildings:buildings.length,types:root.CityBuildings.types.length,boats:boats.length,roads:roads.length,parts:parts.length}};
}
root.CityWorld={create,transform,area,inside};
})(typeof window!=='undefined'?window:globalThis);


/* simulation.js */
/* WESTPORT / living city & fictional arcade response simulation.
 * Deterministic and renderer-independent. Units: metres / seconds; NPC y is
 * feet level. This is a game rule, not a simulation of any real agency. */
(function(root){
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)), mix=(a,b,t)=>a+(b-a)*t;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function random(seed){let s=(seed>>>0)||73017;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function inside(x,z,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function boxBlocks(x,z,b,pad=.6){const t=-(b.rotation||0),dx=x-b.x,dz=z-b.z,c=Math.cos(t),s=Math.sin(t),xx=dx*c+dz*s,zz=-dx*s+dz*c;return Math.abs(xx)<b.width/2+pad&&Math.abs(zz)<b.depth/2+pad;}
function create(world,options={}){
 const initialSeed=options.seed||77321, population=clamp(Math.round(options.population||216),24,500), ground=Number.isFinite(world.ground)?world.ground:8;
 let R=random(initialSeed),time=0,nextId=1,lastContext={},eventId=0;
 const start={x:world.center?.x||-860,y:ground+.36,z:(world.center?.z||1040)+58};
 const sim={player:{...start,hp:100,maxHp:100,dead:false,interior:false,buildingId:null,floor:0},civilians:[],swat:[],responseVehicles:[],incident:null,lastKnown:null,bombers:[],bombs:[],defcon:0,events:[],stats:{population,kills:0,wounded:0,shotsByResponders:0,bombsDropped:0,damageTaken:0,elapsed:0,activeCivilians:population},time:0};
 const peopleById=new Map(), patrolRoutes=[];
 // Rendering hosts can sample perception independently of smooth movement.
 // This private cache is deliberately absent from saved officer records.
 let observationCache=new WeakMap();
 // The city buildings are static. Segment probes used to scan every building
 // for every point; dispatch and eight simultaneous foot routes amplified that
 // cost. Index only the broad phase and retain the original rotated-box test.
 const buildingCells=new Map(),unindexedBuildings=[],buildingCellSize=64;
 let buildingQuery=0;
 for(const b of world.buildings||[]){
   const angle=-(b.rotation||0),c=Math.cos(angle),s=Math.sin(angle);
   const hx=(Math.abs(b.width*c)+Math.abs(b.depth*s))/2,hz=(Math.abs(b.width*s)+Math.abs(b.depth*c))/2;
   if(![b.x,b.z,hx,hz].every(Number.isFinite)){unindexedBuildings.push(b);continue;}
   const entry={building:b,query:0};
   for(let ix=Math.floor((b.x-hx)/buildingCellSize);ix<=Math.floor((b.x+hx)/buildingCellSize);ix++)
     for(let iz=Math.floor((b.z-hz)/buildingCellSize);iz<=Math.floor((b.z+hz)/buildingCellSize);iz++){
       const key=ix+','+iz;let cell=buildingCells.get(key);if(!cell){cell=[];buildingCells.set(key,cell);}cell.push(entry);
     }
 }
 function buildingBlocks(x,z,pad){
   if(!Number.isFinite(pad))return (world.buildings||[]).some(b=>boxBlocks(x,z,b,pad));
   // Padding is applied in both local axes. A rotated box can expand its world
   // bounds by up to sqrt(2)*pad, including across negative-coordinate cells.
   const reach=Math.abs(pad)*Math.SQRT2,query=++buildingQuery;
   for(let ix=Math.floor((x-reach)/buildingCellSize);ix<=Math.floor((x+reach)/buildingCellSize);ix++)
     for(let iz=Math.floor((z-reach)/buildingCellSize);iz<=Math.floor((z+reach)/buildingCellSize);iz++){
       const cell=buildingCells.get(ix+','+iz);if(!cell)continue;
       for(const entry of cell){if(entry.query===query)continue;entry.query=query;if(boxBlocks(x,z,entry.building,pad))return true;}
     }
   return unindexedBuildings.some(b=>boxBlocks(x,z,b,pad));
 }
 function emit(type,more={}){const e={id:++eventId,type,time,...more};sim.events.push(e);if(sim.events.length>200)sim.events.splice(0,sim.events.length-200);return e;}
 function walkable(x,z,ctx=lastContext){if(!Number.isFinite(x)||!Number.isFinite(z))return false;if(world.coastline?.length&&!inside(x,z,world.coastline))return false;if(buildingBlocks(x,z,.6))return false;return !ctx.isWalkable||ctx.isWalkable(x,z);}
 function heightAt(x,z,ctx=lastContext){const y=ctx.floorY?.(x,z);return Number.isFinite(y)?y:ground+.36;}
 function addRoute(a,b){const len=distance(a,b);if(len<12)return;const n=Math.max(2,Math.ceil(len/4));let first=null,last=null;for(let i=0;i<=n;i++){const p={x:mix(a.x,b.x,i/n),z:mix(a.z,b.z,i/n)};if(walkable(p.x,p.z,{})){if(!first)first=p;last=p;}else if(first){if(distance(first,last)>14)patrolRoutes.push({a:first,b:last,length:distance(first,last)});first=null;last=null;}}if(first&&distance(first,last)>14)patrolRoutes.push({a:first,b:last,length:distance(first,last)});}
 for(const road of world.roads||[]){const dx=road.b[0]-road.a[0],dz=road.b[1]-road.a[1],len=Math.hypot(dx,dz);if(len<1)continue;for(const side of [-1,1]){const offset=(road.width||15)/2+2.4,ox=-dz/len*offset*side,oz=dx/len*offset*side;addRoute({x:road.a[0]+ox,z:road.a[1]+oz},{x:road.b[0]+ox,z:road.b[1]+oz});}}
 if(!patrolRoutes.length){const c=world.center||start;for(let i=0;i<12;i++){const z=c.z+(i-6)*8;addRoute({x:c.x-60,z},{x:c.x+60,z});}}
 function makePerson(i){const route=patrolRoutes[i%patrolRoutes.length]||{a:{x:start.x-15,z:start.z},b:{x:start.x+15,z:start.z},length:30},t=R(),direction=R()<.5?-1:1;return{id:'civilian-'+String(i+1).padStart(3,'0'),kind:'civilian',name:'시민 '+String(i+1).padStart(3,'0'),x:mix(route.a.x,route.b.x,t),y:ground+.36,z:mix(route.a.z,route.b.z,t),heading:Math.atan2((route.b.x-route.a.x)*direction,(route.b.z-route.a.z)*direction),hp:100,maxHp:100,dead:false,active:true,indoor:false,buildingId:null,floor:0,variant:i%12,skin:i%5,phase:R()*Math.PI*2,speed:1.05+R()*.7,route,t,direction,pause:R()*1.8,panicUntil:0,wounded:false,deathTime:null,radius:.32,height:1.78};}
 function initialisePeople(){sim.civilians.length=0;peopleById.clear();for(let i=0;i<population;i++){const p=makePerson(i);sim.civilians.push(p);peopleById.set(p.id,p);}}
 // Response knowledge is a copy of a report or an actual observation. It must
 // never hold a reference to sim.player, even while a vehicle is en route.
 const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
 const knownPoint = p => !!p && Number.isFinite(p.x) && Number.isFinite(p.z);
 const responseTypes = new Set(['defcon','incident-reported','dispatch-departed','dispatch-arrived','response-vehicle-hit','response-vehicle-disabled','suspect-spotted','contact-lost','response-shot','swat-breach','swat-defeated','bomber-spawn','bomb-warning','bomb-drop','explosion']);
 const headquarters = (world.buildings || []).find(b => b.type === 'fbi_hq' || b.id === 'fbi_hq');
 const roadEdges = [], roadNodes = [], roadNodeMap = new Map();
 function vehicleLegal(x,z,ctx={},radius=1.55,vehicle=null) {
   if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
   if (world.coastline?.length && !inside(x,z,world.coastline)) return false;
   if (buildingBlocks(x,z,radius)) return false;
   return !ctx.isVehicleWalkable || ctx.isVehicleWalkable(x,z,radius,vehicle);
 }
 function clearSegment(a,b,ctx={},radius=1.55) {
   const n=Math.max(1,Math.ceil(distance(a,b)/2.5));
   for(let i=0;i<=n;i++)if(!vehicleLegal(mix(a.x,b.x,i/n),mix(a.z,b.z,i/n),ctx,radius))return false;
   return true;
 }
 function project(a,b,p) {
   const dx=b.x-a.x,dz=b.z-a.z,ll=dx*dx+dz*dz;
   const t=ll ? clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/ll,0,1) : 0;
   return {x:mix(a.x,b.x,t),z:mix(a.z,b.z,t),t};
 }
 function roadNode(x,z) {
   const key=Math.round(x*1000)+':'+Math.round(z*1000);
   if(roadNodeMap.has(key))return roadNodeMap.get(key);
   const index=roadNodes.length;roadNodeMap.set(key,index);roadNodes.push({x,z,links:[]});return index;
 }
 function buildRoadGraph() {
   const roads=(world.roads||[]).filter(r=>r.a?.length>=2&&r.b?.length>=2&&(r.width||15)>=4.5)
     .map(r=>({a:{x:r.a[0],z:r.a[1]},b:{x:r.b[0],z:r.b[1]},split:[0,1]}))
     .filter(r=>knownPoint(r.a)&&knownPoint(r.b)&&distance(r.a,r.b)>.1);
   for(let i=0;i<roads.length;i++)for(let j=i+1;j<roads.length;j++){
     const A=roads[i],B=roads[j],ax=A.b.x-A.a.x,az=A.b.z-A.a.z,bx=B.b.x-B.a.x,bz=B.b.z-B.a.z;
     const dx=B.a.x-A.a.x,dz=B.a.z-A.a.z,den=ax*bz-az*bx;
     if(Math.abs(den)>1e-6){
       const ta=(dx*bz-dz*bx)/den,tb=(dx*az-dz*ax)/den;
       if(ta>=-1e-6&&ta<=1+1e-6&&tb>=-1e-6&&tb<=1+1e-6){A.split.push(clamp(ta,0,1));B.split.push(clamp(tb,0,1));}
     }else if(Math.abs(dx*az-dz*ax)<1e-4){
       for(const p of [B.a,B.b]){const q=project(A.a,A.b,p);if(distance(q,p)<.01)A.split.push(q.t);}
       for(const p of [A.a,A.b]){const q=project(B.a,B.b,p);if(distance(q,p)<.01)B.split.push(q.t);}
     }
   }
   for(const road of roads){
     const values=[...new Set(road.split.map(t=>Math.round(t*1e8)/1e8))].sort((a,b)=>a-b);
     for(let k=1;k<values.length;k++){
       const a={x:mix(road.a.x,road.b.x,values[k-1]),z:mix(road.a.z,road.b.z,values[k-1])};
       const b={x:mix(road.a.x,road.b.x,values[k]),z:mix(road.a.z,road.b.z,values[k])};
       if(distance(a,b)<.01||!clearSegment(a,b))continue;
       const ai=roadNode(a.x,a.z),bi=roadNode(b.x,b.z),length=distance(a,b),edge=roadEdges.length;
       roadEdges.push({a:ai,b:bi,length});roadNodes[ai].links.push({to:bi,length,edge});roadNodes[bi].links.push({to:ai,length,edge});
     }
   }
 }
 buildRoadGraph();
 function roadCandidates(at) {
   return roadEdges.map((edge,index)=>{const q=project(roadNodes[edge.a],roadNodes[edge.b],at);return {...q,index,distance:distance(at,q)};})
     .sort((a,b)=>a.distance-b.distance);
 }
 function frontOf(b) {
   if(!b)return {x:world.center?.x??start.x,z:world.center?.z??start.z};
   const angle=b.rotation||0,d=(b.depth||46)/2+7;
   return {x:b.x+Math.sin(angle)*d,z:b.z+Math.cos(angle)*d};
 }
 const hqFront=frontOf(headquarters);
 const hqRoad=roadCandidates(hqFront).find(q=>clearSegment(hqFront,q)) || roadCandidates(headquarters||hqFront)[0];
 const dispatchOrigin=hqRoad ? (vehicleLegal(hqFront.x,hqFront.z)&&clearSegment(hqFront,hqRoad)?hqFront:{x:hqRoad.x,z:hqRoad.z}) : hqFront;
 sim.responseHQ={x:dispatchOrigin.x,y:heightAt(dispatchOrigin.x,dispatchOrigin.z,{}),z:dispatchOrigin.z,buildingId:headquarters?.id||null};
 function routeOnRoads(from,reported,foot=false) {
   if(!knownPoint(from)||!knownPoint(reported)||!roadEdges.length)return null;
   const origin=roadCandidates(from).find(q=>clearSegment(from,q,{},foot?.6:1.55));
   if(!origin)return null;
   const edge=roadEdges[origin.index],n=roadNodes.length,cost=Array(n).fill(Infinity),parent=Array(n).fill(-1),done=Array(n).fill(false);
   cost[edge.a]=distance(origin,roadNodes[edge.a]);cost[edge.b]=distance(origin,roadNodes[edge.b]);
   for(let k=0;k<n;k++){
     let u=-1;for(let i=0;i<n;i++)if(!done[i]&&(u<0||cost[i]<cost[u]))u=i;
     if(u<0||!Number.isFinite(cost[u]))break;done[u]=true;
     for(const link of roadNodes[u].links)if(cost[u]+link.length<cost[link.to]){cost[link.to]=cost[u]+link.length;parent[link.to]=u;}
   }
   let best=null;
   for(const q of roadCandidates(reported)){
     const e=roadEdges[q.index],ca=cost[e.a]+distance(roadNodes[e.a],q),cb=cost[e.b]+distance(roadNodes[e.b],q);
     let end=ca<=cb?e.a:e.b,pathCost=Math.min(ca,cb),direct=false;
     if(q.index===origin.index&&distance(origin,q)<=pathCost){pathCost=distance(origin,q);direct=true;}
     if(!Number.isFinite(pathCost))continue;
     // Prefer the street nearest the actual report; never the player's street.
     const score=q.distance+pathCost*.001;
     if(!best||score<best.score)best={q,end,pathCost,direct,score};
   }
   if(!best)return null;
   const out=[{x:from.x,z:from.z},{x:origin.x,z:origin.z}],nodes=[];
   if(!best.direct){for(let at=best.end;at>=0;at=parent[at])nodes.push({x:roadNodes[at].x,z:roadNodes[at].z});out.push(...nodes.reverse());}
   out.push({x:best.q.x,z:best.q.z});
   const points=out.filter((p,i)=>i===0||distance(p,out[i-1])>.02);
   return {points,destination:{x:best.q.x,z:best.q.z},length:points.reduce((s,p,i)=>s+(i?distance(p,points[i-1]):0),0)};
 }
 function shortenRoute(route,amount) {
   const points=route.points.map(p=>({...p}));let remaining=amount;
   while(points.length>1&&remaining>0){const a=points[points.length-2],b=points[points.length-1],len=distance(a,b);if(len<=remaining){remaining-=len;points.pop();}else{points[points.length-1]={x:mix(b.x,a.x,remaining/len),z:mix(b.z,a.z,remaining/len)};remaining=0;}}
   return {...route,points,destination:{...points[points.length-1]}};
 }
 function incidentSnapshot(civilian) {
   return Object.freeze({id:'incident-'+String(civilian.id)+'-'+(++nextId),civilianId:civilian.id,
     x:civilian.x,y:Number.isFinite(civilian.y)?civilian.y:ground+.36,z:civilian.z,
     buildingId:civilian.indoor?civilian.buildingId:null,floor:civilian.indoor?civilian.floor||1:0,time,source:'civilian-death'});
 }
 function assignVehicleRoute(vehicle,incident) {
   const reported=incident.buildingId ? frontOf((world.buildings||[]).find(b=>b.id===incident.buildingId)) : incident;
   let route=routeOnRoads(vehicle,reported);
   if(route&&vehicle.index===1&&route.length>18)route=shortenRoute(route,8.5);
   vehicle.route=route?.points||[{x:vehicle.x,z:vehicle.z}];vehicle.routeIndex=1;
   vehicle.destination=route?.destination||{x:vehicle.x,z:vehicle.z};vehicle.reportId=incident.id;vehicle.blockedFor=0;
   const target=vehicle.route[1];if(target)vehicle.heading=Math.atan2(target.x-vehicle.x,target.z-vehicle.z);
 }
 function newResponse(civilian) {
   observationCache=new WeakMap();
   sim.defcon=1;sim.responseStartedAt=time;sim.incident=incidentSnapshot(civilian);sim.lastKnown=null;
   const n=clamp(Math.round(options.responders||8),1,16),origin=sim.responseHQ;
   for(let index=0;index<2;index++){
     let at={x:origin.x+(index?2.6:-2.6),z:origin.z};
     if(!vehicleLegal(at.x,at.z)||!clearSegment(at,origin))at={x:origin.x,z:origin.z+(index?3.3:-3.3)};
     if(!vehicleLegal(at.x,at.z))at={x:origin.x,z:origin.z};
     const vehicle={id:'response-van-'+(index+1),index,kind:'response-vehicle',...at,y:heightAt(at.x,at.z),heading:0,
       active:true,phase:'preparing',departAt:time+4+index*2.5,maxSpeed:18,speed:0,acceleration:6,blockedFor:0,
       hp:700,maxHp:700,dead:false,radius:1.55,width:2.5,length:6.2,height:2.7,occupants:[]};
     assignVehicleRoute(vehicle,sim.incident);sim.responseVehicles.push(vehicle);
   }
   for(let i=0;i<n;i++){
     const v=sim.responseVehicles[Math.min(1,Math.floor(i/Math.ceil(n/2)))];v.occupants.push('swat-'+(i+1));
     sim.swat.push({id:'swat-'+(i+1),kind:'swat',x:v.x,y:v.y,z:v.z,hp:160,maxHp:160,dead:false,active:false,
       embarked:true,vehicleId:v.id,heading:v.heading,radius:.4,height:1.88,phase:R()*6.28,fireCooldown:1.2+R()*.4,
       speed:4.2,indoor:false,buildingId:null,floor:0,flank:i%2?-1:1,responseState:'embarked',hasVisualContact:false,
       lastSeen:null,observationSequence:0,searchIndex:i,nextSearchAt:0,searchAnchor:null,route:[],routeIndex:0,repathAt:time});
   }
   const target={x:sim.incident.x,z:sim.incident.z};
   sim.bombers.push({id:'bomber-1',kind:'bomber',x:origin.x-380,y:ground+180,z:origin.z,heading:Math.PI/2,
     active:true,speed:118,dropIn:9,pass:0,target});
   emit('defcon',{level:1,cause:'civilian-death',civilianId:civilian.id,responders:n,bombers:1,incident:copy(sim.incident),headquarters:copy(sim.responseHQ)});
   emit('bomber-spawn',{bomberId:'bomber-1'});
 }
 function escalate(civilian) {
   if(!sim.defcon){newResponse(civilian);return;}
   sim.incident=incidentSnapshot(civilian);
   for(const vehicle of sim.responseVehicles)if(vehicle.phase==='preparing'||vehicle.phase==='enroute')assignVehicleRoute(vehicle,sim.incident);
   for(const p of sim.swat)if(!p.dead&&!p.embarked){p.searchAnchor=null;p.repathAt=time;}
   emit('incident-reported',{incident:copy(sim.incident)});
 }
 function safeExit(v,index,ctx) {
   const c=Math.cos(v.heading),s=Math.sin(v.heading),side=index%2?-1:1,rear=(Math.floor(index/2)-.5)*1.8;
   for(const radius of [1.8,2.5,3.2]){
     const at={x:v.x+c*radius*side+s*rear,z:v.z-s*radius*side+c*rear};
     if(walkable(at.x,at.z,ctx))return at;
   }
   return {x:v.x,z:v.z};
 }
 function disembark(v,ctx,disabled=false) {
   v.phase=disabled?'disabled':'arrived';v.speed=0;
   for(let i=0;i<v.occupants.length;i++){
     const p=sim.swat.find(p=>p.id===v.occupants[i]);if(!p||p.dead||!p.embarked)continue;
     p.x=v.x;p.y=v.y;p.z=v.z;p.active=true;p.embarked=false;p.hasVisualContact=false;
     p.responseState='disembarking';p.exitTarget=safeExit(v,i,ctx);p.heading=v.heading;p.fireCooldown=Math.max(1.1,p.fireCooldown||0);
     p.route=[];p.routeIndex=0;p.repathAt=time;p.searchAnchor=null;
   }
   emit(disabled?'response-vehicle-disabled':'dispatch-arrived',{vehicleId:v.id,x:v.x,y:v.y,z:v.z,incidentId:sim.incident?.id});
 }
 function updateResponseVehicles(dt,ctx) {
   for(const v of sim.responseVehicles){
     if(v.phase==='preparing'&&time>=v.departAt){v.phase='enroute';emit('dispatch-departed',{vehicleId:v.id,headquarters:copy(sim.responseHQ)});}
     if(v.phase==='enroute'){
       if(v.routeIndex>=v.route.length){disembark(v,ctx);continue;}
       const next=v.route[v.routeIndex],remaining=distance(v,next);
       const approaching=v.routeIndex===v.route.length-1;
       const desired=approaching?Math.min(v.maxSpeed,Math.max(2,Math.sqrt(2*v.acceleration*remaining))):v.maxSpeed;
       v.speed=Math.min(desired,v.speed+v.acceleration*dt);let budget=v.speed*dt,moved=0;
       while(budget>1e-7&&v.routeIndex<v.route.length){
         const p=v.route[v.routeIndex],len=distance(v,p);
         if(len<.025){v.routeIndex++;continue;}
         const travel=Math.min(budget,len,.8),nx=v.x+(p.x-v.x)/len*travel,nz=v.z+(p.z-v.z)/len*travel;
         const blocked=sim.responseVehicles.some(q=>q!==v&&q.active&&!q.dead&&distance(q,{x:nx,z:nz})<5.4&&distance(q,{x:nx,z:nz})<distance(q,v)-1e-5);
         const heading=Math.atan2(p.x-v.x,p.z-v.z);
         if(blocked||!vehicleLegal(nx,nz,ctx,v.radius||1.55,{...v,heading})){v.speed=0;break;}
         v.heading=heading;v.x=nx;v.z=nz;v.y=heightAt(nx,nz,ctx);moved+=travel;budget-=travel;
         if(travel>=len-.001)v.routeIndex++;
       }
       v.blockedFor=moved>.005?0:(v.blockedFor||0)+dt;
       if(v.routeIndex>=v.route.length)disembark(v,ctx);
       // A genuinely blocked van deploys at its own doors; it never jumps over
       // obstacles or moves responders to the destination by assignment.
       else if(v.blockedFor>4)disembark(v,ctx,true);
     }
     for(const id of v.occupants){const p=sim.swat.find(p=>p.id===id);if(p?.embarked){p.x=v.x;p.y=v.y;p.z=v.z;p.heading=v.heading;}}
   }
 }
 sim.damageResponseVehicle=function(id,amount,source='player'){
   const v=typeof id==='object'?id:sim.responseVehicles.find(v=>v.id===id);
   if(!v||v.dead||!Number.isFinite(amount)||amount<=0)return {hit:false,killed:false};
   v.hp=Math.max(0,v.hp-amount);emit('response-vehicle-hit',{vehicleId:v.id,amount,source});
   if(v.hp===0){v.dead=true;disembark(v,lastContext,true);}
   return {hit:true,killed:v.dead,hp:v.hp};
 };
 // A stopped, intact van can become a native player vehicle. Remove the
 // original registry entry so AI, collision, rendering and saves cannot keep
 // a second hull at the pickup location. Existing officers leave at its doors.
 sim.takeResponseVehicle=function(id){
   const index=sim.responseVehicles.findIndex(v=>v.id===id),v=sim.responseVehicles[index];
   if(!v||v.active===false||v.dead||!(v.hp>0)||Math.abs(v.speed||0)>.75)return null;
   if(v.occupants.some(id=>sim.swat.some(p=>p.id===id&&p.embarked&&!p.dead)))disembark(v,lastContext);
   v.phase='captured';v.active=false;v.speed=0;
   sim.responseVehicles.splice(index,1);
   return v;
 };
 function evidence() {
   return sim.lastKnown&&sim.lastKnown.time>=(sim.incident?.time??-Infinity)?sim.lastKnown:sim.incident;
 }
 function targetOutside(report) {
   if(!report)return null;
   if(report.buildingId){const b=(world.buildings||[]).find(b=>b.id===report.buildingId);if(b)return frontOf(b);}
   return {x:report.x,z:report.z};
 }
 function directFootpath(a,b,ctx) {
   const n=Math.max(1,Math.ceil(distance(a,b)/1.7));
   for(let i=1;i<=n;i++)if(!walkable(mix(a.x,b.x,i/n),mix(a.z,b.z,i/n),ctx))return false;
   return true;
 }
 function setFootRoute(p,target,ctx) {
   if(directFootpath(p,target,ctx)){p.route=[{...target}];p.routeIndex=0;return;}
   const planned=routeOnRoads(p,target,true);
   p.route=planned?planned.points.slice(1):[];p.routeIndex=0;
   if(planned&&directFootpath(planned.destination,target,ctx))p.route.push({...target});
 }
 function walkTo(p,target,dt,ctx) {
   if(!target)return false;
   // A failed route is still a completed attempt. Retrying an empty route on
   // every frame otherwise reruns the full road search for every stuck officer.
   if(!Number.isFinite(p.repathAt)||time>=p.repathAt||!p.navTarget||distance(p.navTarget,target)>6){
     setFootRoute(p,target,ctx);p.navTarget={...target};p.repathAt=time+2;
   }
   while(p.routeIndex<p.route.length&&distance(p,p.route[p.routeIndex])<.5)p.routeIndex++;
   const next=p.route[p.routeIndex];
   if(!next)return false;
   return moveWithCollision(p,next.x-p.x,next.z-p.z,dt,ctx,false);
 }
 function actorHitBlocked(p,ctx) {
   const check=typeof ctx?.isHitBlocked==='function'?ctx.isHitBlocked:options.isHitBlocked;
   return typeof check==='function'&&!!check(p);
 }
 function observationRange(p,ctx) {
   const player=sim.player;
   if(p.embarked||p.active===false||p.dead||player.dead||actorHitBlocked(p,ctx))return null;
   // Entering a building/floor does not reveal it to police outside.
   const sameSpace=p.indoor?player.interior&&p.buildingId===player.buildingId&&p.floor===player.floor:!player.interior;
   if(!sameSpace)return null;
   const d=distance(p,player);if(d>68||Math.abs(p.y-player.y)>5)return null;
   const dot=d>.01?((player.x-p.x)*Math.sin(p.heading)+(player.z-p.z)*Math.cos(p.heading))/d:1;
   if(dot<Math.cos(58*Math.PI/180))return null;
   return d;
 }
 function observe(p,ctx,d=observationRange(p,ctx)) {
   if(d==null)return null;
   const player=sim.player;
   const from={x:p.x,y:p.y+1.45,z:p.z},to={x:player.x,y:player.y+1.35,z:player.z};
   if(typeof ctx.lineOfSight!=='function'||!ctx.lineOfSight(from,to))return null;
   // Persist the sequence with the officer. Unlike a simulation timestamp,
   // this evidence ID does not change when saved clocks are rebased.
   p.observationSequence=(Number.isSafeInteger(p.observationSequence)?p.observationSequence:0)+1;
   return {id:'sighting-'+p.id+'-'+p.observationSequence,x:player.x,y:player.y,z:player.z,buildingId:player.buildingId||null,floor:player.floor||0,
     time,expiresAt:time+12,source:'sighting',observerId:p.id,from,to,distance:d};
 }
 function acceptObservation(p,sight,sampled) {
   const had=p.hasVisualContact===true;p.hasVisualContact=!!sight;
   if(sight){
     if(!had)emit('suspect-spotted',{swatId:p.id,x:sight.x,y:sight.y,z:sight.z});
     // Cached evidence must retain its actual observation time and position.
     // In particular it cannot overwrite a more recent squad member's report.
     if(sampled){const {from,to,distance:range,...record}=sight;p.lastSeen=copy(record);sim.lastKnown=Object.freeze(copy(record));}
   }else if(had)emit('contact-lost',{swatId:p.id,lastKnown:copy(p.lastSeen)});
   return sight;
 }
 function scheduledObservation(p,index,ctx,interval,frameStart,force=false) {
   let cache=observationCache.get(p);
   if(!cache||cache.interval!==interval){
     // Eight officers occupy separate phases within 100ms. At 60Hz this is
     // at most two scheduled LOS checks per frame, with movement still 60Hz.
     cache={interval,nextAt:frameStart+(interval?(index+.5)/Math.max(1,sim.swat.length)*interval:0),sampledAt:-Infinity,sight:null};
     observationCache.set(p,cache);
   }
   // Native unseen-damage suppression can perform its own immediate LOS test
   // and clear contact. Do not resurrect that rejected sight from this cache.
   if(cache.sight&&p.hasVisualContact!==true)cache.sight=null;
   const range=observationRange(p,ctx);
   if(range==null){cache.sight=null;return acceptObservation(p,null,false);}
   const due=!interval||time+1e-9>=cache.nextAt;
   if((due||force)&&cache.sampledAt!==time){
     cache.sight=observe(p,ctx,range);cache.sampledAt=time;
     if(interval&&due)cache.nextAt+=Math.max(1,Math.floor((time+1e-9-cache.nextAt)/interval)+1)*interval;
     return acceptObservation(p,cache.sight,true);
   }
   return acceptObservation(p,cache.sight,false);
 }
 function searchTarget(p,anchor,ctx) {
   const origin=targetOutside(anchor);if(!origin)return null;
   const key=anchor.id||anchor.observerId+'-'+Math.floor(anchor.time);
   if(p.searchAnchor!==key){p.searchAnchor=key;p.searchCenter={...origin};p.searchTarget={...origin};p.nextSearchAt=time+4;p.route=[];p.repathAt=time;}
   const arrived=distance(p,p.searchTarget||origin)<1.2;
   if(time>=p.nextSearchAt&&(arrived||!p.route?.length||p.routeIndex>=p.route.length)){
     p.searchIndex=(p.searchIndex||0)+1;const angle=p.searchIndex*2.3999632297,radius=7+(p.searchIndex%4)*5;
     let chosen=null;
     for(let attempt=0;attempt<8;attempt++){
       const a=angle+attempt*.7,q={x:origin.x+Math.sin(a)*radius,z:origin.z+Math.cos(a)*radius};
       if(walkable(q.x,q.z,ctx)){chosen=q;break;}
     }
     p.searchTarget=chosen||origin;p.nextSearchAt=time+5;p.route=[];p.repathAt=time;
   }
   return p.searchTarget||origin;
 }
 function updateSwat(dt,ctx) {
   // Opt in at the native host. Direct simulation callers keep immediate
   // perception, and a requested interval can never delay detection over 100ms
   // on a running 60Hz update loop.
   const interval=Number.isFinite(ctx.observationInterval)?clamp(ctx.observationInterval,0,.1):0;
   const observed=new Map();
   for(let index=0;index<sim.swat.length;index++){
     const p=sim.swat[index];
     if(p.dead||p.embarked||p.active===false){observationCache.delete(p);p.hasVisualContact=false;continue;}
     const sight=scheduledObservation(p,index,ctx,interval,time-dt);
     if(sight)observed.set(p.id,sight);
   }
   for(let index=0;index<sim.swat.length;index++){
     const p=sim.swat[index];
     if(p.dead||p.embarked||p.active===false||actorHitBlocked(p,ctx))continue;p.fireCooldown-=dt;
     let sight=observed.get(p.id);
     if(p.responseState==='disembarking'&&p.exitTarget){
       moveWithCollision(p,p.exitTarget.x-p.x,p.exitTarget.z-p.z,dt,ctx);
       if(distance(p,p.exitTarget)>.25)continue;p.exitTarget=null;
     }
     // A cached positive can steer towards old evidence, but cannot authorize
     // damage. Every due shot requires this tick's actual unobstructed sight.
     if(sight&&interval&&p.fireCooldown<=0)sight=scheduledObservation(p,index,ctx,interval,time-dt,true);
     if(sight){
       p.responseState='engaging';p.heading=Math.atan2(sight.x-p.x,sight.z-p.z);
       if(sight.distance>23)walkTo(p,sight,dt,ctx);
       if(p.fireCooldown<=0){p.fireCooldown=1+R()*.7;sim.stats.shotsByResponders++;
         emit('response-shot',{swatId:p.id,from:sight.from,to:sight.to});sim.damagePlayer(sight.distance<25?6:4,'swat',{from:sight.from,to:sight.to});}
       continue;
     }
     const report=evidence();if(!report){p.responseState='searching';p.heading+=dt*.65;continue;}
     const freshSighting=report.source==='sighting'&&report.expiresAt>time;
     p.responseState=freshSighting?'investigating':'searching';
     const target=freshSighting?targetOutside(report):searchTarget(p,report,ctx);
     const moved=walkTo(p,target,dt,ctx);
     if(!moved||distance(p,target)<1.4)p.heading+=dt*.7;
   }
 }
 function dropBomb(bomber) {
   if(!knownPoint(bomber.target))return;
   const target={x:bomber.target.x,z:bomber.target.z},fall=2.25,id='bomb-'+nextId++;
   sim.bombs.push({id,kind:'bomb',x:target.x,y:bomber.y,z:target.z,startY:bomber.y,targetY:heightAt(target.x,target.z),target,
     remaining:fall,total:fall,radius:24,warningRadius:31,active:true});sim.stats.bombsDropped++;
   emit('bomb-warning',{bombId:id,x:target.x,z:target.z,seconds:fall,radius:31});emit('bomb-drop',{bomberId:bomber.id,bombId:id});
 }
 function updateBombers(dt) {
   const report=evidence();
   for(const b of sim.bombers){
     if(!b.active)continue;
     const target=knownPoint(b.target)?b.target:(report?{x:report.x,z:report.z}:{x:b.x,z:b.z});
     // Flight is continuous, including turns between passes. Neither aircraft
     // placement nor bomb target is corrected to an unseen player location.
     const phase=(time-(sim.responseStartedAt||0))*.08,bend=130;
     const aim={x:target.x+Math.sin(phase)*bend,z:target.z+Math.cos(phase)*bend};
     const desired=Math.atan2(aim.x-b.x,aim.z-b.z),delta=Math.atan2(Math.sin(desired-b.heading),Math.cos(desired-b.heading));
     b.heading+=clamp(delta,-dt*.8,dt*.8);b.x+=Math.sin(b.heading)*b.speed*dt;b.z+=Math.cos(b.heading)*b.speed*dt;b.dropIn-=dt;
     if(b.dropIn<=0){
       // Freeze this pass at the newest report/visual evidence. Subsequent
       // hidden movement cannot drag the warning or falling bomb.
       if(report)b.target={x:report.x,z:report.z};dropBomb(b);b.pass++;b.dropIn=10.5;
     }
   }
 }
 sim.responseStatus=function(){
   if(!sim.defcon)return 'clear';
   if(sim.swat.some(p=>!p.dead&&!p.embarked&&p.hasVisualContact))return 'contact';
   if(sim.responseVehicles.some(v=>v.phase==='enroute'))return 'enroute';
   if(sim.responseVehicles.some(v=>v.phase==='preparing'))return 'preparing';
   return 'searching';
 };
 sim.clearResponse=function(){
   observationCache=new WeakMap();
   sim.defcon=0;sim.responseStartedAt=null;sim.incident=null;sim.lastKnown=null;
   sim.swat.length=0;sim.responseVehicles.length=0;sim.bombers.length=0;sim.bombs.length=0;
   for(let i=sim.events.length-1;i>=0;i--)if(responseTypes.has(sim.events[i].type)||sim.events[i].type==='player-hit'&&['swat','bomber'].includes(sim.events[i].source))sim.events.splice(i,1);
 };
 sim.serializeResponse=()=>({version:1,incident:copy(sim.incident),lastKnown:copy(sim.lastKnown),responseVehicles:copy(sim.responseVehicles)});
 sim.restoreResponse=function(data,oldTime=0){
   observationCache=new WeakMap();
   if(!sim.defcon){sim.clearResponse();return;}
   const shift=Number.isFinite(oldTime)?oldTime:0;
   const restoreEvidence=p=>{
     if(!knownPoint(p))return null;const q=copy(p);
     if(q.source==='sighting'&&!q.id)q.id='sighting-saved-'+(q.observerId||'unknown')+'-'+String(q.time??0)+'-'+q.x+':'+q.z;
     q.time=(Number.isFinite(q.time)?q.time:shift)-shift;
     if(Number.isFinite(q.expiresAt))q.expiresAt-=shift;return Object.freeze(q);
   };
   if(data?.version===1&&knownPoint(data.incident)&&Array.isArray(data.responseVehicles)){
     sim.incident=restoreEvidence(data.incident);sim.lastKnown=restoreEvidence(data.lastKnown);
     const legacySearchKey=data.lastKnown&&!data.lastKnown.id ? data.lastKnown.observerId+'-'+Math.floor(data.lastKnown.time) : null;
     sim.responseVehicles.splice(0,sim.responseVehicles.length,...copy(data.responseVehicles).filter(knownPoint).map(v=>{
       v.departAt=(Number.isFinite(v.departAt)?v.departAt:shift)-shift;v.occupants=Array.isArray(v.occupants)?v.occupants:[];
       v.route=Array.isArray(v.route)?v.route.filter(knownPoint):[];v.routeIndex=clamp(v.routeIndex||0,0,v.route.length);return v;
     }));
     for(const p of sim.swat){
       p.lastSeen=restoreEvidence(p.lastSeen);if(Number.isFinite(p.nextSearchAt))p.nextSearchAt-=shift;
       if(legacySearchKey&&p.searchAnchor===legacySearchKey)p.searchAnchor=sim.lastKnown.id;
       // hasVisualContact is re-established only by a fresh LOS test.
       p.hasVisualContact=false;
       if(p.embarked){const v=sim.responseVehicles.find(v=>v.id===p.vehicleId);if(v){p.x=v.x;p.y=v.y;p.z=v.z;p.active=false;}else{p.embarked=false;p.active=!p.dead;p.responseState='searching';}}
     }
   }else{
     // Legacy saves contain omniscient/teleported SWAT and no dispatch data.
     // Migrate from a recorded casualty, retaining damage/deaths by stable ID.
     const oldUnits=sim.swat.map(copy),victims=sim.civilians.filter(p=>p.dead&&knownPoint(p));
     const victim=victims.sort((a,b)=>(b.deathTime??-Infinity)-(a.deathTime??-Infinity))[0];
     const report=victim||{id:'legacy-report',x:sim.responseHQ.x,y:sim.responseHQ.y,z:sim.responseHQ.z,indoor:false};
     const oldAge=sim.responseStartedAt;sim.swat.length=0;sim.responseVehicles.length=0;sim.bombers.length=0;sim.bombs.length=0;newResponse(report);sim.responseStartedAt=oldAge??time;
     for(const p of sim.swat){const old=oldUnits.find(q=>q.id===p.id);if(old){p.hp=Math.max(0,Math.min(p.maxHp,Number.isFinite(old.hp)?old.hp:p.hp));p.dead=old.dead||p.hp===0;if(p.dead){p.active=false;p.embarked=false;p.deathTime=old.deathTime??time;}}}
   }
   // Relative countdowns (fireCooldown, dropIn, remaining) are unchanged.
   // Runtime already rebases repathAt/deathTime in its generic person loader.
 };

 sim.damageCivilian=function(id,amount,source='player'){const p=typeof id==='object'?id:peopleById.get(id);if(!p||p.dead||!Number.isFinite(amount)||amount<=0)return{hit:false,killed:false,triggered:false,hp:p?.hp??null};const was=p.hp;p.hp=Math.max(0,p.hp-amount);p.panicUntil=time+9;if(!p.wounded&&p.hp>0){p.wounded=true;sim.stats.wounded++;}const killed=was>0&&p.hp===0,pre=sim.defcon;if(killed){p.dead=true;p.deathTime=time;p.active=true;if(source==='player')sim.stats.kills++;emit('civilian-death',{civilianId:p.id,x:p.x,y:p.y,z:p.z,source});if(source==='player')escalate(p);}else emit('civilian-injured',{civilianId:p.id,hp:p.hp,source});return{hit:true,killed,triggered:!pre&&!!sim.defcon,hp:p.hp};};
 sim.damageSwat=function(id,amount,source='player'){const p=typeof id==='object'?id:sim.swat.find(a=>a.id===id);if(!p||p.dead||!Number.isFinite(amount)||amount<=0)return{hit:false,killed:false};p.hp=Math.max(0,p.hp-amount);if(p.hp===0){p.dead=true;p.deathTime=time;emit('swat-defeated',{swatId:p.id,source});}return{hit:true,killed:p.dead,hp:p.hp};};
 sim.damagePlayer=function(amount,source='unknown',details={}){if(sim.player.dead||!Number.isFinite(amount)||amount<=0)return 0;const dealt=Math.min(sim.player.hp,amount);sim.player.hp=Math.max(0,sim.player.hp-amount);sim.stats.damageTaken+=dealt;emit('player-hit',{amount:dealt,source,hp:sim.player.hp,from:details.from,to:details.to,eqExplosion:details.eqExplosion===true});if(sim.player.hp===0){sim.player.dead=true;emit('player-death',{source});}return dealt;};
 function moveWithCollision(p,dx,dz,dt,ctx,indoor=false){if(p.dead||actorHitBlocked(p,ctx))return false;const step=p.speed*dt,len=Math.hypot(dx,dz);if(len<.01)return false;const xx=dx/len*Math.min(len,step),zz=dz/len*Math.min(len,step);let moved=false;const legal=(x,z)=>indoor?(ctx.isInteriorWalkable?ctx.isInteriorWalkable(x,z,p):true):walkable(x,z,ctx);if(legal(p.x+xx,p.z)){p.x+=xx;moved=true;}if(legal(p.x,p.z+zz)){p.z+=zz;moved=true;}if(!moved&&!indoor){for(const s of [p.flank||1,-(p.flank||1)]){const bx=-dz/len*step*s,bz=dx/len*step*s;if(legal(p.x+bx,p.z+bz)){p.x+=bx;p.z+=bz;moved=true;break;}}}p.heading=Math.atan2(dx,dz);if(!indoor)p.y=heightAt(p.x,p.z,ctx);p.phase+=(moved?dt*8:dt*.4);return moved;}
 function updatePeople(dt,ctx){let active=0;for(const p of sim.civilians){if(!p.active)continue;active++;if(p.dead||p.officeStaff||actorHitBlocked(p,ctx))continue;if(p.pause>0){p.pause-=dt;continue;}if(p.indoor){const points=p.waypoints||[];if(!points.length)continue;const target=points[p.waypointIndex%points.length];if(distance(p,target)<.65){p.waypointIndex=(p.waypointIndex+1)%points.length;p.pause=.4+R()*2;continue;}const old=p.speed;p.speed=time<p.panicUntil?2.8:old;moveWithCollision(p,target.x-p.x,target.z-p.z,dt,ctx,true);p.speed=old;continue;}const len=p.route.length,speed=time<p.panicUntil?3.1:p.speed;p.t+=p.direction*speed*dt/len;if(p.t>=1||p.t<=0){p.t=clamp(p.t,0,1);p.direction*=-1;p.pause=time<p.panicUntil?0:1+R()*3;}const x=mix(p.route.a.x,p.route.b.x,p.t),z=mix(p.route.a.z,p.route.b.z,p.t);if(!ctx.isWalkable||ctx.isWalkable(x,z)){p.x=x;p.z=z;p.y=heightAt(x,z,ctx);}else{p.direction*=-1;p.t=clamp(p.t+p.direction*speed*dt/len*2,0,1);}p.heading=Math.atan2((p.route.b.x-p.route.a.x)*p.direction,(p.route.b.z-p.route.a.z)*p.direction);p.phase+=dt*speed*5;}sim.stats.activeCivilians=active;}
 function updateBombs(dt,ctx){for(const b of sim.bombs){if(!b.active)continue;b.remaining-=dt;const t=clamp(1-b.remaining/b.total,0,1);b.y=mix(b.startY,b.targetY,t*t*.45+t*.55);if(b.remaining<=0){b.active=false;b.explodedAt=time;const d=distance(b,sim.player),covered=!!sim.player.interior;if(d<b.radius){const damage=(125*(1-d/b.radius)+15)*(covered?.5:1);sim.damagePlayer(damage,'bomber',{from:{x:b.x,y:b.targetY,z:b.z},eqExplosion:true});}emit('explosion',{bombId:b.id,x:b.x,y:b.targetY,z:b.z,radius:b.radius,covered});}}while(sim.bombs.length>24&&!sim.bombs[0].active)sim.bombs.shift();}
 sim.step=function(dt,context={}){if(!Number.isFinite(dt)||dt<=0||context.paused)return sim;dt=Math.min(dt,.25);lastContext=context;if(context.player){const p=context.player;for(const k of ['x','y','z'])if(Number.isFinite(p[k]))sim.player[k]=p[k];for(const k of ['interior','buildingId','floor'])if(p[k]!==undefined)sim.player[k]=p[k];}if(sim.player.dead)return sim;time+=dt;sim.time=time;sim.stats.elapsed=time;const peopleDelta=Number.isFinite(context.civilianDelta)?Math.max(0,context.civilianDelta):dt;if(peopleDelta>0)updatePeople(Math.min(.5,peopleDelta),context);if(sim.defcon){updateResponseVehicles(dt,context);updateSwat(dt,context);updateBombers(dt);updateBombs(dt,context);}return sim;};
 sim.activateInterior=function(spec){for(const p of sim.civilians)if(p.indoor)p.active=false;if(!spec){sim.stats.activeCivilians=sim.civilians.filter(p=>p.active).length;return[];}const {buildingId,floor}=spec,out=[];for(let i=0;i<(spec.people||[]).length;i++){const data=spec.people[i],id='indoor-'+buildingId+'-'+floor+'-'+i;let p=peopleById.get(id);if(!p){p={id,kind:'civilian',name:data.name||'실내 시민',x:data.x,y:data.y,z:data.z,hp:100,maxHp:100,dead:false,active:true,indoor:true,buildingId,floor,variant:i%12,skin:i%5,heading:data.heading||0,phase:R()*6.28,speed:.8+R()*.4,pause:R()*2,panicUntil:0,wounded:false,deathTime:null,radius:.32,height:1.78,waypoints:data.waypoints||[],waypointIndex:0};peopleById.set(id,p);sim.civilians.push(p);}p.active=true;out.push(p);}sim.stats.activeCivilians=sim.civilians.filter(p=>p.active).length;return out;};
 sim.drainEvents=function(){return sim.events.splice(0,sim.events.length);};
 sim.getCivilian=id=>peopleById.get(id)||null;
 sim.routes=patrolRoutes;
 sim.isWalkable=(x,z)=>walkable(x,z,{});
 sim.reset=function(position){R=random(initialSeed);time=0;nextId=1;lastContext={};eventId=0;Object.assign(sim.player,start,position||{},{hp:100,maxHp:100,dead:false,interior:false,buildingId:null,floor:0});sim.defcon=0;sim.time=0;sim.responseStartedAt=null;sim.events.length=0;sim.clearResponse();Object.assign(sim.stats,{population,kills:0,wounded:0,shotsByResponders:0,bombsDropped:0,damageTaken:0,elapsed:0,activeCivilians:population});initialisePeople();emit('reset');return sim;};
 initialisePeople();return sim;
}
function createModels(){
 const B=(x,y,z,sx,sy,sz,color,role,extra={})=>({shape:'box',x,y,z,sx,sy,sz,color,material:role==='visor'?'glass':'concrete',role,...extra});
 const C=(x,y,z,sx,sy,sz,color,role,extra={})=>({shape:'cylinder',x,y,z,sx,sy,sz,color,material:'metal',role,...extra});
 const S=(x,y,z,sx,sy,sz,color,role)=>({shape:'sphere',x,y,z,sx,sy,sz,color,material:'concrete',role});
 const people=[];
 const colors=['#d9a25f','#617b92','#87966b','#b46c60','#9699a7','#c7b89c','#5b8e8c','#a97d93','#6e8096','#bd9273','#7e918b','#b2a777'],skins=['#bf8c6b','#dfb992','#825d47','#c79b7a','#e5c5a7'];
 function human(tactical=false,variant=0){const skin=skins[variant%skins.length],cloth=tactical?'#253b48':colors[variant%colors.length],pants=tactical?'#1e3039':'#3c4a57',parts=[B(-.12,.43,0,.18,.76,.21,pants,'leg-left'),B(.12,.43,0,.18,.76,.21,pants,'leg-right'),B(-.12,.08,.045,.2,.15,.36,'#273136','foot-left'),B(.12,.08,.045,.2,.15,.36,'#273136','foot-right'),B(0,1.03,0,.52,.62,.28,cloth,'torso'),S(0,1.52,0,.34,.38,.33,skin,'head'),B(-.35,1.02,0,.15,.59,.18,cloth,'arm-left'),B(.35,1.02,0,.15,.59,.18,cloth,'arm-right'),B(-.35,.71,.015,.14,.16,.16,skin,'hand-left'),B(.35,.71,.015,.14,.16,.16,skin,'hand-right'),S(0,1.64,-.035,.35,.17,.31,tactical?'#1a2b34':'#453c33','headwear')];if(tactical){parts.push(B(0,1.06,.17,.48,.49,.13,'#15252f','armor'),B(0,1.28,.245,.26,.09,.015,'#9aafba','insignia'),B(0,1.57,.15,.28,.12,.07,'#263d48','visor'),B(.2,.98,.38,.12,.15,.64,'#1f292e','weapon'),C(.2,1.01,.78,.052,.25,.052,'#39474e','weapon',{rx:Math.PI/2}),B(-.31,.87,.18,.12,.12,.16,'#252f36','radio'));}else if(variant%3===0)parts.push(B(0,1.03,-.23,.34,.4,.2,'#8c7c62','bag'));return{parts,width:.85,depth:tactical?1.0:.7,height:1.84};}
 for(let i=0;i<12;i++)people.push(human(false,i));
 const bomber=[B(0,0,0,2.5,1.35,20,'#394f5c','fuselage'),C(0,.08,9.8,2.1,4.2,2.1,'#455e6d','nose',{rx:Math.PI/2}),B(0,.9,5.8,1.65,.72,3.4,'#233e50','cockpit'),B(-7.8,-.13,-.5,15,.3,4.8,'#4a6270','wing',{ry:-.24}),B(7.8,-.13,-.5,15,.3,4.8,'#4a6270','wing',{ry:.24}),B(-4,.08,-8,7.7,.22,2.6,'#425a68','tail',{ry:.2}),B(4,.08,-8,7.7,.22,2.6,'#425a68','tail',{ry:-.2}),B(-1.1,1.3,-8.1,.2,3.1,3.6,'#334c5c','tail-fin',{rz:-.2}),B(1.1,1.3,-8.1,.2,3.1,3.6,'#334c5c','tail-fin',{rz:.2}),C(-3.7,-.52,-1.8,1.4,5.4,1.4,'#253943','engine',{rx:Math.PI/2}),C(3.7,-.52,-1.8,1.4,5.4,1.4,'#253943','engine',{rx:Math.PI/2}),B(-14.2,-.1,-2.6,.32,.22,.6,'#b85c4c','navigation'),B(14.2,-.1,-2.6,.32,.22,.6,'#79b5a0','navigation')];
 const bomb=[C(0,0,0,.6,1.65,.6,'#455c5d','body'),S(0,-.8,0,.59,.6,.59,'#263d44','nose'),B(0,.8,0,1.05,.4,.1,'#63797a','fin'),B(0,.8,0,.1,.4,1.05,'#63797a','fin')];
 return{civilian:people[0],civilians:people,swat:human(true,2),bomber:{parts:bomber,width:30,depth:23,height:5},bomb:{parts:bomb,width:1.1,depth:1.1,height:2.2}};
}
root.CitySimulation={create,createModels,version:'3.0.0',rule:'DEFCON triggers only on a living civilian becoming dead from player damage.'};
})(typeof window!=='undefined'?window:globalThis);


