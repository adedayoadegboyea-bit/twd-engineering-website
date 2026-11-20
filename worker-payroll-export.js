import { unzipSync, zipSync, strFromU8, strToU8 } from "https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js";

export async function exportWorkerPayroll(workers, month) {
 const response = await fetch("./downloads/TWD-Payroll-Template.xlsx", {cache:"no-store"});
 if (!response.ok) throw new Error("The payroll template could not be downloaded.");
 const parts = unzipSync(new Uint8Array(await response.arrayBuffer()));
 const path = "xl/worksheets/sheet1.xml";
 const doc = new DOMParser().parseFromString(strFromU8(parts[path]), "application/xml");
 if (doc.querySelector("parsererror")) throw new Error("The payroll template could not be read.");
 const ns = doc.documentElement.namespaceURI;
 const cells = new Map([...doc.getElementsByTagNameNS(ns,"c")].map(cell => [cell.getAttribute("r"),cell]));
 function write(address,value) {
  if(value===null||value===undefined||value==="") return;
  const cell=cells.get(address);
  if(!cell) throw new Error("The payroll template is missing cell "+address+".");
  cell.replaceChildren();
  if(typeof value==="number"){
   cell.removeAttribute("t");
   const node=doc.createElementNS(ns,"v");
   node.textContent=String(value);
   cell.append(node);
  }else{
   cell.setAttribute("t","inlineStr");
   const inline=doc.createElementNS(ns,"is"), label=doc.createElementNS(ns,"t");
   label.textContent=value;
   inline.append(label);
   cell.append(inline);
  }
 }
 write("B4",Math.round(Date.parse(month+"-01T00:00:00Z")/86400000)+25569);
 write("K11","Other payments");
 write("O11","Other deductions");
 // Use the existing pension cell for a dedicated loan field in this export.
 write("N11","Loan repayment");
 workers.forEach((worker,index)=>{
  const row=index+12;
  const values={A:worker.employee_code,B:worker.full_name,C:worker.department,D:worker.bank_name,E:worker.account_name,F:worker.account_number,G:worker.monthly_salary,K:worker.payroll_other_payments,N:worker.payroll_loan_repayment,O:worker.payroll_deductions};
  for(const [column,value] of Object.entries(values)){
   write(column+row,["G","K","N","O"].includes(column)&&value!==null?Number(value):value);
  }
 });
 for(const cell of cells.values()){
  if(cell.getElementsByTagNameNS(ns,"f").length) for(const value of [...cell.getElementsByTagNameNS(ns,"v")])value.remove();
 }
 parts[path]=strToU8(new XMLSerializer().serializeToString(doc));
 const link=document.createElement("a");
 link.href=URL.createObjectURL(new Blob([zipSync(parts)],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
 link.download="TWD-Payroll-"+month+".xlsx";
 document.body.append(link);
 link.click();
 link.remove();
 setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}
