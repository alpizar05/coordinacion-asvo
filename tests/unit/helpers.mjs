export const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export function form(values={}) {
  const data=new FormData();
  for(const [key,value]of Object.entries(values))for(const item of Array.isArray(value)?value:[value])data.append(key,item);
  return data;
}
export const schedule={flexible:true,starts:'2035-01-10',ends:'2035-01-15'};
