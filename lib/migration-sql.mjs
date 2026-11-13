/** Top-level command lexer, skipping PostgreSQL quoted bodies/identifiers and nested comments. */
export function migrationCommands(source) {
  const commands=[]; let current='',quote=null,dollar=null,comment=0,line=false;
  for(let i=0;i<source.length;i++){
    const ch=source[i],next=source[i+1];
    if(line){if(ch==='\n'){line=false;current+=' ';}continue;}
    if(comment){if(ch==='/'&&next==='*'){comment++;i++;}else if(ch==='*'&&next==='/'){comment--;i++;}continue;}
    if(dollar){if(source.startsWith(dollar,i)){i+=dollar.length-1;dollar=null;current+=' ';}continue;}
    if(quote){
      if(ch==='\\'&&quote==="'"){i++;continue;}
      if(ch===quote){if(next===quote){i++;continue;}quote=null;current+=' ';}continue;
    }
    if(ch==='-'&&next==='-'){line=true;i++;continue;}
    if(ch==='/'&&next==='*'){comment=1;i++;current+=' ';continue;}
    if(ch==="'"||ch==='"'){quote=ch;current+=' quoted ';continue;}
    if(ch==='$'){
      const tag=source.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0];
      if(tag){dollar=tag;i+=tag.length-1;current+=' body ';continue;}
    }
    if(ch===';'){if(current.trim())commands.push(current.trim().replace(/\s+/g,' ').toUpperCase());current='';}
    else current+=ch;
  }
  if(quote||dollar||comment)throw new Error('SQL incompleto: comillas o comentarios sin cerrar.');
  if(current.trim())commands.push(current.trim().replace(/\s+/g,' ').toUpperCase());
  return commands;
}
export function requireTransactionalMigration(source,id){
  for(const command of migrationCommands(source)){
    if(/^(BEGIN|START TRANSACTION|COMMIT|END|ROLLBACK|ABORT|SAVEPOINT|RELEASE|PREPARE TRANSACTION)\b/.test(command))
      throw new Error(`${id}: el archivo no puede controlar la transacción del migrador.`);
    if(/^(VACUUM|CREATE DATABASE|DROP DATABASE|ALTER SYSTEM|CREATE (UNIQUE )?INDEX CONCURRENTLY|DROP INDEX CONCURRENTLY|REINDEX .*CONCURRENTLY)\b/.test(command))
      throw new Error(`${id}: operación no admitida por el ejecutor transaccional. Requiere un procedimiento explícito separado.`);
  }
}
