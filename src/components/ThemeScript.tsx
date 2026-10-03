// Inline script injected synchronously into <head> to prevent flash of
// wrong theme (FOWT). Runs before React hydrates, before first paint.
// Honor a saved site preference; otherwise use light, independent of the OS.
export default function ThemeScript() {
  // Keep the inline script dependency-free. Storage can be unavailable without
  // preventing the default theme from being applied before hydration.
  const code = `(function(){var t='light';try{if(localStorage.getItem('theme')==='dark'){t='dark';}}catch(e){}document.documentElement.setAttribute('data-theme',t);document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute('content',t==='light'?'#F8FAFC':'#060912');});})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
