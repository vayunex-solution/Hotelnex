import{e as n}from"./index-CHFvkWMg.js";/**
 * @license lucide-react v0.395.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const s=n("Camera",[["path",{d:"M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z",key:"1tc9qg"}],["circle",{cx:"12",cy:"13",r:"3",key:"1vg3eu"}]]);/**
 * @license lucide-react v0.395.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=n("Contact",[["path",{d:"M17 18a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2",key:"1mghuy"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["circle",{cx:"12",cy:"10",r:"2",key:"1yojzk"}],["line",{x1:"8",x2:"8",y1:"2",y2:"4",key:"1ff9gb"}],["line",{x1:"16",x2:"16",y1:"2",y2:"4",key:"1ufoma"}]]),r=()=>typeof window<"u"&&"contacts"in navigator&&"ContactsManager"in window,l=async()=>{if(!r())throw new Error("Contact Picker is not supported on this browser/device.");try{const e=["name","tel"],a=await navigator.contacts.select(e,{multiple:!1});if(a&&a.length>0){const t=a[0],o=t.name&&t.name[0]?t.name[0]:"";let c=t.tel&&t.tel[0]?t.tel[0]:"";return c&&(c=c.replace(/[\s()\-]/g,"")),{name:o,phone:c}}}catch(e){throw console.error("[ContactPicker] Error picking contact:",e),e}return null};export{y as C,s as a,r as i,l as p};
