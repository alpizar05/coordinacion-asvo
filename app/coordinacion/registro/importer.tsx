'use client';
import { useState } from 'react';
import { applyImport, applyPolicies, importPreview, previewPolicies } from '../../staff-actions';

export function Importer() {
  const [csv,setCsv] = useState('');
  const [rows,setRows] = useState<Awaited<ReturnType<typeof importPreview>>>([]);
  const [error,setError] = useState('');
  return <section className="card"><h2>Importar registro</h2>
    <label>Archivo CSV<input type="file" accept=".csv,text/csv" onChange={async event => {
      const file = event.target.files?.[0];
      setRows([]);
      setCsv('');
      setError('');
      if (!file) return;
      if (file.size > 150000) {setError('El archivo es demasiado grande.');return;}
      try {
        const contents = await file.text();
        setRows(await importPreview(contents));
        setCsv(contents);
      } catch {setError('No se pudo leer el CSV. Revisá los encabezados y el formato.');}
    }}/></label>
    <p>Encabezados <code>identificacion,nombre,primer_apellido,correo</code></p>
    {error && <p className="note">{error}</p>}
    {!!rows.length && <form action={applyImport} key={csv}><input type="hidden" name="csv" value={csv}/>
      {rows.map((row,index) => <div key={index}>
        {['Alta','Coincidencia'].includes(row.state) ? <label><input type="checkbox" name={`usar-${row.id}`} defaultChecked={row.state === 'Alta'}/> {row.state} · {row.id} · {row.name} {row.surname} · {row.email || 'Correo pendiente'}</label> : <p>{row.state} · {row.id} · {row.name} {row.surname}</p>}
        {row.current && <small>En el registro: {row.current.name} {row.current.surname} · {row.current.email || 'Correo pendiente'}</small>}
      </div>)}
      <button className="coord-button-primary">Aplicar filas seleccionadas</button>
    </form>}
  </section>;
}

export function PolicyImporter() {
  const [csv,setCsv] = useState('');
  const [rows,setRows] = useState<Awaited<ReturnType<typeof previewPolicies>>>([]);
  const [error,setError] = useState('');
  return <section className="card"><h2>Conciliar pólizas</h2>
    <label>Hoja Polizas exportada como CSV<input type="file" accept=".csv,text/csv" onChange={async event => {
      const file = event.target.files?.[0];
      setRows([]);
      setCsv('');
      setError('');
      if (!file) return;
      if (file.size > 150000) {setError('El archivo es demasiado grande.');return;}
      try {
        const contents = await file.text();
        setRows(await previewPolicies(contents));
        setCsv(contents);
      } catch {setError('No se pudo leer el CSV.');}
    }}/></label>
    <p>Encabezados provisionales <code>identificacion,tipo,numero</code>. La vigencia se comprueba por separado.</p>
    {error && <p className="note">{error}</p>}
    {!!rows.length && <form action={applyPolicies} key={csv}><input type="hidden" name="csv" value={csv}/>
      {rows.map((row,index) => row.valid ? <label key={index}><input type="checkbox" name={`usar-${index}`} defaultChecked/>
        {row.identification} · {row.person?.name} {row.person?.surname} · {row.kind} {row.number} · Vigencia pendiente</label> :
        <p key={index}>{row.identification || 'Identificación pendiente'} · {row.person ? 'Datos de póliza incompletos' : 'Sin coincidencia en el registro'}</p>)}
      <button className="coord-button-primary">Aplicar pólizas seleccionadas</button>
    </form>}
  </section>;
}
