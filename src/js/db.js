const SB_URL='https://erkbzkmqrfoqaustyqoj.supabase.co';
const SB_KEY='sb_publishable_ssGBGLkA6cQvvD6soao2Ww_AdCP_SqN';
const sb=supabase.createClient(SB_URL,SB_KEY);

// Throw on a Supabase error result, otherwise pass it through.
const ck=r=>{if(r&&r.error)throw r.error;return r};

// Supabase returns max 1000 rows per request: page through all of them.
async function fetchAll(q){
  let all=[],from=0;
  for(;;){
    const r=ck(await q().range(from,from+999));
    all=all.concat(r.data);
    if(r.data.length<1000)return all;
    from+=1000;
  }
}
