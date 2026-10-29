import {useEffect,useState} from 'react';

export function PendingMaterials({work,onChange}) {
  const [items,setItems]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[detail,setDetail]=useState(null);
  const [preview,setPreview]=useState(null),[limit,setLimit]=useState(5000);
  async function call(path,body){
    const response=await fetch('/__serein/pipeline/'+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const result=await response.json();if(!response.ok)throw new Error(result.detail||'材料暂未读取，请稍后重试。');return result;
  }
  useEffect(()=>{
    if(work!==undefined){setItems(work?.pending_materials||[]);return;}
    let alive=true;
    const refresh=async()=>{try{const result=await call('status');if(alive)setItems(result.pending_materials||[]);}catch(e){if(alive)setError(e.message);}};
    refresh();const timer=setInterval(refresh,3000);return()=>{alive=false;clearInterval(timer);};
  },[work]);
  async function read(id){try{setError('');setDetail(await call('pending/'+id));}catch(e){setError(e.message);}}
  async function resume(id,replan=false){
    if(busy)return;setBusy(true);setError('');
    try{
      const result=await call('resume-pending',{pending_id:id,replan});
      if(result.status!=='resumed')throw new Error('整理正在运行，请稍后再试。');
      await call('next',{include_recent:true});const status=await call('status');setItems(status.pending_materials||[]);onChange?.(status);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function previewSplit(item){try{setError('');setPreview({...await call('recovery-preview',{batch_id:item.batch_id,max_input_chars:Number(limit)}),pending_id:item.id});}catch(e){setError(e.message);}}
  async function split(){
    if(busy||!preview)return;setBusy(true);
    try{
      const result=await call('rebatch',{batch_id:preview.batch_id,max_input_chars:preview.max_input_chars,confirm:'REBATCH_PIPELINE_BATCH'});
      if(result.status!=='rebatched')throw new Error('整理正在运行，请稍后再试。');
      setPreview(null);await call('next',{include_recent:true});const status=await call('status');setItems(status.pending_materials||[]);onChange?.(status);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const open=items.filter(item=>['open','running'].includes(item.status));
  const finished=items.filter(item=>!['open','running'].includes(item.status));
  return <section className="settings-group" aria-label="待处理材料"><div className="settings-group__heading"><h3>待处理材料</h3>
    <p>保留原话、最后错误输出与成功步骤。待办不是长期记忆；仅作背景不会结清，明确整份承接并保存 Event 后才完成。</p></div>
    {!open.length&&<p>暂无待处理材料。</p>}
    {open.map(item=><div key={item.id} className="summary-option-group"><h4>待办 {item.id} · {item.kind==='writing'?'已切分待补写':'待归线／切分修复'}</h4>
      <p>{item.summary||'归线尚未完成'} · {item.originals} 条原话 · {item.original_chars} 字符</p><p>{item.reason}</p>
      {item.last_attempt&&<p>最后步骤：{item.last_attempt.role} · {item.last_attempt.error||'已返回结果'} · {item.last_attempt.output_chars} 字符</p>}
      <div className="settings-actions"><button type="button" onClick={()=>read(item.id)}>查看原话与最后输出</button>
        <button type="button" disabled={busy||item.status==='running'||['running','queued'].includes(work?.status)} onClick={()=>resume(item.id)}>从失败步骤继续</button>
        <button type="button" disabled={busy||item.status==='running'} onClick={()=>resume(item.id,true)}>{item.kind==='unrouted'?'重新归线':'重新切分，保留归线'}</button>
        <button type="button" disabled={busy||item.status==='running'} onClick={()=>previewSplit(item)}>按更小材料重新整理</button></div>
      {preview?.pending_id===item.id&&<div><label className="settings-field"><span>每批原话字符上限</span><input type="number" min="2000" max="100000" value={limit} onChange={event=>setLimit(event.target.value)}/></label>
        <button type="button" disabled={busy} onClick={()=>previewSplit(item)}>更新拆分预览</button><p>保留完整问答，拆成 {preview.batches} 批；其中 {preview.oversized_batches} 批仍超出目标。</p>
        <button type="button" disabled={busy||!preview.can_rebatch||Number(limit)!==preview.max_input_chars} onClick={split}>确认拆小并整理</button><button type="button" onClick={()=>setPreview(null)}>取消拆分</button></div>}
    </div>)}
    {finished.length>0&&<details><summary>已处理记录（{finished.length}）</summary>{finished.map(item=><p key={item.id}>待办 {item.id} · {item.status==='resolved_routing'?'已恢复归线':item.resolved_event_ids.length?'已保存／承接为 '+item.resolved_event_ids.join('、'):'已处理'} <button type="button" onClick={()=>read(item.id)}>查看记录</button></p>)}</details>}
    {detail&&<details open><summary>待办 {detail.id} 的原话与最后输出</summary><button type="button" onClick={()=>setDetail(null)}>收起材料</button><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:'32rem',overflow:'auto'}}>{JSON.stringify(detail,null,2)}</pre></details>}
    {error&&<p role="status">{error}</p>}
  </section>;
}
