import{a}from"./virtual.BOcvvgUI.js";window.adCheckout=async o=>{const{data:r,error:e}=await a.checkout(o);return e?{ok:!1,error:e.message}:{ok:!0,redirect:r?.url??void 0,free:!!r?.free}};
