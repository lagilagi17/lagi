/* Approved HanQ 50 redesigns: 16 authored vehicles, semantic motion and cached PBR geometry. */
(function(global){'use strict';
const VEHICLE_DEFINITIONS={"vehicle-buggy":{"kind":"vehicle-buggy","hqVisual":"vehicle-buggy","name":"버기카","frontAxis":"+X","length":3.384999990463257,"width":2.117845444883324,"height":1.920034984996135,"bounds":{"min":[-1.7549999952316284,1.9619648794488853e-8,-1.058922722441662],"max":[1.6299999952316284,1.9200350046157837,1.058922722441662]},"groundOffset":0,"groundAligned":false,"groundShift":0,"wheelRadius":0.4683012242406217,"wheelbase":2.0792574356283606,"collisionRadius":1.0165658135439954,"collisionOffset":0.675934181687633,"hitHeight":1.9200350046157837,"cameraDistance":7.5,"cameraHeight":2.1,"driverSeat":{"forward":-0.37157880799881027,"height":0.8752550012885261,"left":0.31844483248362276},"driverPose":{"scale":0.7867460567242445,"recline":0.06,"hipDrop":0},"anchors":{"driverSeat":[-0.37157880799881027,0.8752550012885261,-0.31844483248362276],"entry":[-0.37157880799881027,0.24351664978792745,-1.1613870361167418]}},"vehicle-fighter":{"kind":"vehicle-fighter","hqVisual":"vehicle-fighter","name":"적 전투기","frontAxis":"+X","length":7.177821636199951,"width":9.394234657287598,"height":2.9548659313075296,"bounds":{"min":[-3.386340618133545,-1.0970560300700418,-4.697117328643799],"max":[3.7914810180664062,1.8578099012374878,4.697117328643799]},"groundOffset":0,"groundAligned":false,"groundShift":0,"wheelRadius":0.36297453405268665,"wheelbase":3.6478940672295,"collisionRadius":4.509232635498047,"collisionOffset":0,"hitHeight":1.8578099012374878,"cameraDistance":9.331168127059938,"cameraHeight":2.304795426419873,"driverSeat":{"forward":0.08006638365053564,"height":0.7937961851219186,"left":0},"driverPose":{"scale":0.8166927016185449,"recline":0.06,"hipDrop":0},"anchors":{"driverSeat":[0.08006638365053564,0.7937961851219186,0],"muzzle":[1.7951210570494798,0.2947062007994745,-1.6152366765344555]}},"vehicle-gunboat":{"kind":"vehicle-gunboat","hqVisual":"vehicle-gunboat","name":"고속 포함","frontAxis":"+X","length":16.489999771118164,"width":4.163846492767334,"height":6.789421081542969,"bounds":{"min":[-7.989999771118164,-0.5,-2.081923246383667],"max":[8.5,6.289421081542969,2.081923246383667]},"groundOffset":0,"groundAligned":false,"groundShift":0,"wheelRadius":0.5,"wheelbase":9.893999862670897,"collisionRadius":1.9986463165283201,"collisionOffset":6.246353569030762,"hitHeight":6.289421081542969,"cameraDistance":21.436999702453615,"cameraHeight":5.295748443603515,"driverSeat":{"forward":0.4436328479330145,"height":1.9085099410482986,"left":0.49538960269097515},"driverPose":{"scale":0.8920407206572224,"recline":0.06,"hipDrop":0},"anchors":{"driverSeat":[0.4436328479330145,1.9085099410482986,-0.49538960269097515],"muzzle":[8.065625227770838,2.5131153183826385,0.0001885754519261873],"weaponMount":[4.804720815590546,1.9580677588625888,0.0001885754519261873],"waterline":[0.3445172123044342,0.12442849973385384,0.0001885754519261873]}},"vehicle-patrol-boat":{"kind":"vehicle-patrol-boat","hqVisual":"vehicle-patrol-boat","name":"적 경비정","frontAxis":"+X","length":12.745620727539062,"width":3.185864210128784,"height":5.433514595031738,"bounds":{"min":[-6.105620861053467,-0.5,-1.592932105064392],"max":[6.639999866485596,4.933514595031738,1.592932105064392]},"groundOffset":0,"groundAligned":false,"groundShift":0,"wheelRadius":0.5,"wheelbase":7.647372436523437,"collisionRadius":1.5292148208618164,"collisionOffset":4.843595542907715,"hitHeight":4.933514595031738,"cameraDistance":16.569306945800783,"cameraHeight":4.238141384124756,"driverSeat":{"forward":0.45752423957065186,"height":1.5028648879307394,"left":0.3965484633001145},"driverPose":{"scale":0.8923655525535582,"recline":0.06,"hipDrop":0},"anchors":{"driverSeat":[0.45752423957065186,1.5028648879307394,-0.3965484633001145],"weaponMount":[3.908004376111077,1.7804897265029571,0.00005844894591133798],"waterline":[0.3583725115091454,0.015588967008142274,0.00005844894591133798]}},"vehicle-tank":{"kind":"vehicle-tank","hqVisual":"vehicle-tank","name":"적 전차","frontAxis":"+X","length":7.965433169529987,"width":3.849435806274414,"height":2.6519416069919375,"bounds":{"min":[-3.4000000953674316,0.02500000037252903,-1.924717903137207],"max":[4.565433074162556,2.6769416073644665,1.924717903137207]},"groundOffset":0,"groundAligned":false,"groundShift":0,"wheelRadius":0.5,"wheelbase":4.779259901717992,"collisionRadius":1.8477291870117187,"collisionOffset":2.134987397753275,"hitHeight":2.6769416073644665,"cameraDistance":10.355063120388984,"cameraHeight":2.1,"driverSeat":null,"driverPose":{"scale":0.8748717653859561,"recline":0.06,"hipDrop":0},"anchors":{"muzzle":[4.5654330318089595,2.1228561561372126,-3.6212791654222087e-9]}},"vehicle-apc":{"kind":"vehicle-apc","hqVisual":"vehicle-apc","name":"적 장갑차","frontAxis":"+X","length":6.613367795944214,"width":3.2676806932851865,"height":3.632687748943917,"bounds":{"min":[-2.9000000953674316,0.030000029528983396,-1.6338403466425933],"max":[3.7133677005767822,3.6626877784729004,1.6338403466425933]},"groundOffset":0,"groundAligned":false,"groundShift":0,"wheelRadius":0.6113996787405521,"wheelbase":3.0870672303621323,"collisionRadius":1.5684867327768894,"collisionOffset":1.7381971651952175,"hitHeight":3.6626877784729004,"cameraDistance":8.597378134727478,"cameraHeight":2.833496444176255,"driverSeat":null,"driverPose":{"scale":0.9020650997811425,"recline":0.06,"hipDrop":0},"anchors":{"muzzle":[2.9985033633926954,2.74842331279055,0]}},"vehicle-sedan":{"kind":"vehicle-sedan","hqVisual":"vehicle-sedan","name":"주차 세단","frontAxis":"+X","length":4.644999980926514,"width":2.205747879404616,"height":1.5785522608463283,"bounds":{"min":[-2.299999952316284,0,-1.102873939702308],"max":[2.3450000286102295,1.5785522608463283,1.102873939702308]},"groundOffset":0,"groundAligned":true,"groundShift":-0.389999970942307,"wheelRadius":0.4164645845275085,"wheelbase":2.7543453203978405,"collisionRadius":1.0587589821142156,"collisionOffset":1.2637410083490412,"hitHeight":1.5785522608463283,"cameraDistance":7.5,"cameraHeight":2.1,"driverSeat":{"forward":-0.16561895463822868,"height":0.8227636616865255,"left":0.4069994803337015},"driverPose":{"scale":0.7572083355045609,"recline":0.5,"hipDrop":0},"anchors":{"driverSeat":[-0.16561895463822868,0.8227636616865255,-0.4069994803337015],"entry":[-0.16561895463822868,0.0963169148118373,-1.2777890661639466]}},"vehicle-bus":{"kind":"vehicle-bus","hqVisual":"vehicle-bus","name":"도시 버스","frontAxis":"+X","length":8.360740184783936,"width":3.5641205310821533,"height":3.303506029510894,"bounds":{"min":[-4.139999866485596,0,-1.7820602655410767],"max":[4.22074031829834,3.303506029510894,1.7820602655410767]},"groundOffset":0,"groundAligned":true,"groundShift":-0.46199999961813465,"wheelRadius":0.4997311735794862,"wheelbase":5.0161695159299375,"collisionRadius":1.7107778549194335,"collisionOffset":2.4695922374725345,"hitHeight":3.303506029510894,"cameraDistance":10.868962240219117,"cameraHeight":2.5767347030184973,"driverSeat":{"forward":3.0542431831087757,"height":1.107988883882543,"left":0.7731689855380729},"driverPose":{"scale":0.8108845458082229,"recline":0.06,"hipDrop":0},"anchors":{"driverSeat":[3.0542431831087757,1.107988883882543,-0.7731689855380729],"entry":[3.4502565659453497,0.4248657984894527,1.5463379710761458]}},"vehicle-bomber":{"kind":"vehicle-bomber","hqVisual":"vehicle-bomber","name":"웨스트포트 폭격기","frontAxis":"+X","length":21.819541931152344,"width":31.31104278564453,"height":7.789116092806992,"bounds":{"min":[-9.979252815246582,-1.2199999772369234,-15.655521392822266],"max":[11.840289115905762,6.569116115570068,15.655521392822266]},"groundOffset":0,"groundAligned":false,"groundShift":0,"wheelRadius":0.41853848133033855,"wheelbase":8.225967213634664,"collisionRadius":15.029300537109375,"collisionOffset":0,"hitHeight":6.569116115570068,"cameraDistance":28.36540451049805,"cameraHeight":6.075510552389455,"driverSeat":{"forward":8.765717537991453,"height":1.5385851778561066,"left":3.0234197726143913e-15},"driverPose":{"scale":0.8926176142116224,"recline":0.06,"hipDrop":0},"anchors":{"driverSeat":[8.765717537991453,1.5385851778561066,-3.0234197726143913e-15]}},"vehicle-speedboat":{"kind":"vehicle-speedboat","hqVisual":"vehicle-speedboat","name":"해협 고속 모터보트","frontAxis":"+X","length":10.675000190734863,"width":3.3784754276275635,"height":2.3786096572875977,"bounds":{"min":[-5.675000190734863,-0.8500000238418579,-1.6892377138137817],"max":[5,1.5286096334457397,1.6892377138137817]},"groundOffset":0,"groundAligned":false,"groundShift":0,"wheelRadius":0.5,"wheelbase":6.405000114440917,"collisionRadius":1.6216682052612303,"collisionOffset":3.7158318901062013,"hitHeight":1.5286096334457397,"cameraDistance":13.877500247955323,"cameraHeight":2.1,"driverSeat":{"forward":-0.9513509067238921,"height":0.821303708950017,"left":0.6331074699509939},"driverPose":{"scale":0.9185791575346591,"recline":0.06,"hipDrop":0},"anchors":{"driverSeat":[-0.9513509067238921,0.821303708950017,-0.6331074699509939],"entry":[-1.6862142327516194,0.5278687002931121,-1.735402458992585],"waterline":[-0.25731332103103854,-0.1355495801485862,-0.00030849476045091695]}},"vehicle-workboat":{"kind":"vehicle-workboat","hqVisual":"vehicle-workboat","name":"항만 작업선","frontAxis":"+X","length":20,"width":6.925874710083008,"height":9.144936919212341,"bounds":{"min":[-10,-1.899999976158142,-3.462937355041504],"max":[10,7.244936943054199,3.462937355041504]},"groundOffset":0,"groundAligned":false,"groundShift":0,"wheelRadius":0.5,"wheelbase":12,"collisionRadius":3.3244198608398436,"collisionOffset":6.675580139160156,"hitHeight":7.244936943054199,"cameraDistance":26,"cameraHeight":7.133050796985627,"driverSeat":{"forward":4.820691341834925,"height":1.7798549838830258,"left":0.8942211936673464},"driverPose":{"scale":0.895099843609558,"recline":0.06,"hipDrop":0},"anchors":{"driverSeat":[4.820691341834925,1.7798549838830258,-0.8942211936673464],"waterline":[0.14628104742945514,-0.20925577969376974,0.0008786499422115401]}},"vehicle-ferry":{"kind":"vehicle-ferry","hqVisual":"vehicle-ferry","name":"웨스트포트 여객 페리","frontAxis":"+X","length":36.70000076293945,"width":9.755921363830566,"height":11.459984302520752,"bounds":{"min":[-18.700000762939453,-2.6500000953674316,-4.877960681915283],"max":[18,8.80998420715332,4.877960681915283]},"groundOffset":0,"groundAligned":false,"groundShift":0,"wheelRadius":0.5,"wheelbase":22.020000457763672,"collisionRadius":4.682842254638672,"collisionOffset":13.667158126831055,"hitHeight":8.80998420715332,"cameraDistance":47.71000099182129,"cameraHeight":8.938787755966187,"driverSeat":{"forward":9.827598110283109,"height":4.6691497300952705,"left":0.9028956729472235},"driverPose":{"scale":0.9023609314915768,"recline":0.06,"hipDrop":0},"anchors":{"driverSeat":[9.827598110283109,4.6691497300952705,-0.9028956729472235],"waterline":[-0.0983721361242349,-0.44422888169033037,-0.0005347414556466923]}},"vehicle-deck-tractor":{"kind":"vehicle-deck-tractor","hqVisual":"vehicle-deck-tractor","name":"갑판 항공기 견인차","frontAxis":"+X","length":5.355000019073486,"width":2.4863381385803223,"height":2.337552426757347,"bounds":{"min":[-2.4049999713897705,-0.004999993743430797,-1.2431690692901611],"max":[2.950000047683716,2.332552433013916,1.2431690692901611]},"groundOffset":0,"groundAligned":false,"groundShift":0,"wheelRadius":0.45385536608158705,"wheelbase":2.5455366184575965,"collisionRadius":1.1934423065185547,"collisionOffset":1.4840577030181885,"hitHeight":2.332552433013916,"cameraDistance":7.5,"cameraHeight":2.1,"driverSeat":{"forward":0.6042584075713863,"height":1.117749378210813,"left":0.4439889450798133},"driverPose":{"scale":0.9274435741667213,"recline":0.06,"hipDrop":0},"anchors":{"driverSeat":[0.6042584075713863,1.117749378210813,-0.4439889450798133],"entry":[0.6042584075713862,0.10274131765335082,-1.3418332562412139]}},"vehicle-rhib":{"kind":"vehicle-rhib","hqVisual":"vehicle-rhib","name":"해상 기동 보트","frontAxis":"+X","length":9.926805973052979,"width":3.7527289390563965,"height":4.078868925571442,"bounds":{"min":[-5.014999866485596,-0.5699999928474426,-1.8803644180297852],"max":[4.911806106567383,3.508868932723999,1.8723645210266113]},"groundOffset":0,"groundAligned":false,"groundShift":0,"wheelRadius":0.5,"wheelbase":5.956083583831787,"collisionRadius":1.8013098907470702,"collisionOffset":3.162093095779419,"hitHeight":3.508868932723999,"cameraDistance":12.904847764968872,"cameraHeight":3.1815177619457247,"driverSeat":{"forward":-0.3943120417407171,"height":0.6745111047998009,"left":0.571798508587519},"driverPose":{"scale":0.7845943077172479,"recline":0.06,"hipDrop":0},"anchors":{"driverSeat":[-0.3943120417407171,0.6745111047998009,-0.571798508587519],"entry":[-0.39431204174071727,0.18362348201091752,-1.7590135794754598],"waterline":[0.018632330742045067,0.08038738889022701,-0.003999996423721285]}},"vehicle-military-truck":{"kind":"vehicle-military-truck","hqVisual":"vehicle-military-truck","name":"ATLAS · 군용 수송트럭","frontAxis":"+X","length":9.220000267028809,"width":4.1725544929504395,"height":3.5447044634709526,"bounds":{"min":[-4.590000152587891,-2.6215093096304543e-8,-2.0862772464752197],"max":[4.630000114440918,3.5447044372558594,2.0862772464752197]},"groundOffset":0,"groundAligned":false,"groundShift":0,"wheelRadius":0.7040538946003473,"wheelbase":5.125098203340762,"collisionRadius":2.002826156616211,"collisionOffset":2.6071739768981934,"hitHeight":3.5447044372558594,"cameraDistance":11.986000347137452,"cameraHeight":2.764869481507343,"driverSeat":{"forward":2.7093823877513934,"height":2.0149401245114893,"left":0.7454688295768377},"driverPose":{"scale":1.0353733744122753,"recline":0.06,"hipDrop":0},"anchors":{"driverSeat":[2.7093823877513934,2.0149401245114893,-0.7454688295768377],"entry":[2.761151056472007,1.0080395178955512,-1.863672073942095]}},"vehicle-sam":{"kind":"vehicle-sam","hqVisual":"vehicle-sam","name":"WATCHTOWER · 방공 차량","frontAxis":"+X","length":9.220000267028809,"width":4.814486026763916,"height":4.49920280339828,"bounds":{"min":[-4.590000152587891,-2.6215093096304543e-8,-2.407243013381958],"max":[4.630000114440918,4.499202777183187,2.407243013381958]},"groundOffset":0,"groundAligned":false,"groundShift":0,"wheelRadius":0.7040538946003473,"wheelbase":4.685064519215546,"collisionRadius":2.3109532928466794,"collisionOffset":2.299046840667725,"hitHeight":4.499202777183187,"cameraDistance":11.986000347137452,"cameraHeight":3.5093781866506584,"driverSeat":{"forward":2.7093823877513934,"height":2.0149401245114893,"left":0.7454688295768395},"driverPose":{"scale":1.0353733744122753,"recline":0.06,"hipDrop":0},"anchors":{"driverSeat":[2.7093823877513934,2.0149401245114893,-0.7454688295768395],"entry":[2.761151056472007,1.0080395178955512,-1.8636720739420969],"muzzle":[0.34873109409140585,1.9895734768383884,-9.518874553853854e-16]}}};
// Shared authored geometry for the sixteen vehicle redesigns. Y up, +X forward.
function makeApprovedKit(T, title){
 const root=new T.Group();root.name=title;
 const mats={
  paint:new T.MeshPhysicalMaterial({color:0x344b52,metalness:.56,roughness:.32,clearcoat:.65,clearcoatRoughness:.22}),
  darkPaint:new T.MeshPhysicalMaterial({color:0x1d2c35,metalness:.55,roughness:.31,clearcoat:.5}),
  olive:new T.MeshStandardMaterial({color:0x515848,metalness:.3,roughness:.56}),
  oliveLight:new T.MeshStandardMaterial({color:0x69715c,metalness:.24,roughness:.61}),
  white:new T.MeshPhysicalMaterial({color:0xd7dedc,metalness:.18,roughness:.3,clearcoat:.6}),
  yellow:new T.MeshStandardMaterial({color:0xdbaf37,metalness:.35,roughness:.4}),
  orange:new T.MeshStandardMaterial({color:0xd36631,metalness:.3,roughness:.42}),
  metal:new T.MeshStandardMaterial({color:0x8e9a9f,metalness:.85,roughness:.28}),
  steel:new T.MeshStandardMaterial({color:0x354149,metalness:.8,roughness:.36}),
  edge:new T.MeshStandardMaterial({color:0x151e25,metalness:.55,roughness:.44}),
  rubber:new T.MeshStandardMaterial({color:0x14191b,metalness:0,roughness:.88}),
  tread:new T.MeshStandardMaterial({color:0x222a2c,metalness:.02,roughness:.85}),
  leather:new T.MeshStandardMaterial({color:0x343b3c,roughness:.88,metalness:0}),
  tan:new T.MeshStandardMaterial({color:0x9c8c74,roughness:.8,metalness:0}),
  wood:new T.MeshStandardMaterial({color:0x9e7950,roughness:.73,metalness:0}),
  deck:new T.MeshStandardMaterial({color:0x68716d,roughness:.86,metalness:.15}),
  glass:new T.MeshPhysicalMaterial({color:0x3b6e7b,metalness:.12,roughness:.1,transparent:true,opacity:.60,depthWrite:false,clearcoat:1,side:T.DoubleSide}),
  glassDark:new T.MeshPhysicalMaterial({color:0x193743,metalness:.15,roughness:.12,clearcoat:1}),
  red:new T.MeshStandardMaterial({color:0xbb3538,emissive:0x6b0909,emissiveIntensity:.2,roughness:.22}),
  light:new T.MeshStandardMaterial({color:0xe8f6fa,emissive:0xa3e8ff,emissiveIntensity:.45,roughness:.15}),
  amber:new T.MeshStandardMaterial({color:0xecc176,emissive:0xef8a19,emissiveIntensity:.38,roughness:.22}),
  green:new T.MeshStandardMaterial({color:0x548d75,emissive:0x003c15,emissiveIntensity:.4,roughness:.2}),
 };
 const names=new WeakMap();for(const [n,m] of Object.entries(mats)){m.name=n;names.set(m,n);}
 let serial=0;
 function mesh(geo,mat='paint',pos=[0,0,0],rot=[0,0,0],name='part',parent=root){const o=new T.Mesh(geo,typeof mat==='string'?mats[mat]:mat);o.position.set(...pos);o.rotation.set(...rot);o.name=name+'-'+(++serial);parent.add(o);return o;}
 function box(size,pos,mat='paint',radius=0.035,rot=[0,0,0],parent=root){
  const [w,h,d]=size,r=Math.min(radius,w*.25,h*.25,d*.25);
  if(r<=.006)return mesh(new T.BoxGeometry(w,h,d),mat,pos,rot,'panel',parent);
  const b=r*.46,W=w-2*b,H=h-2*b,rr=Math.max(.0001,r-b),s=new T.Shape(),x=-W/2,y=-H/2;
  s.moveTo(x+rr,y);s.lineTo(x+W-rr,y);s.quadraticCurveTo(x+W,y,x+W,y+rr);s.lineTo(x+W,y+H-rr);s.quadraticCurveTo(x+W,y+H,x+W-rr,y+H);s.lineTo(x+rr,y+H);s.quadraticCurveTo(x,y+H,x,y+H-rr);s.lineTo(x,y+rr);s.quadraticCurveTo(x,y,x+rr,y);
  const geo=new T.ExtrudeGeometry(s,{depth:d-2*b,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:b,bevelThickness:b,curveSegments:3});geo.translate(0,0,-d/2+b);return mesh(geo,mat,pos,rot,'beveled-panel',parent);
 }
 function cyl(r1,r2,h,pos,mat='metal',axis='y',segments=24,parent=root){const rot=axis==='x'?[0,0,Math.PI/2]:axis==='z'?[Math.PI/2,0,0]:[0,0,0];return mesh(new T.CylinderGeometry(r1,r2,h,segments,1,false),mat,pos,rot,'cylinder',parent);}
 function ellipsoid(size,pos,mat='paint',parent=root,segments=28,rings=16){const g=new T.SphereGeometry(1,segments,rings);g.scale(...size);return mesh(g,mat,pos,[0,0,0],'smooth-shell',parent);}
 function torus(R,r,pos,mat='rubber',axis='z',segments=44,tubeSegments=10,parent=root){const rot=axis==='x'?[0,Math.PI/2,0]:axis==='y'?[Math.PI/2,0,0]:[0,0,0];return mesh(new T.TorusGeometry(R,r,tubeSegments,segments),mat,pos,rot,'ring',parent);}
 function rod(a,b,r=.03,mat='metal',segments=10,parent=root){const av=new T.Vector3(...a),bv=new T.Vector3(...b),delta=bv.clone().sub(av);const o=mesh(new T.CylinderGeometry(r,r,delta.length(),segments,1),mat,av.add(bv).multiplyScalar(.5).toArray(),[0,0,0],'tube',parent);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return o;}
 function tube(points,r,mat='metal',segments=64,parent=root){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));return mesh(new T.TubeGeometry(curve,segments,r,8,false),mat,[0,0,0],[0,0,0],'curved-tube',parent);}
 // Loft rings: [x, centerY, halfWidthZ, radiusY]. A rounded, closed engineering surface.
 function loft(rings,mat='paint',N=28,parent=root){let p=[],uv=[],ind=[];
  for(let j=0;j<rings.length;j++){const [x,y,w,h]=rings[j];for(let i=0;i<=N;i++){const a=i/N*Math.PI*2;p.push(x,y+Math.sin(a)*h,Math.cos(a)*w);uv.push(j/(rings.length-1),i/N);}}
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i,b=a+N+1;ind.push(a,b,a+1,b,b+1,a+1);}
  for(const end of [0,rings.length-1]){const [x,y]=rings[end],c=p.length/3;p.push(x,y,0);uv.push(end?1:0,.5);for(let i=0;i<N;i++){const a=end*(N+1)+i;if(end)ind.push(c,a+1,a);else ind.push(c,a,a+1);}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();return mesh(g,mat,[0,0,0],[0,0,0],'lofted-shell',parent);
 }
 // Extrusion of an x/y profile along Z (angled body sides, glazing, armored hulls).
 function profile(points,depth,mat='paint',pos=[0,0,0],bevel=.02,parent=root){const shape=new T.Shape();shape.moveTo(...points[0]);for(const p of points.slice(1))shape.lineTo(...p);shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:depth-2*bevel,steps:1,bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:2,curveSegments:4});g.translate(0,0,-depth/2+bevel);return mesh(g,mat,pos,[0,0,0],'profile-shell',parent);}
 // Thick polygon panel in x/z, preserves a gently cambered top.
 function wing(points,y,thickness,mat='paint',parent=root){const top=points.map(p=>[p[0],y+(p[2]||0),p[1]]),n=points.length,p=[...top.flat(),...top.map(q=>[q[0],q[1]-thickness,q[2]]).flat()],idx=[];const shape=points.map(p=>new T.Vector2(p[0],p[1]));for(const t of T.ShapeUtils.triangulateShape(shape,[])){idx.push(t[0],t[2],t[1],n+t[0],n+t[1],n+t[2]);}for(let i=0;i<n;i++){const j=(i+1)%n;idx.push(i,j,n+i,j,n+j,n+i);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return mesh(g,mat,[0,0,0],[0,0,0],'airfoil',parent);}
 function boltsAlong(a,b,n=6,r=.024,mat='metal'){for(let i=0;i<n;i++){const f=n===1?.5:i/(n-1);ellipsoid([r,r*.55,r],[...a.map((v,k)=>v+(b[k]-v)*f)],mat,root,10,6);}}
 function grille(center,size,n=10,mat='edge',orientation='side'){
  const [x,y,z]=center,[w,h,d]=size;box(size,center,'edge',.015);
  for(let i=0;i<n;i++){const p=(i+.5)/n-.5;if(orientation==='side')box([w*.9,h*.035,d*1.2],[x,y+p*h,z],mat,0);else box([w*.035,h*1.2,d*.9],[x+p*w,y,z],mat,0);}
 }
 function wheel(x,y,z,r=.45,width=.28,heavy=false){
  const sign=z<0?-1:1;
  torus(r*.73,r*.27,[x,y,z],'rubber','z',48,12);cyl(r*.56,r*.56,width*.91,[x,y,z],'steel','z',36);cyl(r*.49,r*.49,width*.98,[x,y,z],'metal','z',36);
  torus(r*.5,r*.045,[x,y,z+sign*width*.51],'edge','z',36,8);cyl(r*.18,r*.2,width*1.03,[x,y,z],'steel','z',24);
  const spokes=heavy?8:6;for(let i=0;i<spokes;i++){const a=i/spokes*Math.PI*2;box([r*.52,r*.095,.045],[x+Math.cos(a)*r*.29,y+Math.sin(a)*r*.29,z+sign*width*.53],'metal',.008,[0,0,a]);cyl(.027,.027,.04,[x+Math.cos(a)*r*.17,y+Math.sin(a)*r*.17,z+sign*width*.59],'edge','z',8);}
  if(heavy){for(let i=0;i<32;i++){const a=i/32*Math.PI*2;for(const side of [-1,1])box([r*.15,r*.07,width*.54],[x+Math.cos(a)*r*.985,y+Math.sin(a)*r*.985,z+side*width*.22],'tread',.003,[0,0,a-Math.PI/2]);}}
  else{for(let i=0;i<40;i++){const a=i/40*Math.PI*2;box([r*.085,r*.036,width*.82],[x+Math.cos(a)*r*.986,y+Math.sin(a)*r*.986,z],'tread',0,[0,0,a-Math.PI/2]);}}
 }
 function seat(x,y,z,scale=1,mat='leather',rotation=0){const g=new T.Group();g.position.set(x,y,z);g.rotation.y=rotation;root.add(g);box([.54*scale,.15*scale,.56*scale],[0,0,0],mat,.06*scale,[0,0,0],g);box([.14*scale,.66*scale,.54*scale],[-.22*scale,.35*scale,0],mat,.06*scale,[0,0,-.11],g);box([.16*scale,.19*scale,.29*scale],[-.24*scale,.75*scale,0],mat,.05*scale,[0,0,0],g);for(const side of [-1,1])box([.34*scale,.28*scale,.07*scale],[-.08*scale,.22*scale,side*.28*scale],mat,.035*scale,[0,0,0],g);return g;}
 function steering(x,y,z,r=.17){torus(r,.024,[x,y,z],'rubber','x',28,8);cyl(r*.32,r*.32,.09,[x,y,z],'edge','x',20);for(let i=0;i<3;i++){const a=i*Math.PI*2/3;rod([x,y,z],[x,y+Math.cos(a)*r,z+Math.sin(a)*r],.018,'metal');}}
 function label(text,size,pos,matColor='#dbe3df',back='#24343d',rot=[0,0,0]){
  if(!globalThis.document?.createElement)return null;
  const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle=back;ctx.fillRect(0,0,512,128);ctx.fillStyle=matColor;ctx.font='700 72px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,66,488);const tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;const mat=new T.MeshStandardMaterial({map:tx,roughness:.5,metalness:.1});mat.name='marking-'+text;const g=new T.PlaneGeometry(size[0],size[1]);return mesh(g,mat,pos,rot,'identity-marking');
 }
 function finish({rotateY=0,bounds=null}={}){
  if(rotateY)root.rotation.y=rotateY;root.updateMatrixWorld(true);
  // Retain authored proportions while matching source overall footprint and origin.
  if(bounds){const b=new T.Box3().setFromObject(root),s=b.getSize(new T.Vector3()),target=bounds.max.map((v,i)=>v-bounds.min[i]);const scale=Math.max(...target)/Math.max(...s);root.scale.setScalar(scale);root.updateMatrixWorld(true);const bb=new T.Box3().setFromObject(root);root.position.x+=(bounds.min[0]+bounds.max[0]-bb.min.x-bb.max.x)/2;root.position.z+=(bounds.min[2]+bounds.max[2]-bb.min.z-bb.max.z)/2;root.position.y+=bounds.min[1]-bb.min.y;root.updateMatrixWorld(true);}
  // Merge static geometry by material, retaining independently authored shapes.
  const groups=new Map();root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld);const n=g.index?g.toNonIndexed():g;if(!n.attributes.normal)n.computeVertexNormals();if(!groups.has(o.material))groups.set(o.material,[]);groups.get(o.material).push(n);});
  const out=new T.Group();out.name=title;
  for(const [material,gs]of groups){let count=0;for(const g of gs)count+=g.attributes.position.count;const pos=new Float32Array(count*3),norm=new Float32Array(count*3),uv=new Float32Array(count*2);let at=0;for(const g of gs){pos.set(g.attributes.position.array,at*3);norm.set(g.attributes.normal.array,at*3);if(g.attributes.uv)uv.set(g.attributes.uv.array,at*2);at+=g.attributes.position.count;g.dispose();}const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('normal',new T.BufferAttribute(norm,3));g.setAttribute('uv',new T.BufferAttribute(uv,2));g.computeBoundingBox();g.computeBoundingSphere();const o=new T.Mesh(g,material);o.name=title+' / '+material.name;out.add(o);}
  return out;
 }
 return {T,root,mats,mesh,box,cyl,ellipsoid,torus,rod,tube,loft,profile,wing,boltsAlong,grille,wheel,seat,steering,label,finish};
}

// Geometry is never simplified or substituted. These tags only separate the
// approved meshes into independently movable, material-batched parts.
function makeKit(T,title,options={}){
 const k=makeApprovedKit(T,title),joints=new Map(),anchors={};let wheelSerial=0,steeringSerial=0;
 k.mark=()=>k.root.children.length;
 k.joint=(name,origin,start,meta={})=>{
  const old=joints.get(name),record=old||{name,origin:[...origin],...meta};
  if(!old)joints.set(name,record);
  const objects=Array.isArray(start)?start:k.root.children.slice(start);
  for(const o of objects)o.traverse(node=>{if(node.isMesh&&!node.userData.hqJoint)node.userData.hqJoint=name;});
  return record;
 };
 const wheel=k.wheel;
 k.wheel=(x,y,z,r,width,heavy)=>{const mark=k.mark();wheel(x,y,z,r,width,heavy);const name='wheel_'+(++wheelSerial);k.joint(name,[x,y,z],mark,{kind:'wheel',front:x>0,radius:r,side:z<0?-1:1});};
 const steering=k.steering;
 k.steering=(x,y,z,r)=>{const mark=k.mark();steering(x,y,z,r);k.joint('steering_'+(++steeringSerial),[x,y,z],mark,{kind:'steering'});};
 k.anchor=(name,point)=>{anchors[name]=[...point];};
 k.finish=(fit)=>finishVehicleGeometry(T,k.root,title,joints,anchors,{...fit,...options});
 return k;
}
const VEHICLE_ANCHORS={
 buggy:{driverSeat:[-.35,.9245,-.34],entry:[-.35,.25,-1.24]},
 sedan:{driverSeat:[-.27,.8675,-.43],entry:[-.27,.1,-1.35]},
 bus:{driverSeat:[3.3,1.1645,-.82],entry:[3.72,.44,1.64]},
 'deck-tractor':{driverSeat:[-.25,1.12875,-.45],entry:[-.25,.1,-1.36]},
 fighter:{driverSeat:[-.48,2.02,0],muzzle:[1.41,1.47,-1.78]},
 tank:{muzzle:[4.9625,2.19,0]},apc:{muzzle:[2.575,2.7,0]},
 'military-truck':{driverSeat:[2.65,1.9325,-.72],entry:[2.7,.96,-1.8]},
 sam:{driverSeat:[2.65,1.9325,-.72],entry:[2.7,.96,-1.8],muzzle:[.37,1.908,0]},
 rhib:{driverSeat:[-.4,.5755,-.55],entry:[-.4,.1,-1.7],waterline:[0,0,0]},
 speedboat:{driverSeat:[-.68,.9375,-.62],entry:[-1.4,.65,-1.7],waterline:[0,0,0]},
 gunboat:{driverSeat:[.1,1.8,-.5],muzzle:[7.79,2.41,0],weaponMount:[4.5,1.85,0],waterline:[0,0,0]},
 'patrol-boat':{driverSeat:[.1,1.5,-.4],weaponMount:[3.58,1.78,0],waterline:[0,0,0]},
 workboat:{driverSeat:[4.7,2.0,-.9],waterline:[0,0,0]},
 ferry:{driverSeat:[9.9,5.1,-.9],waterline:[0,0,0]},
 bomber:{driverSeat:[8.1,1.6,0]}
};
function setVehicleAnchors(k,id){for(const [name,point]of Object.entries(VEHICLE_ANCHORS[id.replace('vehicle-','')]||{}))k.anchor(name,point);}
function finishVehicleGeometry(T,root,title,joints,anchors,options){
 const {rotateY=0,bounds,forward='+X',id}=options;
 root.rotation.y=rotateY;root.updateMatrixWorld(true);
 if(bounds){const b=new T.Box3().setFromObject(root),s=b.getSize(new T.Vector3()),target=bounds.max.map((v,i)=>v-bounds.min[i]);root.scale.setScalar(Math.max(...target)/Math.max(...s));root.updateMatrixWorld(true);const bb=new T.Box3().setFromObject(root);root.position.x+=(bounds.min[0]+bounds.max[0]-bb.min.x-bb.max.x)/2;root.position.z+=(bounds.min[2]+bounds.max[2]-bb.min.z-bb.max.z)/2;root.position.y+=bounds.min[1]-bb.min.y;root.updateMatrixWorld(true);}
 const nativeForward=rotateY?'+Z':'+X',turn=forward===nativeForward?0:forward==='+X'?Math.PI/2:-Math.PI/2;
 const orient=new T.Matrix4().makeRotationY(turn),fit=new T.Matrix4().multiplyMatrices(orient,root.matrixWorld);
 const fitPosition=new T.Vector3(),fitQuaternion=new T.Quaternion(),fitScale=new T.Vector3();fit.decompose(fitPosition,fitQuaternion,fitScale);
 const inverseFitQuaternion=fitQuaternion.clone().invert(),out=new T.Group(),nodes=new Map();out.name=title;out.rotation.order='YZX';
 out.userData={approvedRedesign:id,hq50Category:'vehicles',frontAxis:forward,nativeFrontAxis:nativeForward,sourceToLocal:fit.toArray(),rigged:true,anchors:{},joints:[],modelScale:fitScale.x};
 for(const [name,point]of Object.entries(anchors))out.userData.anchors[name]=new T.Vector3(...point).applyMatrix4(fit).toArray();
 // Establish all pivots in final local axes, then retain their rest world
 // transforms when assigning hierarchical parents.
 for(const record of joints.values()){
  const node=new T.Group();node.name=record.name;node.position.copy(new T.Vector3(...record.origin).applyMatrix4(fit));
  if(record.restRotation){const q=new T.Quaternion().setFromEuler(new T.Euler(...record.restRotation));node.quaternion.copy(fitQuaternion).multiply(q).multiply(inverseFitQuaternion);}
  node.userData={...record,dynamic:true,joint:record.name,hq50Joint:true,axis:record.kind==='wheel'||record.kind==='barrel'?(forward==='+X'?'z':'x'):record.kind==='prop'||record.kind==='steering'?(forward==='+X'?'x':'z'):'y',radius:record.radius?record.radius*fitScale.x:undefined};
  out.add(node);nodes.set(record.name,node);out.userData.joints.push(record.name);
 }
 out.updateMatrixWorld(true);
 for(const record of joints.values())if(record.parent){const parent=nodes.get(record.parent);if(!parent)throw new Error('Missing HQ50 joint parent '+record.parent);parent.attach(nodes.get(record.name));}
 out.updateMatrixWorld(true);
 const groups=new Map();
 root.traverse(o=>{if(!o.isMesh)return;const name=o.userData.hqJoint||'',parent=nodes.get(name)||out,key=name+'|'+o.material.uuid;
  if(!groups.has(key))groups.set(key,{parent,material:o.material,geometries:[]});
  const matrix=new T.Matrix4().copy(parent.matrixWorld).invert().multiply(orient).multiply(o.matrixWorld);
  const transformed=o.geometry.clone().applyMatrix4(matrix),g=transformed.index?transformed.toNonIndexed():transformed;
  if(!g.attributes.normal)g.computeVertexNormals();groups.get(key).geometries.push(g);if(g!==transformed)transformed.dispose();
 });
 for(const {parent,material,geometries:gs}of groups.values()){
  let count=0;for(const g of gs)count+=g.attributes.position.count;
  const pos=new Float32Array(count*3),normal=new Float32Array(count*3),uv=new Float32Array(count*2);let at=0;
  for(const g of gs){pos.set(g.attributes.position.array,at*3);normal.set(g.attributes.normal.array,at*3);if(g.attributes.uv)uv.set(g.attributes.uv.array,at*2);at+=g.attributes.position.count;g.dispose();}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(pos,3));geometry.setAttribute('normal',new T.BufferAttribute(normal,3));geometry.setAttribute('uv',new T.BufferAttribute(uv,2));geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const mesh=new T.Mesh(geometry,material);mesh.name=title+' / '+(parent===out?'body':parent.name)+' / '+material.name;mesh.castShadow=!material.transparent;mesh.receiveShadow=true;mesh.userData={hq50Geometry:true,approvedRedesign:id};parent.add(mesh);
 }
 const discarded=new Set();root.traverse(o=>{if(o.geometry)discarded.add(o.geometry);});for(const g of discarded)g.dispose();root.clear();out.updateMatrixWorld(true);
 const b=new T.Box3().setFromObject(out);out.userData.approvedBounds={min:b.min.toArray(),max:b.max.toArray()};
 return out;
}


const catalog=[
  {
    "id": "vehicle-buggy",
    "title": "버기카",
    "category": "vehicles",
    "source_key": "core-vehicle-buggy::0",
    "source_path": "03-vehicles/core-vehicle-buggy--0.glb",
    "why": "차체와 타이어가 낮은 해상도로 뭉쳐 있고 서스펜션·콕핏의 구분이 약합니다.",
    "changes": [
      "관형 롤케이지와 노출 서스펜션을 재구성",
      "입체 트레드·브레이크·허브가 있는 휠",
      "분리된 버킷시트와 계기판, 보호판"
    ],
    "source_bounds": {
      "min": [
        -1.7549999952316284,
        1.3113021835042815e-08,
        -1.1299999952316284
      ],
      "max": [
        1.6299999952316284,
        1.9199999570846558,
        1.1299999952316284
      ]
    },
    "source_triangles": 4564
  },
  {
    "id": "vehicle-fighter",
    "title": "적 전투기",
    "category": "vehicles",
    "source_key": "core-vehicle-fighter::default",
    "source_path": "03-vehicles/core-vehicle-fighter.glb",
    "why": "동체·날개 연결이 단순하고 프로펠러·조종석·엔진 카울의 입체감이 약합니다.",
    "changes": [
      "단면을 따라 매끈하게 변화하는 프로펠러 전투기 동체",
      "익형 단면과 후연을 가진 주날개·꼬리날개",
      "입체 프로펠러·캐노피 프레임·기관부·착륙장치"
    ],
    "source_bounds": {
      "min": [
        -3.1573596000671387,
        -1.149999976158142,
        -4.697117328643799
      ],
      "max": [
        3.562500000447035,
        1.4307363033294678,
        4.697117328643799
      ]
    },
    "source_triangles": 3678
  },
  {
    "id": "vehicle-gunboat",
    "title": "고속 포함",
    "category": "vehicles",
    "source_key": "core-vehicle-ship::default",
    "source_path": "03-vehicles/core-vehicle-ship.glb",
    "why": "갑판과 선체의 분리가 약하고 상부 구조가 단순한 덩어리로 보입니다.",
    "changes": [
      "V형 선체와 단차가 있는 갑판",
      "경사진 함교 유리·난간·레이다 마스트",
      "선수포와 계류 장비, 구조용 부품"
    ],
    "source_bounds": {
      "min": [
        -7.989999771118164,
        -0.5,
        -1.8700000047683716
      ],
      "max": [
        8.5,
        5.71999979019165,
        1.8700000047683716
      ]
    },
    "source_triangles": 1961
  },
  {
    "id": "vehicle-patrol-boat",
    "title": "적 경비정",
    "category": "vehicles",
    "source_key": "core-vehicle-boat::default",
    "source_path": "03-vehicles/core-vehicle-boat.glb",
    "why": "작은 경비정에 비해 함교와 마스트가 지나치게 단순하고 높이 비례가 어색합니다.",
    "changes": [
      "날렵한 차인 선체와 낮은 함교",
      "난간·서치라이트·통신 안테나·구명환",
      "후부 작업 갑판과 쌍발 추진장치"
    ],
    "source_bounds": {
      "min": [
        -6.110000133514404,
        -0.5,
        -1.4299999475479126
      ],
      "max": [
        6.639999990463257,
        5.71999979019165,
        1.4299999475479126
      ]
    },
    "source_triangles": 1801
  },
  {
    "id": "vehicle-tank",
    "title": "적 전차",
    "category": "vehicles",
    "source_key": "core-vehicle-tank::ready",
    "source_path": "03-vehicles/core-vehicle-tank--ready.glb",
    "why": "궤도와 포탑이 단순하고 장갑판·현가장치의 분리가 부족합니다.",
    "changes": [
      "경사진 차체와 다면 장갑 포탑",
      "연속 궤도 링크·보기륜·구동륜",
      "포신 열덮개·관측장비·엔진 그릴"
    ],
    "source_bounds": {
      "min": [
        -3.4000000953674316,
        0.02500000037252903,
        -1.940000057220459
      ],
      "max": [
        4.565433031990023,
        2.72924782037735,
        1.940000057220459
      ]
    },
    "source_triangles": 2488
  },
  {
    "id": "vehicle-apc",
    "title": "적 장갑차",
    "category": "vehicles",
    "source_key": "core-vehicle-apc::ready",
    "source_path": "03-vehicles/core-vehicle-apc--ready.glb",
    "why": "차체가 균일한 상자에 가깝고 휠·외부 장비의 구체성이 부족합니다.",
    "changes": [
      "경사 전면과 측면 장갑의 단차",
      "8륜 차동축·현가장치와 깊은 타이어",
      "원격무장·해치·관측창·후방 램프"
    ],
    "source_bounds": {
      "min": [
        -2.9000000953674316,
        0.030000019818544388,
        -1.5299999713897705
      ],
      "max": [
        3.7133677005767822,
        2.6900000035762788,
        1.5299999713897705
      ]
    },
    "source_triangles": 5352
  },
  {
    "id": "vehicle-sedan",
    "title": "주차 세단",
    "category": "vehicles",
    "source_key": "module-west-prop-sedan::default",
    "source_path": "03-vehicles/module-west-prop-sedan.glb",
    "why": "차체·실내·바퀴가 208삼각형 수준의 기본 도형으로만 구성되어 있습니다.",
    "changes": [
      "보닛·펜더·트렁크가 연결되는 곡면 차체",
      "유리·필러·시트가 구분되는 실내",
      "LED 램프·알로이 휠·도어 손잡이"
    ],
    "source_bounds": {
      "min": [
        -2.299999952316284,
        0.38999998569488525,
        -1.1050000190734863
      ],
      "max": [
        2.344999933615327,
        2.190000094473362,
        1.1050000190734863
      ]
    },
    "source_triangles": 208
  },
  {
    "id": "vehicle-bus",
    "title": "도시 버스",
    "category": "vehicles",
    "source_key": "module-west-prop-bus::default",
    "source_path": "03-vehicles/module-west-prop-bus.glb",
    "why": "세단 모형을 확대해 버스로 표현하여 차종 실루엣과 객실 구조가 맞지 않습니다.",
    "changes": [
      "독립적인 긴 버스 차체와 저상 출입구",
      "대형 창과 필러·운전석·좌석열",
      "전후 램프·환기 그릴·노선 표시"
    ],
    "source_bounds": {
      "min": [
        -4.139999866485596,
        0.4620000123977661,
        -1.989000052213669
      ],
      "max": [
        4.221000120043755,
        3.7020001113414764,
        1.989000052213669
      ]
    },
    "source_triangles": 208
  },
  {
    "id": "vehicle-bomber",
    "title": "웨스트포트 폭격기",
    "category": "vehicles",
    "source_key": "module-west-bomber::default",
    "source_path": "03-vehicles/module-west-bomber.glb",
    "why": "240삼각형의 단순 날개 조합으로 표면과 엔진·동체 연결이 거칠게 보입니다.",
    "changes": [
      "연속 단면의 긴 동체와 후퇴익을 새로 설계",
      "실제 익형·후연 분할·꼬리날개",
      "4개 엔진의 팬·흡기·배기, 캐노피·착륙장치"
    ],
    "source_bounds": {
      "min": [
        -15.655521146464217,
        -1.2199999690055852,
        -10.038963513884784
      ],
      "max": [
        15.655521146464217,
        2.8389700579209167,
        11.900000095367432
      ]
    },
    "source_triangles": 240
  },
  {
    "id": "vehicle-speedboat",
    "title": "해협 고속 모터보트",
    "category": "vehicles",
    "source_key": "module-west-boat-speedboat::default",
    "source_path": "03-vehicles/module-west-boat-speedboat.glb",
    "why": "선체가 낮은 해상도이며 유리·시트·갑판 질감의 구분이 약합니다.",
    "changes": [
      "유선형 V형 선체와 다층 건현",
      "곡선형 윈드스크린과 개별 시트",
      "데크 홈·계류 클리트·선외기 디테일"
    ],
    "source_bounds": {
      "min": [
        -5.675000116229057,
        -0.8500000238418579,
        -1.75
      ],
      "max": [
        5,
        2.007500018924475,
        1.75
      ]
    },
    "source_triangles": 1462
  },
  {
    "id": "vehicle-workboat",
    "title": "항만 작업선",
    "category": "vehicles",
    "source_key": "module-west-boat-workboat::default",
    "source_path": "03-vehicles/module-west-boat-workboat.glb",
    "why": "작업선의 기능적 부품은 있지만 선체와 함교가 박스형으로 단순합니다.",
    "changes": [
      "둥근 선수와 넓은 작업 선미를 가진 선체",
      "금속 난간·타이어 펜더·작업 크레인",
      "윈치·케이블 드럼·구명 장비와 선실"
    ],
    "source_bounds": {
      "min": [
        -10,
        -1.899999976158142,
        -3.6558845788240433
      ],
      "max": [
        10,
        9.614999733865261,
        3.6558845788240433
      ]
    },
    "source_triangles": 5678
  },
  {
    "id": "vehicle-ferry",
    "title": "웨스트포트 여객 페리",
    "category": "vehicles",
    "source_key": "module-west-boat-ferry::default",
    "source_path": "03-vehicles/module-west-boat-ferry.glb",
    "why": "긴 창과 상부 구조가 반복되는 상자 형태이며 승하선과 갑판 설비가 약합니다.",
    "changes": [
      "2개 객실 갑판과 유선형 선수",
      "개별 창틀·난간·외부 계단·탑승구",
      "구명정·레이다·환기장치·갑판 가구"
    ],
    "source_bounds": {
      "min": [
        -18.700000762939453,
        -2.6500000953674316,
        -5.150000095367432
      ],
      "max": [
        18,
        10.494999848306179,
        5.150000095367432
      ]
    },
    "source_triangles": 6688
  },
  {
    "id": "vehicle-deck-tractor",
    "title": "갑판 항공기 견인차",
    "category": "vehicles",
    "source_key": "module-north-navy-deckTractor::default",
    "source_path": "03-vehicles/module-north-navy-deckTractor.glb",
    "why": "차체와 견인장치가 각진 블록 위주여서 중량감과 기계적 연결이 부족합니다.",
    "changes": [
      "낮고 무거운 차체와 둥근 휠 하우징",
      "견인봉·유압부·충돌 보호대",
      "개방 운전석·계기·경광등"
    ],
    "source_bounds": {
      "min": [
        -1.524999976158142,
        -0.005000000268220901,
        -2.4050000020861626
      ],
      "max": [
        1.524999976158142,
        2.5799999982118607,
        2.9500000005960465
      ]
    },
    "source_triangles": 2698
  },
  {
    "id": "vehicle-rhib",
    "title": "해상 기동 보트",
    "category": "vehicles",
    "source_key": "module-north-navy-rhib::default",
    "source_path": "03-vehicles/module-north-navy-rhib.glb",
    "why": "튜브의 연결과 조종 콘솔이 각지고 부품 재질이 균일합니다.",
    "changes": [
      "연속적인 공기 튜브와 V형 하부 선체",
      "배수 갑판·개별 시트·조종 콘솔",
      "선외기 두 대·인양고리·로프 손잡이"
    ],
    "source_bounds": {
      "min": [
        -1.7700000071525575,
        -0.5699999928474426,
        -5.015000000149012
      ],
      "max": [
        1.7780000000000002,
        3.5999999880790714,
        4.911806310430932
      ]
    },
    "source_triangles": 1822
  },
  {
    "id": "vehicle-military-truck",
    "title": "ATLAS · 군용 수송트럭",
    "category": "vehicles",
    "source_key": "module-north-vehicle-truck::default",
    "source_path": "03-vehicles/module-north-vehicle-truck.glb",
    "why": "반복된 직육면체 부품이 많고 운전실·타이어·적재함의 표면이 거칠게 보입니다.",
    "changes": [
      "경사 유리와 다면 운전실",
      "6륜 현가·깊은 타이어·탑승 발판",
      "적재함 프레임·방수포·연료탱크·결속고리"
    ],
    "source_bounds": {
      "min": [
        -1.7804999998323618,
        -1.0408340855860843e-17,
        -4.590000000596047
      ],
      "max": [
        1.7804999998323618,
        3.2705000000000006,
        4.6299999982118605
      ]
    },
    "source_triangles": 9518
  },
  {
    "id": "vehicle-sam",
    "title": "WATCHTOWER · 방공 차량",
    "category": "vehicles",
    "source_key": "module-north-vehicle-sam::default",
    "source_path": "03-vehicles/module-north-vehicle-sam.glb",
    "why": "발사관과 차체가 각진 단순 형상이며 전개 장치·센서가 충분히 구분되지 않습니다.",
    "changes": [
      "8륜 차체와 낮은 장갑 운전실",
      "원통형 발사관과 유압 지지대",
      "회전 레이다·전원함·전개 안정판"
    ],
    "source_bounds": {
      "min": [
        -1.7804999998323618,
        -1.0408340855860843e-17,
        -4.590000000596047
      ],
      "max": [
        1.7804999998323618,
        4.595499989122152,
        4.6299999982118605
      ]
    },
    "source_triangles": 10000
  }
];

function roadCar(k,kind='sedan'){
 const {box,loft,profile,wheel,rod,cyl,ellipsoid,seat,steering,grille,label,torus,mats}=k;
 const buggy=kind==='buggy',tractor=kind==='tractor';
 if(buggy){
  loft([[-1.72,.58,.55,.14],[-1.32,.68,.81,.27],[.28,.72,.72,.25],[1.36,.72,.68,.2],[1.68,.67,.48,.12]],'paint',28);
  box([2.7,.15,1.46],[0,.4,0],'steel',.06);box([.85,.28,1.15],[1.07,.95,0],'darkPaint',.07,[0,0,-.1]);
  for(const z of [-.91,.91])for(const x of [-1.1,1.12]){wheel(x,.5,z,.50,.34,true);rod([x,.42,z*.45],[x,.53,z],.065,'steel');rod([x-.18,.93,z*.67],[x+.13,.34,z*.88],.038,'metal');for(let j=0;j<9;j++)torus(.073,.011,[x-.12+j*.033,.87-j*.06,z*.72],'orange','y',16,5);}
  for(const s of [-1,1]){const z=s*.69;rod([-1.13,.88,z],[-.8,1.88,z],.055,'steel');rod([-.8,1.88,z],[.55,1.88,z],.055,'steel');rod([.55,1.88,z],[1.1,.94,z],.055,'steel');rod([-1.12,.82,z],[.9,.9,z],.045,'steel');rod([-.95,1.01,z],[.58,1.84,z],.035,'steel');rod([-.8,1.88,z],[-1.42,1.05,z],.04,'steel');}
  for(const x of [-.8,.55])rod([x,1.88,-.69],[x,1.88,.69],.05,'steel');rod([-.8,1.88,-.69],[.55,1.88,.69],.035,'steel');
  for(const z of [-.34,.34])seat(-.35,.86,z,.86,'leather');box([.2,.25,1.2],[.57,1.13,0],'edge',.035);steering(.35,1.25,-.36,.17);
  for(const z of [-.47,.47]){cyl(.16,.16,.1,[1.59,.92,z],'steel','x',32);cyl(.129,.129,.105,[1.61,.92,z],'light','x',32);box([.19,.09,.2],[-1.59,.88,z],'red',.022);}
  for(let i=0;i<5;i++)box([.18,.1,.17],[.1,1.99,(i-2)*.23],'light',.018);
  rod([1.73,.48,-.71],[1.73,.48,.71],.06,'metal');rod([-1.77,.52,-.72],[-1.77,.52,.72],.06,'metal');
  box([.55,.23,.8],[-1.25,1.06,0],'edge',.035);for(let j=0;j<6;j++)box([.5,.035,.035],[-1.25,1.2,(j-2.5)*.11],'metal',0);
  label('DUNE / 04',[.78,.16],[.08,.73,.814],'#d6c29e','#344b52');
 }else if(tractor){
  loft([[-2.2,.68,.87,.25],[-1.8,.67,1.0,.3],[1.55,.68,1.0,.31],[2.08,.69,.84,.2]],'yellow',28);box([3.8,.34,1.8],[0,.48,0],'edge',.1);
  for(const z of [-1.02,1.02])for(const x of [-1.31,1.27]){wheel(x,.46,z,.46,.34,true);box([.9,.15,.48],[x,1.02,z],'yellow',.06);}
  box([1.05,.62,1.65],[1.4,1.0,0],'yellow',.1);grille([1.95,1.03,0],[.04,.4,1.25],12,'metal','side');
  box([1.05,.6,1.7],[-1.45,1.02,0],'yellow',.07);for(let j=0;j<6;j++)box([.62,.02,.06],[-1.5,1.34,(j-2.5)*.19],'edge',0);
  seat(-.25,1.05,-.45,1.05);box([.25,.37,.6],[.5,1.15,-.47],'edge',.06);steering(.28,1.44,-.47,.21);
  rod([-.8,.9,.82],[-.8,1.92,.82],.045,'steel');rod([-.8,1.92,.82],[.9,1.92,.82],.045,'steel');rod([.9,1.92,.82],[.9,.9,.82],.045,'steel');
  box([2.0,.12,1.9],[.02,2.1,0],'yellow',.08);for(const z of [-.8,.8])rod([-1.0,1.1,z],[-1.0,2.04,z],.04,'steel');
  cyl(.11,.11,.18,[0,2.27,0],'amber','y',24);
  for(const z of [-.69,.69]){box([.055,.15,.29],[2.1,1.08,z],'light',.025);box([.06,.14,.24],[-2.15,1.08,z],'red',.025);}
  for(const z of [-.52,.52])rod([-2.15,.49,z],[-3.06,.34,0],.055,'steel');torus(.18,.05,[-3.07,.34,0],'metal','y',28,8);cyl(.09,.09,.34,[-2.2,.67,0],'metal');
  label('DECK 07',[.84,.23],[1.43,.9,1.02],'#28343c','#dbaf37');
 }else{
  loft([[-2.44,.67,.62,.17],[-2.1,.73,.91,.27],[-1.45,.82,.98,.3],[.65,.82,.97,.28],[1.75,.73,.86,.24],[2.38,.66,.69,.16]],'darkPaint',40);
  box([4.3,.12,1.78],[0,.43,0],'edge',.04);
  profile([[-1.42,1.03],[-.92,1.52],[.35,1.57],[1.08,1.10]],1.65,'darkPaint',[0,0,0],.06);
  // Four side glazing panes follow sloping pillars instead of sitting on a box.
  for(const s of [-1,1]){
   profile([[-1.28,1.11],[-.86,1.42],[-.18,1.45],[-.18,1.13]],.025,'glass',[0,0,s*.84],.008);
   profile([[-.10,1.13],[-.10,1.45],[.29,1.47],[.93,1.13]],.025,'glass',[0,0,s*.84],.008);
   box([1.48,.028,.035],[-.2,1.08,s*.86],'metal',.005);
   for(const x of [-.72,.6]){box([.17,.035,.055],[x,1.01,s*.977],'metal',.012);rod([x-.36,.89,s*.973],[x-.36,.48,s*.91],.009,'edge');}
   ellipsoid([.16,.09,.11],[.85,1.18,s*1.0],'darkPaint');rod([.79,1.16,s*.82],[.85,1.18,s*1.01],.028,'edge');
   box([.41,.075,.08],[1.98,.84,s*.67],'light',.028);box([.28,.10,.06],[-2.25,.81,s*.65],'red',.026);
   for(const x of [-1.48,1.43])wheel(x,.44,s*.98,.44,.28,false);
  }
  const windshield=new k.T.MeshBasicMaterial({color:0x244d61});windshield.name='tinted-windshield';
  box([.85,.022,1.49],[.770,1.408,0],windshield,.025,[0,0,-.572]);
  const windCorners=[[.412,1.638,-.765],[1.128,1.178,-.765],[1.128,1.178,.765],[.412,1.638,.765]];for(let j=0;j<4;j++)rod(windCorners[j],windCorners[(j+1)%4],.028,'edge');
  for(const z of [-.48,.48]){rod([1.1,1.19,z],[.93,1.3,z+.09],.014,'edge');rod([1.16,.99,z],[2.09,.83,z*.86],.008,'steel');}
  box([.68,.022,1.4],[-1.228,1.336,0],windshield,.025,[0,0,.775]);
  for(const z of [-.43,.43]){seat(-.27,.8,z,.9);seat(-1.07,.8,z,.8);}
  box([.28,.22,1.4],[.63,1.0,0],'edge',.04);steering(.42,1.16,-.46,.17);
  grille([2.36,.56,0],[.045,.18,1.13],7,'steel','side');box([.11,.08,1.73],[2.28,.45,0],'metal',.02);
  for(const z of [-.68,.68])cyl(.07,.07,.23,[-2.41,.48,z],'metal','x',24);
  label('NOVA',[.55,.12],[-2.455,.72,0],'#c9d5d7','#1d2c35',[0,-Math.PI/2,0]);
 }
}

function bus(k){
 const {box,profile,wheel,rod,seat,grille,label,ellipsoid}=k;
 // New bus-specific body: long wheelbase, flat accessible floor, tall glass band.
 profile([[-4.25,.52],[-4.25,2.9],[-3.99,3.16],[3.81,3.16],[4.16,2.82],[4.27,.65],[3.8,.44],[-3.85,.44]],2.6,'white',[0,0,0],.08);
 box([8.1,.49,2.66],[0,1.0,0],'paint',.07);box([8.02,.18,2.54],[0,.48,0],'edge',.05);
 for(const s of [-1,1]){for(let j=0;j<6;j++){const x=-3.25+j*1.04;box([.93,1.11,.035],[x,2.31,s*1.32],'glassDark',.055);box([.025,1.10,.045],[x-.47,2.31,s*1.344],'metal',.006);}
  for(const x of [-2.66,2.66])wheel(x,.53,s*1.25,.53,.36,true);
  box([8.0,.06,.036],[0,1.52,s*1.341],'yellow',.006);box([7.9,.03,.034],[0,1.42,s*1.343],'metal',.004);
 }
 // Keep the windshield in front of the beveled shell, with a visible gasket.
 const busGlass=new k.T.MeshBasicMaterial({color:0x244d61});busGlass.name='bus-front-tinted-glazing';
 box([.08,1.45,2.48],[4.37,2.10,0],'edge',.025,[0,0,.11]);
 box([.035,1.31,2.31],[4.425,2.106,0],busGlass,.015,[0,0,.11]);
 rod([4.50,1.49,0],[4.36,2.73,0],.022,'edge');
 for(const z of [-.57,.57]){rod([4.52,1.52,z],[4.47,1.97,z+.21],.018,'edge');rod([4.47,1.97,z+.21],[4.44,2.18,z+.21],.021,'edge');}
 box([.055,.36,2.19],[4.208,2.94,0],'edge',.035);label('07  WESTPORT',[1.93,.23],[4.247,2.94,0],'#d2ebbd','#10191b',[0,Math.PI/2,0]);
 box([.04,1.04,2.15],[-4.28,2.35,0],'glassDark',.05);
 for(const s of [-1,1]){box([.075,.23,.48],[4.44,.94,s*.87],'light',.035);box([.07,.56,.12],[-4.29,1.1,s*1.03],'red',.025);ellipsoid([.16,.16,.28],[4.1,2.41,s*1.61],'edge');rod([3.8,2.65,s*1.28],[4.1,2.58,s*1.6],.035,'steel');}
 // Front entry is in the overhang ahead of the axle, clear of its full tire radius.
 const doorX=3.72;
 box([.88,2.22,.055],[doorX,1.57,1.36],'edge',.035);for(const x of [doorX-.215,doorX+.215])box([.35,1.81,.035],[x,1.75,1.397],'glass',.025);
 for(let i=0;i<3;i++)box([.91,.09,.25],[doorX,.5+i*.16,1.41-i*.11],'steel',.012);
 for(const s of [-1,1])box([.69,1.11,.035],[2.79,2.31,s*1.32],'glassDark',.035);
 box([.14,.18,2.46],[4.40,.63,0],'edge',.035);box([.045,.21,1.21],[4.47,1.13,0],'edge',.02);
 for(const y of [1.07,1.13,1.19])box([.02,.018,1.08],[4.50,y,0],'steel',0);
 box([2.55,.30,1.75],[-.2,3.31,0],'white',.12);grille([-.2,3.478,0],[2.0,.025,1.4],16,'steel','top');
 for(let x=-3.2;x<=1.8;x+=.88)for(const z of [-.8,.8])seat(x,.98,z,.63,'tan');seat(3.3,1.1,-.82,.86,'leather');
 for(const z of [-.7,.7])rod([-3.8,2.76,z],[3.1,2.76,z],.027,'metal');for(const x of [-2.7,-.9,.9,2.2])rod([x,.75,1.03],[x,2.76,1.03],.025,'metal');
 grille([-4.29,.95,0],[.04,.6,1.62],10,'steel','side');label('WESTPORT TRANSIT',[2.8,.26],[-1.2,1.15,-1.36],'#edf2ee','#344b52',[0,Math.PI,0]);
}

function military(k,kind){
 const {box,profile,wheel,rod,cyl,torus,ellipsoid,grille,boltsAlong,label,seat,steering}=k;
 const tank=kind==='tank',apc=kind==='apc',sam=kind==='sam',truck=kind==='truck';
 if(tank){
  profile([[-3.0,.65],[-3.14,1.15],[-2.52,1.62],[2.25,1.62],[3.08,1.02],[2.85,.62]],3.3,'olive',[0,0,0],.08);
  box([5.3,.12,3.38],[0,1.68,0],'oliveLight',.05);
  for(const s of [-1,1]){
   const z=s*1.61;
   for(let i=0;i<7;i++){const x=-2.42+i*.80;cyl(.47,.47,.32,[x,.62,z],'rubber','z',32);cyl(.35,.35,.34,[x,.62,z+s*.02],'oliveLight','z',28);cyl(.12,.12,.37,[x,.62,z+s*.03],'metal','z',18);}
   const a=2.5,cy=.66,R=.55;const pts=[];
   for(let i=0;i<28;i++)pts.push([-a+i/(27)*a*2,cy+R]);
   for(let i=1;i<18;i++){const ang=Math.PI/2-i/18*Math.PI;pts.push([a+Math.cos(ang)*R,cy+Math.sin(ang)*R]);}
   for(let i=0;i<28;i++)pts.push([a-i/27*a*2,cy-R]);
   for(let i=1;i<18;i++){const ang=-Math.PI/2-i/18*Math.PI;pts.push([-a+Math.cos(ang)*R,cy+Math.sin(ang)*R]);}
   pts.forEach((p,i)=>{const next=pts[(i+1)%pts.length],ang=Math.atan2(next[1]-p[1],next[0]-p[0]);box([.20,.085,.57],[p[0],p[1],z],'steel',.005,[0,0,ang]);box([.12,.033,.47],[p[0],p[1]+(p[1]>cy?.055:-.055),z],'rubber',0,[0,0,ang]);});
   for(let j=0;j<5;j++)box([.96,.44,.16],[-2.09+j*1.03,1.24,s*1.9],'olive',.035);
   rod([-2.75,1.82,s*1.3],[-2.75,2.5,s*1.3],.018,'edge');
  }
  const tankTurret=k.mark();
  // Low, faceted turret with sloped cheeks rather than a rectangular box.
  profile([[-1.66,1.79],[-1.48,2.36],[-.81,2.65],[.85,2.58],[1.63,2.19],[1.16,1.78]],2.25,'olive',[0,0,0],.055);
  for(const s of [-1,1])profile([[-.42,1.87],[-.18,2.43],[.82,2.36],[1.59,2.05],[1.26,1.85]],.24,'oliveLight',[0,0,s*1.18],.035);
  const tankBarrel=k.mark();
  cyl(.29,.37,.65,[1.48,2.16,0],'olive','x',28);cyl(.105,.11,3.14,[3.20,2.19,0],'steel','x',36);
  for(const x of [2.0,2.85,3.85])cyl(.14,.14,.18,[x,2.19,0],'oliveLight','x',28);
  cyl(.135,.14,.28,[4.80,2.19,0],'edge','x',32);cyl(.088,.088,.025,[4.95,2.19,0],'rubber','x',32);
  k.joint('barrel',[1.48,2.19,0],tankBarrel,{parent:'turret',kind:'barrel'});
  cyl(.43,.43,.14,[-.66,2.69,-.44],'oliveLight','y',32);cyl(.32,.32,.1,[.32,2.69,.5],'olive','y',28);
  box([.38,.20,.42],[.76,2.65,-.54],'edge',.04);box([.06,.13,.29],[.97,2.65,-.54],'glassDark',.01);
  for(const s of [-1,1])for(let j=0;j<4;j++)cyl(.075,.075,.23,[.63+j*.17,2.35,s*1.29],'steel','z',16);
  k.joint('turret',[-.30,1.79,0],tankTurret,{kind:'turret'});
  grille([-2.11,1.76,0],[1.3,.035,1.8],15,'steel','top');for(const s of [-1,1]){box([.13,.16,.22],[2.8,1.31,s*1.15],'light',.025);torus(.11,.03,[-3.14,1.05,s*.91],'metal','x',20,6);}
  const tankMark=k.mark();label('BASTION 04',[.72,.23],[-.81,2.19,1.185],'#d9d9be','#515848');k.joint('turret',[-.30,1.79,0],tankMark);
 }else if(apc){
  profile([[-3.13,.78],[-3.13,1.71],[-2.52,2.17],[1.84,2.17],[3.2,1.43],[2.82,.74]],2.85,'olive',[0,0,0],.065);
  for(const s of [-1,1])for(const x of [-2.25,-.83,.83,2.25]){wheel(x,.61,s*1.38,.61,.39,true);rod([x,.62,-1.38],[x,.62,1.38],.08,'steel');}
  for(const s of [-1,1]){for(let j=0;j<4;j++)profile([[-.51,-.35],[-.46,.33],[.5,.33],[.56,-.35]],.12,'oliveLight',[-2.22+j*1.47,1.58,s*1.52],.025);rod([-2.55,2.2,s*1.32],[1.25,2.2,s*1.32],.026,'metal');}
  for(const z of [-.56,.56])box([.07,.24,.59],[2.5,1.92,z],'glassDark',.025,[0,0,.58]);
  const apcTurret=k.mark();
  cyl(.66,.74,.19,[-.20,2.28,0],'steel','y',36);profile([[-.65,0],[-.48,.54],[.41,.51],[.76,.13]],1.15,'oliveLight',[-.1,2.35,0],.04);
  const apcBarrel=k.mark();
  cyl(.07,.08,1.87,[1.47,2.7,0],'steel','x',28);cyl(.11,.11,.25,[2.45,2.7,0],'edge','x',24);k.joint('barrel',[.55,2.7,0],apcBarrel,{parent:'turret',kind:'barrel'});box([.34,.28,.29],[-.46,3.0,.35],'edge',.04);box([.025,.16,.18],[-.27,3,.35],'glassDark',.01);
  k.joint('turret',[-.20,2.28,0],apcTurret,{kind:'turret'});
  for(const x of [-2.12,1.15])cyl(.39,.39,.1,[x,2.24,0],'oliveLight','y',28);
  box([.1,1.2,1.8],[-3.20,1.44,0],'oliveLight',.05);for(const z of [-.91,.91])rod([-3.27,.98,z],[-3.27,1.91,z],.027,'metal');
  for(const s of [-1,1]){box([.08,.18,.28],[3.13,1.1,s*1.02],'light',.025);box([.10,.3,.13],[-3.26,1.1,s*1.08],'red',.02);rod([-.93,2.40,s*.82],[-1.13,3.61,s*.82],.014,'edge');}
  grille([-1.70,2.24,0],[.87,.035,1.5],12,'steel','top');label('SENTINEL',[1.00,.25],[-1.85,1.91,1.59],'#e0dfc7','#515848');
 }else{
  const L=sam?8.8:8.8;
  box([L,.42,2.66],[0,.72,0],'edge',.07);for(const z of [-.9,.9])box([L,.17,.16],[0,.91,z],'steel',.025);
  const axles=sam?[-3.1,-1.6,1.4,2.95]:[-2.8,-1.3,2.9];
  for(const x of axles)for(const s of [-1,1]){wheel(x,.68,s*1.44,.68,.48,true);rod([x,.6,-1.44],[x,.6,1.44],.10,'steel');box([1.2,.17,.55],[x,1.43,s*1.40],'olive',.045);}
  // Forward cab profile: sloped upper windscreen, door recess and foot steps.
  profile([[1.87,1.1],[1.87,2.98],[2.15,3.34],[3.6,3.34],[4.28,2.73],[4.34,1.26]],2.84,'olive',[0,0,0],.07);
  for(const s of [-1,1]){profile([[2.10,2.03],[2.1,3.16],[3.48,3.16],[3.76,2.84],[3.71,2.03]],.035,'glass',[0,0,s*1.45],.025);box([.91,.57,.045],[2.91,1.67,s*1.458],'oliveLight',.04);box([.21,.06,.05],[2.2,1.95,s*1.49],'metal',.008);for(let i=0;i<2;i++)box([1.28,.09,.35],[2.7,.96+i*.25,s*(1.58-i*.08)],'metal',.016);rod([3.61,2.77,s*1.43],[3.85,2.75,s*1.9],.035,'steel');box([.14,.36,.23],[3.84,2.72,s*1.9],'edge',.045);box([.17,.25,.34],[4.35,1.47,s*1.0],'light',.035);}
  // Glazing follows the real cab chamfer, not the nearly vertical grille face.
  const cabGlass=new k.T.MeshBasicMaterial({color:0x244d61});cabGlass.name='cab-front-tinted-glazing';
  box([.085,.83,2.59],[4.005,3.107,0],'edge',.02,[0,0,.84]);
  box([.035,.70,2.39],[4.052,3.160,0],cabGlass,.014,[0,0,.84]);
  rod([4.32,2.91,0],[3.79,3.39,0],.025,'edge');
  for(const z of [-.64,.64])rod([4.30,2.94,z],[4.13,3.12,z+.19],.019,'edge');
  box([.17,.34,2.9],[4.42,1.04,0],'steel',.04);
  grille([4.37,1.96,0],[.045,.46,1.87],10,'steel','side');for(const z of [-.72,.72])seat(2.65,1.85,z,1.1);steering(3.53,2.25,-.78,.2);
  cyl(.35,.35,.92,[.91,1.27,-1.2],'steel','x',28);box([1.01,.72,.50],[.75,1.35,1.25],'edge',.045);
  if(truck){
   box([5.05,.20,3.03],[-1.49,1.42,0],'oliveLight',.05);for(const s of [-1,1]){box([5.04,.89,.13],[-1.48,1.98,s*1.46],'olive',.03);for(let j=0;j<6;j++){box([.09,1.28,.20],[-3.85+j*.94,2.0,s*1.47],'oliveLight',.01);torus(.06,.018,[-3.73+j*.88,1.58,s*1.58],'metal','z',16,6);}}
   box([.13,.89,2.91],[-4.04,1.98,0],'olive',.03);
   // Canvas canopy has a rounded, non-box cross section along the cargo bed.
   const rings=[[-4.0,2.42,1.44,.77],[-3.6,2.46,1.45,.79],[-1.6,2.46,1.45,.8],[.65,2.46,1.45,.79],[1.02,2.42,1.43,.75]];
   k.loft(rings,'tan',32);for(const x of [-3.85,-2.76,-1.67,-.58,.5]){k.tube([[x,2.04,-1.46],[x,2.98,-1.1],[x,3.29,0],[x,2.98,1.1],[x,2.04,1.46]],.025,'olive',36);}
   label('ATLAS 6 × 6',[1.33,.24],[2.8,1.67,1.49],'#e0dfc7','#69715c');
  }else{
   box([4.6,.26,2.7],[-1.46,1.61,0],'oliveLight',.05);const samBase=k.mark();cyl(.81,.81,.31,[-1.45,1.91,0],'steel','y',40);k.joint('launcher_yaw',[-1.45,1.91,0],samBase,{kind:'turret'});
   // Inclined launch canisters, built as closed cylinders with capped collars.
   const carrier=new k.T.Group();carrier.position.set(-1.7,2.12,0);carrier.rotation.z=-.30;k.root.add(carrier);
   box([4.45,.25,2.22],[0,0,0],'olive',.05,[0,0,0],carrier);
   for(const z of [-.72,0,.72])for(const y of [.43,1.09]){
    cyl(.28,.28,4.15,[0,y,z],'olive','x',36,carrier);for(const x of [-2.08,2.08,-.96,.96])cyl(.306,.306,.13,[x,y,z],'oliveLight','x',28,carrier);cyl(.236,.236,.035,[2.17,y,z],'edge','x',32,carrier);box([.65,.06,.08],[1.45,y+.28,z],'yellow',.01,[0,0,0],carrier);
   }
   k.joint('launcher_elevation',[-1.7,2.12,0],[carrier],{parent:'launcher_yaw',kind:'barrel',restRotation:[0,0,-.30]});
   for(const s of [-1,1]){rod([-.1,1.80,s*.75],[-1.9,3.11,s*.75],.11,'steel');rod([-.12,1.78,s*.75],[-1.0,2.42,s*.75],.068,'metal');box([.55,.28,.55],[-3.65,1.34,s*1.44],'olive',.04);rod([-3.65,1.34,s*1.44],[-3.65,.28,s*2.0],.10,'steel');box([.63,.13,.65],[-3.65,.18,s*2.0],'metal',.02);}
   cyl(.13,.13,1.07,[.91,3.42,0],'steel','y',24);const samRadar=k.mark();box([.25,.83,1.82],[.91,3.91,0],'oliveLight',.05,[0,0,-.15]);grille([1.05,3.91,0],[.045,.7,1.60],9,'edge','side');
   k.joint('radar_azimuth',[.91,3.91,0],samRadar,{kind:'radar'});
   label('WATCHTOWER',[1.7,.25],[2.85,1.67,1.49],'#e0dfc7','#69715c');
  }
 }
}

function hull(k,L,W,deck,depth,mat='paint'){
 const T=k.T,N=24,S=36,p=[],idx=[],uv=[];
 const halfWidth=f=>{if(f<.12)return W/2*(.80+.20*f/.12);if(f<.67)return W/2*(1-.025*Math.sin((f-.12)/.55*Math.PI));const u=(f-.67)/.33;return W/2*Math.max(.025,Math.pow(1-u, .62));};
 for(let j=0;j<=S;j++){const f=j/S,x=(f-.5)*L,w=halfWidth(f),bowRise=Math.max(0,(f-.76)/.24)*depth*.24;for(let i=0;i<=N;i++){const a=i/N*Math.PI,z=-Math.cos(a)*w,y=deck-Math.pow(Math.sin(a),.67)*depth+bowRise;p.push(x,y,z);uv.push(f,i/N);}}
 for(let j=0;j<S;j++){for(let i=0;i<N;i++){const a=j*(N+1)+i,b=a+N+1;idx.push(a,b,a+1,b,b+1,a+1);}const a=j*(N+1),b=a+N+1;idx.push(a,a+N,b,b,a+N,b+N);}
 for(const j of [0,S]){const c=p.length/3;p.push((j/S-.5)*L,deck-depth*.36,0);uv.push(j/S,.5);for(let i=0;i<N;i++){const a=j*(N+1)+i;if(j)idx.push(c,a+1,a);else idx.push(c,a,a+1);}const a=j*(N+1);if(j)idx.push(c,a,a+N);else idx.push(c,a+N,a);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();k.mesh(g,mat,[0,0,0],[0,0,0],'compound-curved-hull');
 const outline=[];for(let j=0;j<=S;j+=3){const f=j/S;outline.push([(f-.5)*L,deck+.025,halfWidth(f)*.98]);}for(let j=S;j>=0;j-=3){const f=j/S;outline.push([(f-.5)*L,deck+.025,-halfWidth(f)*.98]);}return {halfWidth,outline};
}
function outboard(k,x,y,z,scale=1){const {box,cyl,rod,ellipsoid,wing}=k;box([.60*scale,.63*scale,.45*scale],[x,y,z],'edge',.13*scale);box([.34*scale,.12*scale,.39*scale],[x+.2,y+.18*scale,z],'metal',.04*scale);rod([x,y-.2*scale,z],[x-.1*scale,y-1.0*scale,z],.075*scale,'steel');ellipsoid([.20*scale,.13*scale,.13*scale],[x-.1*scale,y-1.04*scale,z],'metal');for(let j=0;j<3;j++){const a=j*Math.PI*2/3;const o=box([.07*scale,.31*scale,.11*scale],[x-.26*scale,y-1.04*scale+Math.cos(a)*.17*scale,z+Math.sin(a)*.17*scale],'metal',.025*scale,[a,0,.25]);}box([.09*scale,.32*scale,.29*scale],[x-.1*scale,y-.62*scale,z],'steel',.025*scale);}
function rail(k,points,height=.65,r=.023){for(const p of points)k.rod(p,[p[0],p[1]+height,p[2]],r,'metal');k.tube(points.map(p=>[p[0],p[1]+height,p[2]]),r,'metal',Math.max(16,points.length*5));k.tube(points.map(p=>[p[0],p[1]+height*.46,p[2]]),r*.75,'steel',Math.max(16,points.length*5));}
function boat(k,kind){
 const {box,profile,cyl,rod,tube,ellipsoid,torus,seat,steering,grille,label,wing}=k;
 const cfg={speedboat:[10.2,3.2,.55,1.25],rhib:[9.4,2.55,.32,.95],'patrol-boat':[12.5,3.1,1.03,1.55],gunboat:[16.3,4.1,1.4,2.03],workboat:[19.7,6.9,1.1,2.8],ferry:[36.1,9.7,1.8,4.0]}[kind];
 const [L,W,D,depth]=cfg,water=hull(k,L,W,D,depth,kind==='rhib'?'steel':kind==='workboat'?'darkPaint':'paint');
 // A narrower raised deck leaves a clear dark rub rail along the hull edge.
 const rim=water.outline.map(p=>[p[0],p[1]+.035,p[2]]);rim.push(rim[0]);tube(rim,Math.min(.075,W*.025),kind==='rhib'?'rubber':'edge',160);
 const deckPoints=water.outline.map(p=>[p[0]*.98,p[2]*.94]);wing(deckPoints,D+.07,.09,kind==='speedboat'?'white':['gunboat','patrol-boat','rhib'].includes(kind)?'deck':'wood');
 for(let x=-L*.44;x<L*.37;x+=L/28){const f=x/L+.5,w=water.halfWidth(f)*.88;box([.012,.009,w*2],[x,D+.125,0],'edge',0);}
 // Deck cleats, navigation lamps and anchor fittings.
 for(const side of [-1,1])for(const x of [-L*.37,L*.29]){cyl(.08,.09,.14,[x,D+.19,side*W*.42],'metal','y',18);rod([x-.16,D+.29,side*W*.42],[x+.16,D+.29,side*W*.42],.033,'metal');}
 if(kind==='speedboat'){
  for(const s of [-1,1]){box([4.6,.12,.08],[-.8,D+.17,s*W*.39],'white',.04);seat(-.68,D+.32,s*.62,.90,'tan');seat(-2.15,D+.32,s*.62,.86,'tan');profile([[.05,D+.12],[.27,D+.91],[1.02,D+.89],[1.35,D+.18]],.035,'glass',[0,0,s*1.04],.018);rod([.14,D+.18,s*1.04],[.27,D+.91,s*1.04],.025,'metal');}
  box([.07,.78,2.06],[1.05,D+.6,0],'glass',.025,[0,0,.40]);rod([.88,D+1.0,-1.06],[.88,D+1.0,1.06],.031,'metal');
  box([.56,.45,1.89],[.56,D+.38,0],'white',.06);box([.25,.12,.53],[.29,D+.68,-.55],'edge',.025,[0,0,.18]);steering(.15,D+.63,-.64,.18);
  box([1.31,.21,2.09],[-3.42,D+.18,0],'tan',.09);for(const z of [-.95,.95])outboard(k,-L*.49,D+.43,z,.90);
  rail(k,[[2.0,D+.1,-1.21],[3.1,D+.1,-.93],[4.25,D+.17,-.46],[4.70,D+.23,0],[4.25,D+.17,.46],[3.1,D+.1,.93],[2.0,D+.1,1.21]],.44,.023);
  label('STRATA / 08',[1.34,.21],[-2.51,D-.28,1.45],'#e6ece4','#344b52');
 }else if(kind==='rhib'){
  const pts=[[-4.2,.45,-1.36],[-2.5,.45,-1.43],[.9,.49,-1.37],[3.3,.6,-.87],[4.28,.67,0],[3.3,.6,.87],[.9,.49,1.37],[-2.5,.45,1.43],[-4.2,.45,1.36]];tube(pts,.37,'rubber',144);tube(pts.map(p=>[p[0],p[1]+.19,p[2]*1.07]),.022,'metal',144);
  for(const s of [-1,1])for(const x of [-3,-1.5,0,1.5]){rod([x-.24,.82,s*1.4],[x+.24,.82,s*1.4],.026,'tan');for(const xx of [x-.25,x+.25])torus(.043,.018,[xx,.82,s*1.4],'steel','y',16,6);}
  for(const x of [-2.8,-1.6,-.4])for(const z of [-.55,.55])seat(x,D+.20,z,.74,'leather');
  profile([[.42,D+.1],[.42,D+.75],[.84,D+1.18],[1.55,D+1.10],[1.74,D+.1]],1.36,'olive',[0,0,0],.07);
  box([.04,.48,1.24],[1.47,D+1.3,0],'glass',.025,[0,0,.22]);steering(.60,D+.97,-.38,.16);
  for(const s of [-1,1]){rod([.50,D+.9,s*.82],[.5,D+2.05,s*.82],.045,'steel');rod([.5,D+2.05,s*.82],[-.7,D+2.05,s*.82],.045,'steel');rod([-.7,D+2.05,s*.82],[-.7,D+.5,s*.82],.045,'steel');outboard(k,-4.45,.74,s*.63,1.0);}
  box([1.59,.10,1.90],[-.10,D+2.13,0],'olive',.05);cyl(.085,.085,.18,[-.10,D+2.28,0],'amber','y',20);rod([-.7,D+2.1,.67],[-.78,D+3.0,.67],.012,'edge');
  label('MARINE / 07',[1.6,.22],[-1.55,.42,1.79],'#bbc6b2','#14191b');
 }else if(kind==='patrol-boat'||kind==='gunboat'){
  const gun=kind==='gunboat',cabL=gun?5.5:4.3,cabW=gun?2.8:2.3,cx=gun?-.65:-.45,roof=D+(gun?2.28:1.94);
  profile([[cx-cabL/2,D+.13],[cx-cabL/2+.18,roof-.28],[cx+cabL/2-.60,roof],[cx+cabL/2,roof-.85],[cx+cabL/2,D+.13]],cabW,'white',[0,0,0],.075);
  for(const s of [-1,1]){for(let i=0;i<4;i++)box([cabL*.18,.58,.035],[cx-cabL*.30+i*cabL*.205,roof-.54,s*(cabW/2+.02)],'glassDark',.045);}
  box([cabL+.27,.13,cabW+.24],[cx,roof+.08,0],'white',.045);
  box([.06,.75,cabW*.89],[cx+cabL/2-.28,roof-.48,0],'glassDark',.035,[0,0,.32]);
  const railPoints=[];for(let j=1;j<16;j++){const f=j/16,x=(f-.5)*L;railPoints.push([x,D+.16,water.halfWidth(f)*.92]);}for(const s of [-1,1])rail(k,railPoints.map(p=>[p[0],p[1],p[2]*s]),gun?.78:.66,.025);
  cyl(.12,.16,gun?2.18:1.60,[cx-.6,roof+(gun?1.11:.83),0],'steel','y',20);rod([cx-.6,roof+1.25,-.96],[cx-.6,roof+1.25,.96],.035,'steel');box([.27,.38,1.37],[cx-.6,roof+(gun?2.19:1.64),0],'edge',.07);cyl(.12,.12,.16,[cx-.6,roof+(gun?2.46:1.91),0],'light','y',24);
  for(const z of [-.9,.9]){rod([cx-.92,roof+.16,z],[cx-1.14,roof+(gun?2.12:1.8),z],.013,'edge');torus(.26,.055,[cx-1.8,D+1.0,z*1.6],'orange','z',32,10);}
  if(gun){
   const shipTurret=k.mark();cyl(.74,.92,.32,[4.50,D+.31,0],'steel','y',40);profile([[-.90,0],[-.72,.72],[.19,1.05],[.92,.47],[.74,0]],1.43,'white',[4.5,D+.45,0],.06);const shipBarrel=k.mark();cyl(.075,.10,2.5,[6.35,D+1.01,0],'steel','x',32);cyl(.12,.12,.26,[7.66,D+1.01,0],'edge','x',28);
   k.joint('barrel',[5.13,D+1.01,0],shipBarrel,{parent:'turret',kind:'barrel'});k.joint('turret',[4.5,D+.45,0],shipTurret,{kind:'turret'});
   for(const s of [-1,1])box([1.55,.48,.55],[-5.0,D+.35,s*.88],'white',.09);label('COASTAL / 04',[2.4,.35],[-1.7,D-.40,W*.44],'#e4ebdf','#344b52');
  }else{for(const s of [-1,1])outboard(k,-L*.49,D+.1,s*.65,1.2);box([1.27,.32,1.74],[-4.2,D+.24,0],'white',.06);label('PATROL 06',[1.9,.3],[-1.5,D-.34,W*.44],'#e4ebdf','#344b52');}
  for(const s of [-1,1]){cyl(.16,.16,.29,[cx+1.15,roof+.27,s*.9],'steel','x',24);cyl(.125,.125,.045,[cx+1.32,roof+.27,s*.9],'light','x',24);}
 }else if(kind==='workboat'){
  // Forward wheelhouse and a clear rear working deck.
  profile([[.4,D+.12],[.4,4.78],[4.76,4.78],[5.56,3.91],[5.56,D+.12]],4.45,'orange',[0,0,0],.11);
  box([5.85,.19,4.95],[2.85,4.95,0],'white',.08);
  for(const s of [-1,1])for(let j=0;j<4;j++)box([.93,1.21,.04],[1.1+j*1.18,3.84,s*2.27],'glassDark',.05);
  box([.08,1.27,3.96],[5.24,3.89,0],'glassDark',.05,[0,0,.43]);box([.08,1.75,1.0],[.32,2.12,.99],'white',.04);
  for(const s of [-1,1]){rail(k,[[-8.9,D+.15,s*2.8],[-6.8,D+.15,s*3.15],[-4.5,D+.15,s*3.2],[-2,D+.15,s*3.2]],.93,.04);for(let j=0;j<7;j++)torus(.41,.12,[-8.1+j*2.35,D-.13,s*(W*.47)],'rubber','z',32,10);torus(.43,.095,[1.0,2.01,s*2.34],'orange','z',36,10);}
  // Hydraulic deck crane: real articulated silhouette, not a single stick.
  cyl(.67,.78,.38,[-5.3,D+.29,-1.25],'steel','y',36);cyl(.32,.42,2.12,[-5.3,D+1.5,-1.25],'orange','y',28);
  rod([-5.3,D+2.44,-1.25],[-3.15,D+5.3,-1.25],.18,'orange');rod([-3.15,D+5.3,-1.25],[-.55,D+4.65,-1.25],.13,'orange');rod([-5.22,D+1.6,-1.25],[-3.70,D+4.6,-1.25],.085,'metal');rod([-.55,D+4.6,-1.25],[-.55,D+2.23,-1.25],.023,'steel');torus(.17,.05,[-.55,D+2.07,-1.25],'metal','z',24,8);
  cyl(.57,.57,1.29,[-6.45,D+.77,1.2],'steel','z',32);for(let j=0;j<15;j++)torus(.46,.025,[-6.45,D+.77,1.2+(j-7)*.075],'tan','z',28,6);for(const z of [.4,2.0])box([1.15,.69,.14],[-6.45,D+.38,z],'steel',.035);
  cyl(.10,.14,2.2,[2.71,6.1,0],'steel','y',24);box([.38,.35,1.6],[2.71,7.32,0],'white',.08);rod([2.71,6.6,-1.3],[2.71,6.6,1.3],.045,'steel');
  for(const s of [-1,1]){cyl(.3,.3,1.0,[1.02,5.48,s*1.22],'white','x',28);grille([3.9,5.08,s*.85],[1.2,.08,.65],8,'steel','top');}
  label('PORT SERVICE / 12',[3.2,.4],[-4.4,D-.5,W*.43],'#e1e5df','#1d2c35');
 }else if(kind==='ferry'){
  const roofLevels=[D+2.9,D+5.4];
  for(let floor=0;floor<2;floor++){
   const y=D+.18+floor*2.45;
   profile([[-13.8,y],[-13.8,y+2.24],[10.3-floor*.9,y+2.24],[12.0-floor*.8,y+1.54],[12.2-floor*.8,y]],8.12-floor*.5,'white',[0,0,0],.11);
   box([27.3-floor*1.1,.16,8.72-floor*.43],[-.9-floor*.3,y+2.36,0],'white',.06);
   for(const s of [-1,1])for(let j=0;j<15-floor;j++){const x=-12.87+j*1.63;box([1.35,1.29,.035],[x,y+1.30,s*(4.08-floor*.25)],'glassDark',.07);box([.035,1.34,.06],[x-.69,y+1.3,s*(4.11-floor*.25)],'metal',.006);}
  }
  box([.10,1.28,7.24],[11.37,D+3.98,0],'glassDark',.055,[0,0,.56]);
  for(const s of [-1,1]){
   const pts=[];for(let j=0;j<16;j++){const x=-15.9+j*2.0;const f=x/L+.5;pts.push([x,D+.18,s*water.halfWidth(f)*.94]);}rail(k,pts,1.0,.05);
   rail(k,[[-13.6,D+5.13,s*3.6],[-8,D+5.13,s*3.6],[-2,D+5.13,s*3.6],[4,D+5.13,s*3.6],[10,D+5.13,s*3.6]],.93,.04);
   for(let j=0;j<3;j++){const x=-9.8+j*6.0;ellipsoid([1.81,.68,.65],[x,D+5.55,s*3.15],'orange');for(const dx of [-.9,.9])rod([x+dx,D+5.2,s*3.5],[x+dx,D+6.35,s*3.4],.05,'metal');}
   for(let j=0;j<6;j++)torus(.41,.09,[-11.6+j*4.4,D+1.65,s*4.2],'orange','z',32,8);
  }
  // Exterior aft stairs are modeled as traversable-looking stepped flights.
  for(const s of [-1,1]){for(let i=0;i<13;i++)box([.35,.16,1.08],[-14.2+i*.30,D+.23+i*.18,s*3.13],'steel',.015);rod([-14.5,D+1.12,s*3.68],[-10.31,D+3.56,s*3.68],.04,'metal');}
  box([4.2,.68,3.0],[-2.1,D+5.43,0],'white',.14);grille([-2.1,D+5.82,0],[3.6,.05,2.4],18,'steel','top');
  cyl(.19,.22,2.05,[5.85,D+6.1,0],'steel','y',28);box([.38,.42,2.05],[5.85,D+7.22,0],'white',.1);rod([5.85,D+6.55,-1.8],[5.85,D+6.55,1.8],.055,'steel');
  for(const x of [-8,-5,-2,1,4])for(const z of [-1.4,1.4]){box([1.1,.14,.55],[x,D+5.17,z],'wood',.04);for(const xx of [x-.37,x+.37])box([.09,.48,.45],[xx,D+4.92,z],'steel',.015);}
  label('WESTPORT LINE',[5.2,.7],[-3.8,D-.75,W*.45],'#e3ecea','#344b52');label('WP / 07',[2.4,.6],[11.3,D-.44,3.1],'#e3ecea','#344b52');
 }
}

function airfoil(k,span,rootChord,tipChord,rootX,tipX,y,mat='paint',side=1,dihedral=.04){
 const T=k.T,S=20,N=40,p=[],idx=[],uv=[];
 for(let j=0;j<=S;j++){const f=j/S,z=span*f*side,chord=rootChord+(tipChord-rootChord)*f,lead=rootX+(tipX-rootX)*f,th=.13-.045*f;
  for(let i=0;i<=N;i++){const a=i/N*2*Math.PI,u=(1-Math.cos(a))/2,sign=i<=N/2?1:-1;const t=5*th*(.2969*Math.sqrt(u)-.126*u-.3516*u*u+.2843*u*u*u-.1015*u*u*u*u);const camber=.018*4*u*(1-u);p.push(lead-chord*u,y+span*f*dihedral+(sign*t+camber)*chord,z);uv.push(u,f);}}
 for(let j=0;j<S;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i,b=a+N+1;if(side>0)idx.push(a,a+1,b,b,a+1,b+1);else idx.push(a,b,a+1,b,b+1,a+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();k.mesh(g,mat,[0,0,0],[0,0,0],'cambered-airfoil');
 const z=span*side,x=tipX-tipChord*.5;k.ellipsoid([tipChord*.49,.07,span*.025],[x,y+span*dihedral,z],mat);
 return {trailing:(f)=>[rootX+(tipX-rootX)*f-(rootChord+(tipChord-rootChord)*f),y+span*f*dihedral,span*f*side]};
}
function aircraft(k,kind){
 const {T,box,loft,profile,cyl,rod,tube,ellipsoid,wheel,torus,label,mats}=k;
 if(kind==='fighter'){
  mats.paint.color.setHex(0x526874);mats.darkPaint.color.setHex(0x263d48);
  loft([[-4.3,1.56,.07,.13],[-3.5,1.57,.23,.33],[-2.4,1.61,.38,.5],[-.9,1.65,.54,.69],[.65,1.64,.58,.70],[1.9,1.58,.56,.61],[2.85,1.55,.48,.49],[3.15,1.55,.4,.39]],'paint',48);
  cyl(.50,.51,.29,[2.73,1.55,0],'yellow','x',48);cyl(.49,.49,.07,[2.91,1.55,0],'steel','x',48);ellipsoid([.38,.34,.34],[3.23,1.55,0],'yellow');cyl(.15,.15,.28,[3.38,1.55,0],'steel','x',32);
  const propStart=k.mark();for(let i=0;i<4;i++){const a=i*Math.PI/2+.25,g=new T.Group();g.position.set(3.42,1.55,0);g.rotation.x=a;k.root.add(g);const s=new T.Shape();s.moveTo(0,.21);s.lineTo(.15,.49);s.lineTo(.19,1.37);s.quadraticCurveTo(.11,1.65,-.04,1.65);s.lineTo(-.13,1.2);s.lineTo(-.08,.42);s.closePath();const geo=new T.ExtrudeGeometry(s,{depth:.045,bevelEnabled:true,bevelThickness:.018,bevelSize:.02,bevelSegments:2,curveSegments:8});geo.rotateY(Math.PI/2);k.mesh(geo,'edge',[0,0,0],[0,0,0],'propeller-blade',g);}
  k.joint('prop',[3.42,1.55,0],propStart,{kind:'prop'});
  for(const s of [-1,1]){
   const wing=airfoil(k,5.05,2.61,.58,1.2,-.75,1.33,'paint',s,.035);
   airfoil(k,2.10,1.13,.42,-2.55,-3.1,1.61,'darkPaint',s,.025);
   const trail=[];for(let j=7;j<=19;j++){const f=j/20,p=wing.trailing(f);trail.push([p[0]+.24,p[1]+.025,p[2]]);}tube(trail,.008,'edge',30);
   box([.74,.045,.19],[-.92,1.54,s*4.53],'yellow',.015);
   cyl(.034,.034,.64,[1.09,1.47,s*1.78],'edge','x',18);cyl(.034,.034,.56,[1.00,1.47,s*2.1],'edge','x',18);
   rod([.14,1.22,s*1.28],[.35,.45,s*1.64],.065,'steel');rod([.24,1.11,s*1.52],[.35,.45,s*1.64],.036,'metal');wheel(.35,.4,s*1.68,.4,.21,false);
   for(let j=0;j<6;j++)cyl(.052,.052,.11,[1.77-j*.15,1.28,s*.53],'steel','z',16);
  }
  profile([[-4.02,1.62],[-3.86,2.97],[-3.49,3.14],[-2.75,1.65]],.13,'darkPaint',[0,0,0],.04);
  // Canopy on a solid sill; windshield and curved framework remain separate parts.
  ellipsoid([1.02,.59,.50],[-.48,2.06,0],'glassDark',k.root,40,22);box([2.03,.065,1.07],[-.48,1.98,0],'metal',.035);
  for(const x of [-1.22,-.39,.29])tube([[x,2.02,-.47],[x,2.45,-.32],[x,2.64,0],[x,2.45,.32],[x,2.02,.47]],.024,'steel',28);
  tube([[-1.45,2.0,0],[-1.12,2.48,0],[-.4,2.65,0],[.38,2.28,0]],.023,'metal',36);
  cyl(.11,.11,.20,[-3.67,.68,0],'steel','y',18);wheel(-3.67,.22,0,.22,.14,false);rod([-3.67,.42,0],[-3.44,1.38,0],.041,'steel');
  box([1.01,.19,.46],[.33,.94,0],'edge',.045);for(let j=0;j<8;j++)box([.045,.12,.38],[.05+j*.09,.93,0],'metal',0);
  for(const s of [-1,1]){label('W-07',[.93,.27],[-2.13,1.68,s*.379],'#d8e0d7','#526874',s<0?[0,Math.PI,0]:[0,0,0]);for(let j=0;j<10;j++)ellipsoid([.014,.014,.008],[.8-j*.36,1.69,s*(.52-j*.023)],'metal',k.root,8,6);}
 }else{
  mats.paint.color.setHex(0x51616d);mats.darkPaint.color.setHex(0x2d3e4b);
  loft([[-10.8,1.86,.10,.16],[-9.8,1.85,.35,.4],[-7.2,1.65,.64,.67],[-3,1.52,.88,.90],[4.0,1.53,.92,.94],[7.5,1.5,.87,.86],[9.6,1.43,.62,.61],[11.2,1.28,.07,.1]],'paint',48);
  for(const s of [-1,1]){
   const w=airfoil(k,15.4,5.7,1.2,3.4,-4.5,1.67,'paint',s,.015);airfoil(k,5.15,2.35,.65,-7.07,-9.07,2.11,'darkPaint',s,.05);
   for(const z of [5.1,9.15]){
    const x=z===5.1?.18:-1.45;
    profile([[-.6,0],[-.5,.93],[.55,1.01],[.81,.1]],.22,'steel',[x, .52,s*z],.03);
    loft([[x-2.01,.05,.43,.43],[x-1.6,.05,.59,.59],[x+.98,.05,.61,.61],[x+1.48,.05,.50,.50]],'darkPaint',36);
    // The independent pod is shifted to its wing station after creating loft.
    const pod=k.root.children.at(-1);pod.position.z=s*z;
    cyl(.52,.57,.13,[x+1.5,.05,s*z],'metal','x',36);cyl(.44,.44,.04,[x+1.58,.05,s*z],'rubber','x',36);cyl(.16,.1,.15,[x+1.6,.05,s*z],'steel','x',28);
    for(let j=0;j<16;j++){const a=j/16*Math.PI*2;rod([x+1.60,.05+Math.cos(a)*.20,s*z+Math.sin(a)*.2],[x+1.60,.05+Math.cos(a+.19)*.39,s*z+Math.sin(a+.19)*.39],.019,'metal');}
    cyl(.42,.49,.13,[x-2.03,.05,s*z],'metal','x',32);cyl(.34,.36,.04,[x-2.11,.05,s*z],'edge','x',32);
   }
   const trail=[];for(let j=6;j<=19;j++){const p=w.trailing(j/20);trail.push([p[0]+.34,p[1]+.04,p[2]]);}tube(trail,.017,'edge',40);
   box([1.51,.04,.22],[-4.75,1.94,s*13.68],'yellow',.02);
  }
  profile([[-10.39,1.94],[-9.79,6.29],[-8.77,6.60],[-6.47,2.0]],.22,'darkPaint',[0,0,0],.06);
  // Cockpit panels follow the curved nose instead of one black rectangular patch.
  for(const s of [-1,1]){
   profile([[7.5,1.95],[7.60,2.38],[8.47,2.20],[8.97,1.87]],.035,'glassDark',[0,0,s*.63],.02);
   box([1.10,.035,.78],[8.10,2.35,s*.28],'glassDark',.035,[0,0,-.16]);
  }
  for(const x of [-3.9,3.2]){rod([x,.99,0],[x,-.73,0],.13,'steel');for(const s of [-1,1])for(const dx of [-.38,.38])wheel(x+dx,-.73,s*.50,.44,.28,false);box([1.45,.10,1.24],[x,.54,0],'darkPaint',.04);}
  for(const s of [-1,1]){for(let j=0;j<12;j++)ellipsoid([.023,.022,.011],[-6.7+j*.89,1.7,s*.86],'metal',k.root,8,6);label('WESTPORT / 09',[2.55,.42],[-4.65,1.78,s*.79],'#d5dcd9','#51616d',s<0?[0,Math.PI,0]:[0,0,0]);}
  cyl(.14,.18,.81,[9.17,-.31,0],'steel','y',24);wheel(9.17,-.83,0,.35,.26,false);box([2.9,.08,1.05],[-1.05,.62,0],'edge',.035);
 }
}

function buildApprovedVehicle(T,id,options={}){
 const row=catalog.find(x=>x.id===id);if(!row)throw new Error('Unknown vehicle '+id);
 const k=makeKit(T,row.title+' · 고품질 재설계',{...options,id});const kind=id.replace('vehicle-','');
 if(['sedan','buggy','deck-tractor'].includes(kind))roadCar(k,kind==='deck-tractor'?'tractor':kind);
 else if(kind==='bus')bus(k);
 else if(['tank','apc','military-truck','sam'].includes(kind))military(k,kind==='military-truck'?'truck':kind);
 else if(['fighter','bomber'].includes(kind))aircraft(k,kind);
 else boat(k,kind);
 const rotate=['deck-tractor','rhib','military-truck','sam','bomber'].includes(kind)?-Math.PI/2:0;
 setVehicleAnchors(k,id);return k.finish({rotateY:rotate,bounds:row.source_bounds});
}

const vehicleCaches=new WeakMap();
const vehicleSharedResources=new WeakSet();
function markHQVehicleShared(resource){if(!resource)return;vehicleSharedResources.add(resource);resource.userData={...resource.userData,hq50Shared:true,hq50Owner:'vehicle-template'};}
const vehicleAliases={tractor:'deck-tractor',deckTractor:'deck-tractor',deck_tractor:'deck-tractor',truck:'military-truck',naval_rhib:'rhib',carrier_rhib:'rhib',ship:'gunboat',boat:'patrol-boat'};
const vehicleId=value=>{const key=String(value||'').replace(/^vehicle-/,'');return 'vehicle-'+(vehicleAliases[key]||key);};
const vehicleRows=new Map(catalog.map(row=>[row.id,row]));
const defaultGrounded=id=>id==='vehicle-sedan'||id==='vehicle-bus';
function getVehicleCache(T){let cache=vehicleCaches.get(T);if(!cache){cache={templates:new Map(),pools:new Map(),refs:0};vehicleCaches.set(T,cache);}return cache;}
function vehicleTemplate(T,id,forward='+X'){
 const cache=getVehicleCache(T),key=id+'|'+forward;
 if(!cache.templates.has(key)){const template=buildApprovedVehicle(T,id,{forward});template.traverse(mesh=>{if(!mesh.isMesh)return;markHQVehicleShared(mesh.geometry);for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){markHQVehicleShared(material);for(const value of Object.values(material))if(value?.isTexture)markHQVehicleShared(value);}});cache.templates.set(key,template);}
 return cache.templates.get(key);
}
function deriveVehicleDefinition(T,id){
 const source=vehicleTemplate(T,id,'+X'),raw=source.userData.approvedBounds,min=[...raw.min],max=[...raw.max],groundAligned=defaultGrounded(id),groundShift=groundAligned?-min[1]:0;
 min[1]+=groundShift;max[1]+=groundShift;
 const length=max[0]-min[0],width=max[2]-min[2],height=max[1]-min[1],points=source.userData.anchors;
 const driver=points.driverSeat?{forward:points.driverSeat[0],height:points.driverSeat[1]+groundShift,left:-points.driverSeat[2]}:null;
 const wheels=[];source.traverse(o=>{if(o.userData.kind==='wheel')wheels.push(o);});
 const front=wheels.filter(w=>w.userData.front),rear=wheels.filter(w=>!w.userData.front),average=a=>a.reduce((sum,v)=>sum+v,0)/Math.max(1,a.length);
 const wheelRadius=average((front.length?front:wheels).map(w=>w.userData.radius))||.5;
 const wheelbase=front.length&&rear.length?average(front.map(w=>w.position.x))-average(rear.map(w=>w.position.x)):Math.max(1,length*.6);
 const scale=source.userData.modelScale,poseScale={sedan:.80,bus:.86,'deck-tractor':.94,buggy:.84,rhib:.76,'military-truck':1,sam:1}[id.replace('vehicle-','')]||.9;
 const definition={kind:id,hqVisual:id,name:vehicleRows.get(id).title,frontAxis:'+X',length,width,height,
  bounds:{min,max},groundOffset:0,groundAligned,groundShift,wheelRadius,wheelbase,
  collisionRadius:width*.48,collisionOffset:Math.max(0,(length-width*.96)/2),hitHeight:max[1],
  cameraDistance:Math.max(7.5,length*1.30),cameraHeight:Math.max(2.1,height*.78),
  driverSeat:driver,driverPose:{scale:Math.max(.5,Math.min(1.15,poseScale*scale)),recline:id==='vehicle-sedan'?.50:.06,hipDrop:0},
  anchors:Object.fromEntries(Object.entries(points).map(([name,p])=>[name,[p[0],p[1]+groundShift,p[2]]]))};
 return definition;
}
function makeVehiclePaint(T,meshes,ownedMaterials){
 const original=new Map(meshes.map(m=>[m,m.material])),clones=new Map(),baseEmissive=new Map();let active=false;
 const color=new T.Color(0),setRGB=color.setRGB;let lastR=0,lastG=0,lastB=0;
 function ensure(){if(active)return;active=true;for(const mesh of meshes){const source=original.get(mesh);if(!source?.emissive)continue;if(!clones.has(source)){const material=source.clone();material.userData={...material.userData,hq50Shared:false,hq50Owner:'vehicle-instance'};clones.set(source,material);baseEmissive.set(material,source.emissive.clone());ownedMaterials.add(material);}mesh.material=clones.get(source);}}
 color.setRGB=function(r,g,b){if(r===lastR&&g===lastG&&b===lastB)return this;lastR=r;lastG=g;lastB=b;setRGB.call(this,r,g,b);if(r||g||b)ensure();if(active)for(const [material,base]of baseEmissive)material.emissive.setRGB(base.r+r,base.g+g,base.b+b);return this;};
 return {paint:{emissive:color},original,clones,materialFor:mesh=>clones.get(original.get(mesh))||original.get(mesh)};
}
function makePatrolWeapon(T,visual,options){
 if(options.patrolWeapon===false)return;
 const supplied=options.patrolWeaponFactory?.(T,visual.anchors.weaponMount,visual);
 if(supplied){visual.group.add(supplied.turret);visual.turret=supplied.turret;visual.barrel=supplied.barrel;visual.weaponAttachment='legacy-patrol-cannon';const muzzle=supplied.muzzleNode||new T.Object3D();if(!supplied.muzzleNode){muzzle.name='Patrol_Muzzle';muzzle.position.set(2.76,0,0);visual.barrel.add(muzzle);}visual.muzzleNode=muzzle;return;}
 // The selected patrol hull was approved without a weapon. Preserve its exact
 // geometry and add the existing game's small functional cannon above the bow.
 const turret=new T.Group(),barrel=new T.Group(),mount=visual.anchors.weaponMount||new T.Vector3(3.5,1.6,0);
 turret.name='LegacyPatrol_Turret';turret.position.copy(mount);turret.userData={hq50Attachment:true,axis:'y'};barrel.name='LegacyPatrol_Barrel';barrel.position.set(.5,.15,0);barrel.userData={hq50Attachment:true,axis:'z'};
 const paint=new T.MeshStandardMaterial({color:0x5a5650,metalness:.3,roughness:.55}),dark=new T.MeshStandardMaterial({color:0x26282c,metalness:.65,roughness:.4});visual.ownedMaterials.add(paint);visual.ownedMaterials.add(dark);
 function part(geometry,material,position,rotation=[0,0,0],parent=turret){const mesh=new T.Mesh(geometry,material);mesh.position.set(...position);mesh.rotation.set(...rotation);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.hq50Attachment=true;parent.add(mesh);visual.ownedGeometries.add(geometry);return mesh;}
 part(new T.CylinderGeometry(.4,.4,.3,20),dark,[0,-.3,0]);part(new T.BoxGeometry(1.6,.75,1.5),paint,[0,0,0]);part(new T.BoxGeometry(.5,.55,1.2),paint,[.55,.05,0],[0,0,-.35]);
 part(new T.CylinderGeometry(.1,.1,2.6,24),dark,[1.3,0,0],[0,0,Math.PI/2],barrel);part(new T.CylinderGeometry(.15,.15,.312,24),dark,[1.612,0,0],[0,0,Math.PI/2],barrel);part(new T.BoxGeometry(.32,.26,.26),dark,[2.6,0,0],[0,0,0],barrel);
 turret.add(barrel);if(visual.forward==='+Z'){const wrapper=new T.Group();wrapper.position.copy(turret.position);turret.position.set(0,0,0);wrapper.rotation.y=-Math.PI/2;wrapper.add(turret);visual.group.add(wrapper);}else visual.group.add(turret);
 visual.turret=turret;visual.barrel=barrel;visual.weaponAttachment='legacy-patrol-cannon';
 const muzzle=new T.Object3D();muzzle.name='Patrol_Muzzle';muzzle.position.set(2.76,0,0);barrel.add(muzzle);visual.muzzleNode=muzzle;
}
function createHQVehicle(T,requestedId,options={}){
 const id=vehicleId(requestedId);if(!vehicleRows.has(id))throw new Error('Unknown approved vehicle '+requestedId);
 const forward=options.forward==='+Z'?'+Z':'+X',cache=getVehicleCache(T),template=vehicleTemplate(T,id,forward),model=template.clone(true),group=new T.Group();cache.refs++;
 const definition=VEHICLE_DEFINITIONS[id]||deriveVehicleDefinition(T,id),grounded=options.grounded??definition.groundAligned;
 group.name='HQ50 '+vehicleRows.get(id).title;group.rotation.order='YZX';group.userData={approvedRedesign:id,hq50Category:'vehicles',frontAxis:forward,origin:grounded?'ground_plane':'approved_source',rigged:true};
 if(grounded)model.position.y=-template.userData.approvedBounds.min[1];group.add(model);
 const wheels=[],steering=[],meshes=[],ownedMaterials=new Set(),ownedGeometries=new Set();
 const nodes=new Map();model.traverse(node=>{if(node.userData.hq50Joint)nodes.set(node.name,node);if(node.isMesh)meshes.push(node);});
 for(const node of nodes.values())if(node.userData.kind==='wheel'){
  const pivot=new T.Group();pivot.name=node.name+'_steering';pivot.position.copy(node.position);pivot.quaternion.copy(node.quaternion);pivot.userData={dynamic:true,joint:'naval_steering_axle',hq50Joint:true};
  node.parent.add(pivot);pivot.add(node);node.position.set(0,0,0);node.quaternion.identity();
  wheels.push({pivot,spin:node,node,front:!!node.userData.front,radius:node.userData.radius,axis:node.userData.axis,rest:node.rotation.clone()});
 }else if(node.userData.kind==='steering')steering.push({node,axis:node.userData.axis,rest:node.rotation.clone()});
 const anchors=Object.fromEntries(Object.entries(model.userData.anchors).map(([name,p])=>[name,new T.Vector3(p[0],p[1]+model.position.y,p[2])]));
 const materialState=makeVehiclePaint(T,meshes,ownedMaterials),visual={group,model,definition,forward,wheels,steering,anchors,
  prop:nodes.get('prop')||null,turret:nodes.get('turret')||nodes.get('launcher_yaw')||null,barrel:nodes.get('barrel')||nodes.get('launcher_elevation')||null,
  launcherYaw:nodes.get('launcher_yaw')||null,launcherElevation:nodes.get('launcher_elevation')||null,radar:nodes.get('radar_azimuth')||null,
  bombs:[],paint:materialState.paint,mBody:materialState.paint,premTried:true,approvedRedesign:id,ownedMaterials,ownedGeometries,wasDead:false,wreck:false};
 if(id==='vehicle-patrol-boat')makePatrolWeapon(T,visual,options);
 // Boat callers keep the old holder contract. Unarmed boats had empty weapon
 // nodes previously too; these remain harmless compatibility placeholders.
 if(!visual.turret){visual.turret=new T.Group();visual.turret.name='Unarmed_turret_placeholder';group.add(visual.turret);}
 if(!visual.barrel){visual.barrel=new T.Group();visual.barrel.name='Unarmed_barrel_placeholder';visual.turret.add(visual.barrel);}
 if(anchors.muzzle&&!visual.muzzleNode){group.updateMatrixWorld(true);const muzzle=new T.Object3D(),parent=visual.barrel.userData.kind==='barrel'?visual.barrel:group;muzzle.name='HQ50_Muzzle';muzzle.position.copy(parent.worldToLocal(group.localToWorld(anchors.muzzle.clone())));parent.add(muzzle);visual.muzzleNode=muzzle;}
 // Rig pivots and the vehicle root keep automatic transforms. Their rigid
 // surface meshes never change locally, even while their parent wheel/turret
 // moves, so composing those same local matrices every frame is unnecessary.
 for(const mesh of meshes){mesh.updateMatrix();mesh.matrixAutoUpdate=false;}
 const farVisual=options.farVisual||null;let disposed=false,dead=false,far=false,quality='high',shadowEnabled=null;const shadowDefaults=new Map(meshes.map(mesh=>[mesh,mesh.castShadow]));
 visual.farVisual=farVisual;
 visual.update=function(state={},steerArg,deadArg,view={}){
  if(disposed)return;if(typeof state==='number')state={...view,travel:state,steer:steerArg,dead:deadArg};
  if(state.quality)quality=state.quality;
  if(farVisual){if(Number.isFinite(state.distance)){const cutoff=quality==='low'?85:140;far=state.distance>cutoff+(far?-10:10);}model.visible=!far;farVisual.group.visible=far;
   const travel=Number.isFinite(state.travel)?state.travel:Number.isFinite(state.wheel)?state.wheel*definition.wheelRadius:undefined;
   farVisual.update(travel,state.steer,typeof state.dead==='boolean'?state.dead:dead,{distance:state.distance,quality});
  }
  const steer=Number.isFinite(state.steer)?Math.max(-1,Math.min(1,state.steer))*.45:null;
  if(!far)for(const wheel of wheels){const angle=Number.isFinite(state.wheel)?state.wheel:Number.isFinite(state.travel)?state.travel/wheel.radius:null;if(angle!==null)wheel.spin.rotation[wheel.axis]=(forward==='+X'?-1:1)*angle;if(steer!==null&&wheel.front)wheel.pivot.rotation.y=-steer;}
  if(!far&&steer!==null)for(const item of steering)item.node.rotation[item.axis]=item.rest[item.axis]-steer*2;
  if(Number.isFinite(state.propAngle)&&visual.prop)visual.prop.rotation[visual.prop.userData.axis]=state.propAngle;
  if(Number.isFinite(state.aimYaw)&&visual.turret)visual.turret.rotation.y=state.aimYaw;
  if(Number.isFinite(state.aimElevation)&&visual.barrel){const axis=visual.barrel.userData.axis||'z';visual.barrel.rotation[axis]=(axis==='x'?-1:1)*state.aimElevation;}
  if(Number.isFinite(state.radarAngle)&&visual.radar)visual.radar.rotation.y=state.radarAngle;
  if(Number.isFinite(state.flash))visual.paint.emissive.setRGB(state.flash*.6,state.flash*.15,state.flash*.1);
  if(typeof state.dead==='boolean'&&state.dead!==dead){dead=state.dead;visual.wasDead=dead;visual.wreck=dead;for(const mesh of meshes)mesh.material=dead&&options.wreckMaterial?options.wreckMaterial:materialState.materialFor(mesh);}
  if(state.quality||Number.isFinite(state.distance)){
   const enabled=quality!=='low'&&(!Number.isFinite(state.distance)||state.distance<180);
   if(enabled!==shadowEnabled){shadowEnabled=enabled;for(const mesh of meshes)mesh.castShadow=shadowDefaults.get(mesh)&&enabled;}
  }
 };
 visual.dispose=function(){if(disposed)return;disposed=true;farVisual?.dispose();group.removeFromParent();group.clear();cache.refs--;for(const material of ownedMaterials)material.dispose();for(const geometry of ownedGeometries)geometry.dispose();};
 Object.defineProperty(visual,'disposed',{get:()=>disposed});Object.defineProperty(visual,'lod',{get:()=>far?'far':'approved'});group.updateMatrixWorld(true);visual.bounds=new T.Box3().setFromObject(group);visual.origin=group.userData.origin;
 if(farVisual){const base=farVisual.definition||definition;farVisual.group.scale.set(definition.length/base.length,definition.height/base.height,definition.width/base.width);if(forward==='+Z')farVisual.group.rotation.y=-Math.PI/2;farVisual.group.name='HQ50 distant proxy';farVisual.group.userData.hq50FarProxy=true;farVisual.group.visible=false;group.add(farVisual.group);}
 return visual;
}
function createHQVehiclePool(T,requestedId,capacity,parent,options={}){
 const id=vehicleId(requestedId),forward=options.forward||'+Z',cache=getVehicleCache(T),key=id+'|'+forward;
 if(!cache.pools.has(key)){
  const source=vehicleTemplate(T,id,forward),byMaterial=new Map();source.updateMatrixWorld(true);source.traverse(mesh=>{if(!mesh.isMesh)return;const g=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);if(!byMaterial.has(mesh.material))byMaterial.set(mesh.material,[]);byMaterial.get(mesh.material).push(g);});
  const parts=[];for(const [material,gs]of byMaterial){let count=0;for(const g of gs)count+=g.attributes.position.count;const pos=new Float32Array(count*3),normal=new Float32Array(count*3),uv=new Float32Array(count*2);let at=0;for(const g of gs){pos.set(g.attributes.position.array,at*3);normal.set(g.attributes.normal.array,at*3);uv.set(g.attributes.uv.array,at*2);at+=g.attributes.position.count;g.dispose();}const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(pos,3));geometry.setAttribute('normal',new T.BufferAttribute(normal,3));geometry.setAttribute('uv',new T.BufferAttribute(uv,2));geometry.computeBoundingBox();geometry.computeBoundingSphere();parts.push({geometry,material});}cache.pools.set(key,parts);
 }
 const pool={kind:options.kind||id.replace('vehicle-',''),capacity,groups:[],entities:[],approvedRedesign:id};
 for(const {geometry,material}of cache.pools.get(key)){markHQVehicleShared(geometry);const mesh=new T.InstancedMesh(geometry,material,capacity);mesh.name='HQ50 '+id+' / '+material.name;mesh.userData={approvedRedesign:id,hq50Geometry:true};mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=true;mesh.count=0;parent?.add(mesh);pool.groups.push({mesh,parts:[{shape:'approved-model',material:'authored',color:'#ffffff',x:0,y:0,z:0,rx:0,ry:0,rz:0,sx:1,sy:1,sz:1}]});}
 pool.dispose=()=>{for(const {mesh}of pool.groups)mesh.removeFromParent();pool.groups.length=0;pool.entities.length=0;};return pool;
}
function inspectHQVehicle(T,requestedId){const id=vehicleId(requestedId),template=vehicleTemplate(T,id,'+X');let meshes=0,triangles=0;template.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;}});return{id,meshes,triangles,joints:[...template.userData.joints],definition:deriveVehicleDefinition(T,id),sourceKey:vehicleRows.get(id).source_key};}
for(const definition of Object.values(VEHICLE_DEFINITIONS)){Object.freeze(definition.driverPose);if(definition.driverSeat)Object.freeze(definition.driverSeat);Object.freeze(definition);}
global.HanQHQ50Vehicles=Object.freeze({version:'hq50-vehicles-20261119-v1',ids:Object.freeze(catalog.map(row=>row.id)),catalog:Object.freeze(catalog.map(({id,title,source_key})=>Object.freeze({id,title,source_key}))),
 has:id=>vehicleRows.has(vehicleId(id)),definition:id=>VEHICLE_DEFINITIONS[vehicleId(id)]||null,isSharedResource:resource=>vehicleSharedResources.has(resource),create:createHQVehicle,createPool:createHQVehiclePool,inspect:inspectHQVehicle,
 createStatic:(T,id,options={})=>createHQVehicle(T,id,options).group});

})(typeof window!=='undefined'?window:globalThis);
