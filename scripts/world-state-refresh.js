// A background map refresh must never overwrite a newer action snapshot.
export function createWorldRefreshGate(){
 let revision=0, pending=0;
 return {
  invalidate(){revision++;},
  async run(load,apply,{background=false}={}){
   if(background&&pending>0)return false;
   const current=++revision;
   pending++;
   try{
    const result=await load();
    if(current!==revision)return false;
    apply(result);
    return true;
   }catch(error){
    if(current!==revision)return false;
    throw error;
   }finally{pending--;}
  }
 };
}
