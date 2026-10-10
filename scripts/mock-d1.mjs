// In-memory D1 facade for tests. Models SQLite's one-time DELETE RETURNING.
export class FakeD1 {
  constructor(){this.values=new Map();}
  prepare(sql){
    const db=this;
    return {
      args:[],
      bind(...values){this.args=values;return this;},
      async run(){
        const [id,payload,expires]=this.args;
        if(sql.startsWith('CREATE TABLE'))return{success:true};
        if(sql.startsWith('INSERT')){if(db.values.has(id))throw Error('duplicate');db.values.set(id,{payload,expires});return{success:true};}
        if(sql.startsWith('DELETE')&&sql.includes('expires_at <')){for(const [k,v] of db.values)if(v.expires<Date.now())db.values.delete(k);return{success:true};}
        throw Error('unhandled run: '+sql);
      },
      async first(){
        const [id,now]=this.args;
        const item=db.values.get(id);
        if(sql.startsWith('SELECT'))return item&&item.expires>now?{payload:item.payload}:null;
        if(sql.includes('RETURNING')){db.values.delete(id);return item?{payload:item.payload}:null;}
        throw Error('unhandled first: '+sql);
      }
    };
  }
}
