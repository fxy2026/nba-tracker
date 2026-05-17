// Inline script injected synchronously into <head> to prevent flash of
// wrong theme (FOWT). Runs before React hydrates, before first paint.
// Read user preference: localStorage → prefers-color-scheme → dark fallback.
export default function ThemeScript() {
  // The function body is stringified into a <script> tag below. Keep it
  // dependency-free.
  const code = `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}if(t==='light'){document.documentElement.setAttribute('data-theme','light');}var m=document.querySelector('meta[name="theme-color"]');if(m){m.setAttribute('content',t==='light'?'#F8FAFC':'#060912');}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
