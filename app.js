const $=s=>document.querySelector(s);
const money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2});
const currentMonth=()=>new Date().toISOString().slice(0,7);
const toast=msg=>{const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)};
$('#today').textContent=new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
$('#budgetMonth').value=currentMonth();$('#txnDate').value=new Date().toISOString().slice(0,10);
async function api(url,options={}){const res=await fetch(url,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options});const data=await res.json();if(!res.ok||!data.ok)throw new Error(data.error||'Something went wrong');return data}
async function refresh(){
 try{
 const d=await api('/api/dashboard?month='+$('#budgetMonth').value);
 $('#incomeTotal').textContent=money(d.totals.income);$('#expenseTotal').textContent=money(d.totals.expenses);$('#balanceTotal').textContent=money(d.totals.balance);
 if(d.budget){const b=d.budget;$('#plannedSavings').textContent=money(b.savings);const pct=b.income?Math.max(0,Math.min(100,b.savings/b.income*100)):0;$('#budgetProgress').style.width=pct+'%';$('#budgetHint').textContent=`${pct.toFixed(1)}% of income planned as savings · ${money(b.income)} income`;}
 renderTransactions(d.transactions);renderGoals(d.goals);
 }catch(e){toast(e.message)}
}
function renderTransactions(items){const body=$('#transactionRows');if(!items.length){body.innerHTML='<tr><td colspan="6" class="empty">No transactions for this month yet.</td></tr>';return}
 body.innerHTML=items.map(t=>`<tr><td>${escapeHtml(t.title)}</td><td>${escapeHtml(t.category)}</td><td>${t.date}</td><td><span class="type-pill">${t.kind}</span></td><td class="right ${t.kind==='income'?'amount-income':'amount-expense'}">${t.kind==='income'?'+':'−'}${money(t.amount)}</td><td><button class="delete-btn" data-delete-txn="${t.id}" title="Delete">×</button></td></tr>`).join('')}
function renderGoals(goals){const grid=$('#goalGrid');if(!goals.length){grid.innerHTML='<div class="empty">Create a goal to start tracking your progress.</div>';return}
 grid.innerHTML=goals.map(g=>`<article class="goal-card"><h4>${escapeHtml(g.title)}</h4><div class="goal-numbers"><span>${money(g.saved)} saved</span><span>${money(g.target)} goal</span></div><div class="progress"><span style="width:${g.progress}%"></span></div><div class="goal-numbers"><b>${g.progress.toFixed(1)}% complete</b><span> </span></div><div class="goal-actions"><button data-add-goal="${g.id}" data-saved="${g.saved}">＋ Add savings</button><button data-delete-goal="${g.id}">Delete</button></div></article>`).join('')}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
$('#budgetForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const payload=Object.fromEntries(f.entries());['income','needs','wants','debt'].forEach(k=>payload[k]=Number(payload[k]));try{const d=await api('/api/budget',{method:'POST',body:JSON.stringify(payload)});toast(d.message+' Planned savings: '+money(d.savings));refresh()}catch(err){toast(err.message)}});
$('#transactionForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const payload=Object.fromEntries(f.entries());payload.amount=Number(payload.amount);try{const d=await api('/api/transactions',{method:'POST',body:JSON.stringify(payload)});toast(d.message);e.currentTarget.reset();$('#txnDate').value=new Date().toISOString().slice(0,10);refresh()}catch(err){toast(err.message)}});
$('#budgetMonth').addEventListener('change',refresh);
$('#transactionRows').addEventListener('click',async e=>{const b=e.target.closest('[data-delete-txn]');if(!b)return;if(!confirm('Delete this transaction?'))return;try{await api('/api/transactions/'+b.dataset.deleteTxn,{method:'DELETE'});toast('Transaction deleted.');refresh()}catch(err){toast(err.message)}});
$('#openGoal').addEventListener('click',()=>$('#goalModal').classList.add('show'));$('#closeGoal').addEventListener('click',()=>$('#goalModal').classList.remove('show'));$('#goalModal').addEventListener('click',e=>{if(e.target.id==='goalModal')$('#goalModal').classList.remove('show')});
$('#goalForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget),p=Object.fromEntries(f.entries());p.target=Number(p.target);p.saved=Number(p.saved);try{const d=await api('/api/goals',{method:'POST',body:JSON.stringify(p)});toast(d.message);e.currentTarget.reset();$('#goalModal').classList.remove('show');refresh()}catch(err){toast(err.message)}});
$('#goalGrid').addEventListener('click',async e=>{const add=e.target.closest('[data-add-goal]'),del=e.target.closest('[data-delete-goal]');try{if(add){const amount=prompt('How much did you save? (₹)');if(amount===null)return;const n=Number(amount);if(!Number.isFinite(n)||n<=0){toast('Enter an amount above zero.');return}await api('/api/goals/'+add.dataset.addGoal,{method:'PATCH',body:JSON.stringify({saved:Number(add.dataset.saved)+n})});toast('Goal progress updated.')}else if(del){if(!confirm('Delete this goal?'))return;await api('/api/goals/'+del.dataset.deleteGoal,{method:'DELETE'});toast('Goal deleted.')}else return;refresh()}catch(err){toast(err.message)}});
const art=$('#heroArt');function spin(){art.classList.remove('spin');void art.offsetWidth;art.classList.add('spin');setTimeout(()=>art.classList.remove('spin'),900)}art.addEventListener('click',spin);art.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();spin()}});
refresh();
