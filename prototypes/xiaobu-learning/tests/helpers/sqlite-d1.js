// Test-only D1-shaped binding backed by actual SQLite, not an in-memory JS ledger.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function openSqliteD1(path,{migrate=false}={}){
 const connection=new DatabaseSync(path);connection.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
 if(migrate)connection.exec(readFileSync(new URL('../../server/migrations/0001_tutor.sql',import.meta.url),'utf8'));
 const db={prepare(sql){return {sql,args:[],bind(...args){return {...this,args};}};},async batch(statements){connection.exec('BEGIN IMMEDIATE');try{const out=statements.map(({sql,args})=>{const stmt=connection.prepare(sql);if(/^\s*(SELECT|PRAGMA)\b/i.test(sql))return {success:true,results:stmt.all(...args).map(row=>({...row})),meta:{changes:0}};const meta=stmt.run(...args);return {success:true,results:[],meta:{changes:meta.changes}};});connection.exec('COMMIT');return out;}catch(error){connection.exec('ROLLBACK');throw error;}}};
 return {db,connection,close(){connection.close();}};
}
