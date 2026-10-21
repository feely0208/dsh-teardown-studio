/**
 * @deepwhale-cn/dsh-teardown-studio — client half
 * Floating entry + full-screen local Studio. UI is served by the host half.
 */
window.__ModuleLoader__.load({
  id: '@deepwhale-cn/dsh-teardown-studio',
  factory: () => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    const inject = [];
    const URL = 'http://127.0.0.1:17899/studio/';
    const CSS = `
.dwh-ts-btn{position:fixed;right:24px;bottom:150px;z-index:2147482600;display:flex;align-items:center;gap:8px;
 background:linear-gradient(135deg,#17c8b3,#1f8fff);color:#04111f;border:0;border-radius:999px;
 padding:10px 16px;font:700 13px/1 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;cursor:pointer;
 box-shadow:0 10px 30px rgba(23,200,179,.35)}
.dwh-ts-btn:hover{filter:brightness(1.06)}
.dwh-ts{position:fixed;inset:0;z-index:2147482700;background:#061324;display:none}
.dwh-ts.on{display:block}
.dwh-ts iframe{width:100%;height:100%;border:0;display:block;background:#061324}
.dwh-ts-close{position:absolute;right:18px;top:14px;z-index:2;background:rgba(6,19,36,.8);color:#e7f1ff;
 border:1px solid rgba(120,180,255,.25);border-radius:8px;font:12px/1 monospace;padding:8px 10px;cursor:pointer}
`;
    function mount() {
      if (window.__dwhTeardownMounted) return;
      window.__dwhTeardownMounted = true;
      const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
      const btn = document.createElement('button'); btn.className = 'dwh-ts-btn'; btn.type = 'button';
      btn.innerHTML = '<span>◈</span><span>拆解工作室</span>';
      const wrap = document.createElement('div'); wrap.className = 'dwh-ts';
      wrap.innerHTML = '<button class="dwh-ts-close" type="button">关闭 ×</button><iframe title="Teardown Studio"></iframe>';
      const close = () => { wrap.classList.remove('on'); };
      btn.onclick = () => { const f = wrap.querySelector('iframe'); if (!f.src) f.src = URL; wrap.classList.add('on'); };
      wrap.querySelector('.dwh-ts-close').onclick = close;
      document.body.appendChild(btn); document.body.appendChild(wrap);
    }
    exports.inject = inject;
    exports.apply = () => {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
      else mount();
    };
    return module.exports;
  },
});
