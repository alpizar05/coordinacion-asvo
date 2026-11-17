// Consumer regression, not a private-token or persisted-report test.
import {ReportForm} from '../../resumen-salida/[token]/informe/report-form';
export default function Page(){return <><h1>Regresión local del informe</h1><ReportForm token="fictitious-component-only" version="fictitious" lead={{name:'Responsable Ficticio',email:'responsable@example.test'}} participants={[{id:'11111111-1111-4111-8111-000000000105',name:'Persona Ficticia'}]} initial={{labour:[],location:'Local ficticio',activity:'',starts:'2035-01-10',ends:'2035-01-12',actions:'',host:'',observations:''}}/></>}
