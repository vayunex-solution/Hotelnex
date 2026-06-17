import{c as o}from"./index-D9FCQhxr.js";/**
 * @license lucide-react v0.395.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const s=o("Contact",[["path",{d:"M17 18a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2",key:"1mghuy"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["circle",{cx:"12",cy:"10",r:"2",key:"1yojzk"}],["line",{x1:"8",x2:"8",y1:"2",y2:"4",key:"1ff9gb"}],["line",{x1:"16",x2:"16",y1:"2",y2:"4",key:"1ufoma"}]]);/**
 * @license lucide-react v0.395.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const l=o("ShieldCheck",[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]),r=()=>typeof window<"u"&&"contacts"in navigator&&"ContactsManager"in window,y=async()=>{if(!r())throw new Error("Contact Picker is not supported on this browser/device.");try{const e=["name","tel"],n=await navigator.contacts.select(e,{multiple:!1});if(n&&n.length>0){const t=n[0],a=t.name&&t.name[0]?t.name[0]:"";let c=t.tel&&t.tel[0]?t.tel[0]:"";return c&&(c=c.replace(/[\s()\-]/g,"")),{name:a,phone:c}}}catch(e){throw console.error("[ContactPicker] Error picking contact:",e),e}return null};export{s as C,l as S,r as i,y as p};
