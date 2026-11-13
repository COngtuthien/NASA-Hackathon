// Inline, render-blocking script for <head> (app/layout.tsx): applies the theme and the navigation state before first
// paint, so neither flashes. Static string, no user input. Keys match lib/theme.ts and lib/ui-prefs.ts.
export const THEME_KEY = "spacefire:theme";
export const LIGHT_QUERY = "(prefers-color-scheme: light)";
export const PREPAINT_SCRIPT =
  `try{var d=document.documentElement,t=localStorage.getItem("${THEME_KEY}");` +
  `if(t!=="light"&&t!=="dark")t=window.matchMedia("${LIGHT_QUERY}").matches?"light":"dark";d.dataset.theme=t;` +
  `if(localStorage.getItem("spacefire:nav")==="collapsed")d.dataset.nav="collapsed"}catch(e){}`;
