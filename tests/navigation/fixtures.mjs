export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const frame=(n=1,extra={})=>({destination:'/coordinacion/inscripciones?estado=revisi%C3%B3n&unidad=UEA',anchor:`inscripcion-${id(n)}`,list:'requests',index:1,neighbors:[`inscripcion-${id(n+1)}`,`inscripcion-${id(n-1)}`],offset:170,y:800,...extra});
export const context=(time=1_000_000,extra={})=>({detail:`/coordinacion/registro/${id(99)}`,frames:[frame()],time,...extra});
export class MemoryStorage{
 entries=new Map();get length(){return this.entries.size;}key(index){return [...this.entries.keys()][index]??null;}
 getItem(key){return this.entries.get(key)??null;}setItem(key,value){this.entries.set(key,String(value));}removeItem(key){this.entries.delete(key);}
}
