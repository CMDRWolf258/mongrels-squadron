const FILES = [
  { source:'/downloads/mongrel-scout/load.py', path:'MongrelScout/load.py' },
  { source:'/downloads/mongrel-scout/README.md', path:'MongrelScout/README.md' },
];

export async function onRequestGet({ request }) {
  try {
    const entries = [];
    for (const file of FILES) {
      const url = new URL(file.source, request.url);
      const response = await fetch(url.toString(), {headers:{Accept:'text/plain'}, cf:{cacheTtl:300}});
      if (!response.ok) throw new Error(`${file.source} returned ${response.status}`);
      entries.push({name:file.path,data:new Uint8Array(await response.arrayBuffer())});
    }
    const zip = buildStoredZip(entries);
    return new Response(zip, {
      status:200,
      headers:{
        'Content-Type':'application/zip',
        'Content-Disposition':'attachment; filename="MongrelScout.zip"',
        'Cache-Control':'public, max-age=300',
        'X-Content-Type-Options':'nosniff',
      },
    });
  } catch (error) {
    console.error('Could not package Mongrel Scout plugin', error);
    return new Response('Mongrel Scout download is temporarily unavailable.', {
      status:503,
      headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'},
    });
  }
}

function buildStoredZip(entries) {
  const encoder = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);

    const local = new Uint8Array(30 + name.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0,0x04034b50,true);
    lv.setUint16(4,20,true);
    lv.setUint16(6,0,true);
    lv.setUint16(8,0,true);
    lv.setUint16(10,0,true);
    lv.setUint16(12,0,true);
    lv.setUint32(14,crc,true);
    lv.setUint32(18,data.length,true);
    lv.setUint32(22,data.length,true);
    lv.setUint16(26,name.length,true);
    lv.setUint16(28,0,true);
    local.set(name,30);
    local.set(data,30+name.length);
    locals.push(local);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0,0x02014b50,true);
    cv.setUint16(4,20,true);
    cv.setUint16(6,20,true);
    cv.setUint16(8,0,true);
    cv.setUint16(10,0,true);
    cv.setUint16(12,0,true);
    cv.setUint16(14,0,true);
    cv.setUint32(16,crc,true);
    cv.setUint32(20,data.length,true);
    cv.setUint32(24,data.length,true);
    cv.setUint16(28,name.length,true);
    cv.setUint16(30,0,true);
    cv.setUint16(32,0,true);
    cv.setUint16(34,0,true);
    cv.setUint16(36,0,true);
    cv.setUint32(38,0,true);
    cv.setUint32(42,offset,true);
    central.set(name,46);
    centrals.push(central);
    offset += local.length;
  }

  const centralOffset = offset;
  const centralSize = centrals.reduce((sum,item)=>sum+item.length,0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0,0x06054b50,true);
  ev.setUint16(4,0,true);
  ev.setUint16(6,0,true);
  ev.setUint16(8,entries.length,true);
  ev.setUint16(10,entries.length,true);
  ev.setUint32(12,centralSize,true);
  ev.setUint32(16,centralOffset,true);
  ev.setUint16(20,0,true);

  const total = locals.reduce((sum,item)=>sum+item.length,0) + centralSize + end.length;
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of [...locals,...centrals,end]) {
    out.set(part,cursor);
    cursor += part.length;
  }
  return out;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit=0;bit<8;bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
