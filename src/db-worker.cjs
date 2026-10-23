const {parentPort,workerData}=require('node:worker_threads');
const {Store}=require('./store.cjs');
try {
  const store=new Store(workerData.file);
  parentPort.on('message',({id,method,args})=>{
    try{const value=store[method](...args);parentPort.postMessage({id,value});}
    catch(e){parentPort.postMessage({id,error:e.message});}
  });
  parentPort.postMessage({ready:true});
}catch(e){parentPort.postMessage({fatal:e.message});}
