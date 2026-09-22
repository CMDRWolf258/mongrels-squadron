export async function loadActiveMongrelSystems(request){
  try{
    const url=new URL('/data/live-bgs.json',request.url);
    const response=await fetch(url.toString(),{headers:{Accept:'application/json'},cf:{cacheTtl:0}});
    if(!response.ok)throw new Error('live_bgs_'+response.status);
    const data=await response.json();
    return (Array.isArray(data?.systems)?data.systems:[])
      .filter(row=>row?.name&&row.present!==false&&row.formerPresence!==true)
      .map(row=>({
        name:clean(row.name).slice(0,140),
        coords:normalizeCoordinates(row.coords),
        coordsSource:clean(row.coordsSource||'').slice(0,80),
      }));
  }catch(error){
    console.error('Scout systems could not load active Mongrel presence',error);
    return[];
  }
}

export function normalizeScoutCoordinates(value){
  const source=Array.isArray(value)
    ? {x:value[0],y:value[1],z:value[2]}
    : (value&&typeof value==='object'?value:null);
  if(!source)return null;
  const x=Number(source.x),y=Number(source.y),z=Number(source.z);
  return Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z)?{x,y,z}:null;
}

function normalizeCoordinates(value){return normalizeScoutCoordinates(value)}
function clean(value){return typeof value==='string'?value.trim():String(value??'').trim()}
