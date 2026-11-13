import {parentPort,workerData} from 'node:worker_threads';
import {openSqliteD1} from './sqlite-d1.js';
import {createD1Ledger} from '../../server/d1-ledger.js';
const handle=openSqliteD1(workerData.path),ledger=createD1Ledger({db:handle.db,now:()=>workerData.now});
parentPort.postMessage({ready:true});Atomics.wait(new Int32Array(workerData.barrier),0,0);
try{const result=await ledger[workerData.operation||'reserveAndClaim'](workerData.input);parentPort.postMessage({ok:true,result});}catch(e){parentPort.postMessage({ok:false,code:e.code});}finally{handle.close();}
